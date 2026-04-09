import { z } from "zod";

const ZohoSheetConfigSchema = z.object({
  accounts_base_url: z.string().url(),
  api_base_url: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  refresh_token: z.string().min(1),
  resource_id: z.string().min(1),
  worksheet_name: z.string().min(1),
  header_row: z.number().int().positive().optional()
});

const ZohoTokenResponseSchema = z.object({
  access_token: z.string().min(1)
});

const ZohoSheetWriteResponseSchema = z.object({
  status: z.string().optional(),
  method: z.string().optional(),
  error_message: z.string().optional(),
  error_code: z.number().optional(),
  warning: z.string().optional()
});

export type EarlyAccessLead = {
  source: "home" | "signup";
  email: string;
  name?: string;
  company?: string;
  referrer?: string;
  user_agent?: string;
  submitted_at: string;
};

export type ZohoSheetClient = {
  is_configured: boolean;
  appendEarlyAccessLead: (lead: EarlyAccessLead) => Promise<void>;
};

export function createZohoSheetClient(options: { fetch_impl?: typeof fetch } = {}): ZohoSheetClient {
  const fetcher = options.fetch_impl ?? fetch;
  const config = readZohoSheetConfigFromEnv();

  return {
    is_configured: config !== null,
    async appendEarlyAccessLead(lead) {
      if (!config) {
        throw new Error("Zoho Sheet is not configured for early-access capture.");
      }

      const accessToken = await getZohoAccessToken(fetcher, config);
      const payload = new URLSearchParams();
      payload.set("method", "worksheet.jsondata.append");
      payload.set("resource_id", config.resource_id);
      payload.set("worksheet_name", config.worksheet_name);
      payload.set(
        "json_data",
        JSON.stringify([
          {
            Source: lead.source,
            Email: lead.email,
            Name: lead.name ?? "",
            Company: lead.company ?? "",
            "Submitted At": lead.submitted_at,
            Referrer: lead.referrer ?? "",
            "User Agent": lead.user_agent ?? ""
          }
        ])
      );

      if (config.header_row) {
        payload.set("header_row", String(config.header_row));
      }

      const response = await fetcher(`${config.api_base_url}/api/v2/${config.resource_id}`, {
        method: "POST",
        headers: {
          "Authorization": `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: payload
      });

      const rawBody = await response.text();
      const parsedBody = parseZohoJsonResponse(rawBody);
      const parsed = ZohoSheetWriteResponseSchema.safeParse(parsedBody);

      if (!response.ok) {
        throw new Error(buildZohoErrorMessage(parsed.success ? parsed.data : null, rawBody));
      }

      if (parsed.success && parsed.data.status === "failure") {
        throw new Error(buildZohoErrorMessage(parsed.data, rawBody));
      }
    }
  };
}

function readZohoSheetConfigFromEnv() {
  const rawHeaderRow = normalizeOptionalText(process.env.ZOHO_SHEET_HEADER_ROW);
  const parsed = ZohoSheetConfigSchema.safeParse({
    accounts_base_url:
      normalizeOptionalText(process.env.ZOHO_ACCOUNTS_BASE_URL) ?? "https://accounts.zoho.com",
    api_base_url:
      normalizeOptionalText(process.env.ZOHO_SHEET_API_BASE_URL) ?? "https://sheet.zoho.com",
    client_id: normalizeOptionalText(process.env.ZOHO_SHEET_CLIENT_ID),
    client_secret: normalizeOptionalText(process.env.ZOHO_SHEET_CLIENT_SECRET),
    refresh_token: normalizeOptionalText(process.env.ZOHO_SHEET_REFRESH_TOKEN),
    resource_id: normalizeOptionalText(process.env.ZOHO_SHEET_RESOURCE_ID),
    worksheet_name: normalizeOptionalText(process.env.ZOHO_SHEET_WORKSHEET_NAME),
    header_row: rawHeaderRow ? Number.parseInt(rawHeaderRow, 10) : undefined
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

async function getZohoAccessToken(
  fetcher: typeof fetch,
  config: z.infer<typeof ZohoSheetConfigSchema>
): Promise<string> {
  const tokenBody = new URLSearchParams();
  tokenBody.set("refresh_token", config.refresh_token);
  tokenBody.set("client_id", config.client_id);
  tokenBody.set("client_secret", config.client_secret);
  tokenBody.set("grant_type", "refresh_token");

  const response = await fetcher(`${config.accounts_base_url}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: tokenBody
  });

  const rawBody = await response.text();
  const parsedBody = parseZohoJsonResponse(rawBody);
  const parsed = ZohoTokenResponseSchema.safeParse(parsedBody);

  if (!response.ok || !parsed.success) {
    throw new Error("Zoho OAuth token refresh failed for early-access capture.");
  }

  return parsed.data.access_token;
}

function buildZohoErrorMessage(
  payload: z.infer<typeof ZohoSheetWriteResponseSchema> | null,
  rawBody: string
): string {
  if (payload?.error_message) {
    return `Zoho Sheet rejected the row: ${payload.error_message}`;
  }

  if (rawBody.trim().length > 0) {
    return `Zoho Sheet rejected the row: ${rawBody.trim()}`;
  }

  return "Zoho Sheet rejected the row.";
}

function parseZohoJsonResponse(rawBody: string): unknown {
  if (rawBody.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
