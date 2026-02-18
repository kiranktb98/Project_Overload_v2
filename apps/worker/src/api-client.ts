import { ReportContractSchema, type ReportContract } from "@project-overload/shared";

export type WorkerApiRunResult = {
  run_id: string;
};

export type WorkerRunRequest = {
  trigger?: "manual" | "scheduled" | "retry";
  attempt?: number;
  retry_of_run_id?: string | null;
};

export interface WorkerApiClient {
  listContracts(): Promise<ReportContract[]>;
  runContract(contractId: string, request?: WorkerRunRequest): Promise<WorkerApiRunResult>;
  logWorkerEvent?(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

export type CreateWorkerApiClientOptions = {
  base_url?: string;
  fetch_impl?: typeof fetch;
};

export function createWorkerApiClientFromEnv(
  options: Partial<CreateWorkerApiClientOptions> = {}
): WorkerApiClient {
  const baseUrl =
    options.base_url ??
    process.env.WORKER_API_BASE_URL ??
    process.env.WEB_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000";

  return createWorkerApiClient({
    base_url: baseUrl,
    fetch_impl: options.fetch_impl
  });
}

export function createWorkerApiClient(options: CreateWorkerApiClientOptions): WorkerApiClient {
  const fetcher = options.fetch_impl ?? fetch;
  const baseUrl = (options.base_url ?? "http://127.0.0.1:4000").replace(/\/+$/, "");

  return {
    async listContracts(): Promise<ReportContract[]> {
      const response = await fetcher(`${baseUrl}/report-contracts`, {
        method: "GET"
      });
      const payload = await parseJsonPayload(response);
      return ReportContractSchema.array().parse(payload);
    },
    async runContract(contractId: string, request?: WorkerRunRequest): Promise<WorkerApiRunResult> {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          trigger: request?.trigger ?? "scheduled",
          attempt: request?.attempt ?? 1,
          retry_of_run_id: request?.retry_of_run_id ?? null
        })
      });
      const payload = await parseJsonPayload(response);

      if (!isRecord(payload) || typeof payload.run_id !== "string" || payload.run_id.trim().length === 0) {
        throw new Error("Invalid run response payload.");
      }

      return {
        run_id: payload.run_id
      };
    },
    async logWorkerEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
      await fetcher(`${baseUrl}/worker-events`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          event_type: eventType,
          payload
        })
      });
    }
  };
}

async function parseJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};

  if (!response.ok) {
    if (isRecord(payload) && typeof payload.message === "string") {
      throw new Error(payload.message);
    }

    throw new Error(`Worker API request failed (${response.status}).`);
  }

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
