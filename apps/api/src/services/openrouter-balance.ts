import { z } from "zod";

const OpenRouterBalanceSchema = z.object({
  available: z.boolean(),
  provider: z.literal("openrouter"),
  remaining_credits: z.number().nullable(),
  total_credits: z.number().nullable(),
  used_credits: z.number().nullable(),
  last_refreshed_at: z.string().datetime(),
  source: z.enum(["credits", "key", "unavailable"]),
  stale_reason: z.string().nullable().default(null)
});

export type OpenRouterBalanceSnapshot = z.infer<typeof OpenRouterBalanceSchema>;

export async function fetchOpenRouterBalance(fetchImpl: typeof fetch = fetch): Promise<OpenRouterBalanceSnapshot> {
  const apiKey =
    process.env.OPENROUTER_MANAGEMENT_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "";
  const baseUrl = (process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const nowIso = new Date().toISOString();

  if (apiKey.length === 0) {
    return OpenRouterBalanceSchema.parse({
      available: false,
      provider: "openrouter",
      remaining_credits: null,
      total_credits: null,
      used_credits: null,
      last_refreshed_at: nowIso,
      source: "unavailable",
      stale_reason: "OPENROUTER_API_KEY is not configured on the server."
    });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    ...(process.env.OPENROUTER_APP_URL ? { "HTTP-Referer": process.env.OPENROUTER_APP_URL } : {}),
    ...(process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {})
  };

  try {
    const creditsResponse = await fetchImpl(`${baseUrl}/credits`, {
      method: "GET",
      headers
    });
    if (creditsResponse.ok) {
      const payload = await creditsResponse.json();
      const extracted = extractCreditsPayload(payload);
      if (extracted) {
        return OpenRouterBalanceSchema.parse({
          available: true,
          provider: "openrouter",
          remaining_credits: extracted.remaining,
          total_credits: extracted.total,
          used_credits: extracted.used,
          last_refreshed_at: nowIso,
          source: "credits",
          stale_reason: null
        });
      }
    }
  } catch {
    // Fall through to key endpoint / unavailable snapshot.
  }

  try {
    const keyResponse = await fetchImpl(`${baseUrl}/key`, {
      method: "GET",
      headers
    });
    if (keyResponse.ok) {
      const payload = await keyResponse.json();
      const extracted = extractCreditsPayload(payload);
      if (extracted) {
        return OpenRouterBalanceSchema.parse({
          available: extracted.remaining !== null || extracted.total !== null || extracted.used !== null,
          provider: "openrouter",
          remaining_credits: extracted.remaining,
          total_credits: extracted.total,
          used_credits: extracted.used,
          last_refreshed_at: nowIso,
          source: "key",
          stale_reason: null
        });
      }
    }
  } catch {
    // ignore
  }

  return OpenRouterBalanceSchema.parse({
    available: false,
    provider: "openrouter",
    remaining_credits: null,
    total_credits: null,
    used_credits: null,
    last_refreshed_at: nowIso,
    source: "unavailable",
    stale_reason: "OpenRouter balance is temporarily unavailable."
  });
}

function extractCreditsPayload(payload: unknown): { remaining: number | null; total: number | null; used: number | null } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const total = firstFiniteNumber(data, [
    "total_credits",
    "total",
    "limit",
    "credit_limit",
    "balance_total"
  ]);
  const used = firstFiniteNumber(data, [
    "used_credits",
    "used",
    "usage",
    "balance_used"
  ]);
  const remaining = firstFiniteNumber(data, [
    "remaining_credits",
    "remaining",
    "balance",
    "balance_remaining"
  ]);

  if (total === null && used === null && remaining === null) {
    return null;
  }

  return {
    remaining,
    total,
    used
  };
}

function firstFiniteNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}
