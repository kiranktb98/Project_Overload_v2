import { randomUUID } from "node:crypto";
import {
  ExecBriefSchema,
  ReportContractSchema
} from "@project-overload/shared";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 15000;

export const ChatDraftSchema = z.object({
  name: z.string(),
  audience: z.string(),
  timezone: z.string(),
  schedule_cron: z.string().nullable(),
  sql_template: z.string(),
  metric_ids: z.array(z.string()),
  dimension_ids: z.array(z.string()),
  allowed_relations: z.array(z.string()),
  allowed_schemas: z.array(z.string())
});

export const ChatStateSchema = z.object({
  draft: ChatDraftSchema,
  contract_id: z.string().nullable(),
  last_run_id: z.string().nullable()
});

export const ChatTurnRequestSchema = z.object({
  message: z.string().trim().min(1),
  state: z.unknown().optional()
});

export type ChatDraft = z.infer<typeof ChatDraftSchema>;
export type ChatState = z.infer<typeof ChatStateSchema>;

export type ChatTurnResponse = {
  assistant_message: string;
  state: ChatState;
};

type ReportContractRecord = z.output<typeof ReportContractSchema>;
type ExecBriefRecord = z.output<typeof ExecBriefSchema>;

export type CreateWebApiClientOptions = {
  base_url: string;
  fetch_impl?: typeof fetch;
};

export interface WebApiClient {
  createContract(payload: ReportContractRecord): Promise<ReportContractRecord>;
  listContracts(): Promise<ReportContractRecord[]>;
  runContract(contractId: string): Promise<{ run_id: string; exec_brief: ExecBriefRecord }>;
}

const RunContractResponseSchema = z.object({
  run_id: z.string().min(1),
  exec_brief: ExecBriefSchema
});

const DEFAULT_DRAFT: ChatDraft = {
  name: "",
  audience: "Executive",
  timezone: "UTC",
  schedule_cron: null,
  sql_template: "SELECT * FROM analytics.sales",
  metric_ids: ["metric_revenue"],
  dimension_ids: ["region"],
  allowed_relations: ["analytics.sales"],
  allowed_schemas: ["analytics"]
};

const HELP_TEXT = [
  "Use one command per message.",
  "set name: Weekly CEO report",
  "set audience: CEO",
  "set timezone: Asia/Kolkata",
  "set schedule: 0 18 * * 5",
  "set sql: SELECT region, SUM(amount) AS revenue FROM analytics.sales GROUP BY region",
  "set metrics: metric_revenue, metric_orders",
  "set dimensions: region",
  "preview",
  "save",
  "run",
  "list contracts"
].join("\n");

const COMMAND_HINT = [
  "I can draft, save, and run report contracts.",
  "Try: set name: Weekly Revenue, then preview, then save, then run."
].join("\n");

export function createInitialChatState(): ChatState {
  return {
    draft: {
      ...DEFAULT_DRAFT,
      metric_ids: [...DEFAULT_DRAFT.metric_ids],
      dimension_ids: [...DEFAULT_DRAFT.dimension_ids],
      allowed_relations: [...DEFAULT_DRAFT.allowed_relations],
      allowed_schemas: [...DEFAULT_DRAFT.allowed_schemas]
    },
    contract_id: null,
    last_run_id: null
  };
}

export function parseChatState(value: unknown): ChatState {
  const parsed = ChatStateSchema.safeParse(value);
  if (!parsed.success) {
    return createInitialChatState();
  }

  return {
    draft: {
      ...parsed.data.draft,
      metric_ids: [...parsed.data.draft.metric_ids],
      dimension_ids: [...parsed.data.draft.dimension_ids],
      allowed_relations: [...parsed.data.draft.allowed_relations],
      allowed_schemas: [...parsed.data.draft.allowed_schemas]
    },
    contract_id: parsed.data.contract_id,
    last_run_id: parsed.data.last_run_id
  };
}

export function createWebApiClient(options: CreateWebApiClientOptions): WebApiClient {
  const fetcher = options.fetch_impl ?? fetch;
  const baseUrl = options.base_url.replace(/\/+$/, "");

  return {
    async createContract(payload) {
      const response = await fetcher(`${baseUrl}/report-contracts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      return parseJsonResponse(response, ReportContractSchema);
    },
    async listContracts() {
      const response = await fetcher(`${baseUrl}/report-contracts`, {
        method: "GET"
      });

      return parseJsonResponse(response, z.array(ReportContractSchema));
    },
    async runContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });

      return parseJsonResponse(response, RunContractResponseSchema);
    }
  };
}

export async function handleChatTurn(input: {
  message: string;
  state: ChatState;
  api_client: WebApiClient;
}): Promise<ChatTurnResponse> {
  const rawMessage = input.message.trim();
  const command = rawMessage.toLowerCase();
  let nextState = parseChatState(input.state);

  if (command === "help" || command === "/help" || command === "?") {
    return { assistant_message: HELP_TEXT, state: nextState };
  }

  if (command === "preview" || command === "/preview") {
    return { assistant_message: renderPreview(nextState), state: nextState };
  }

  if (command === "list contracts" || command === "list") {
    const contracts = await input.api_client.listContracts();
    return {
      assistant_message: renderContractList(contracts),
      state: nextState
    };
  }

  if (command === "save") {
    const saved = await saveContract(nextState, input.api_client);
    return saved;
  }

  if (command === "run") {
    const runResult = await runContract(nextState, input.api_client);
    return runResult;
  }

  const setCommand = parseSetCommand(rawMessage);
  if (setCommand) {
    const applied = applySetCommand(nextState, setCommand.field, setCommand.value);
    if (!applied.updated) {
      return {
        assistant_message:
          "Unknown field for set command. Supported fields: name, audience, timezone, schedule, sql, metrics, dimensions, relations, schemas.",
        state: nextState
      };
    }

    nextState = applied.state;
    return {
      assistant_message: `Updated ${setCommand.field}.\n${renderDraftChecklist(nextState)}`,
      state: nextState
    };
  }

  const inferred = inferSimpleIntent(rawMessage, nextState);
  if (inferred) {
    return inferred;
  }

  return {
    assistant_message: `${COMMAND_HINT}\n\n${renderDraftChecklist(nextState)}`,
    state: nextState
  };
}

function parseSetCommand(raw: string): { field: string; value: string } | null {
  const match = raw.match(/^(?:\/?set\s+)?([a-z_ ]+)\s*[:=]\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    field: match[1].trim().toLowerCase().replace(/\s+/g, "_"),
    value: match[2].trim()
  };
}

function applySetCommand(state: ChatState, field: string, value: string): { state: ChatState; updated: boolean } {
  const next = parseChatState(state);

  switch (field) {
    case "name":
      next.draft.name = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "audience":
      next.draft.audience = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "timezone":
      next.draft.timezone = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "schedule":
    case "schedule_cron":
      next.draft.schedule_cron = value.toLowerCase() === "none" ? null : value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "sql":
    case "sql_template":
      next.draft.sql_template = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "metrics":
    case "metric_ids":
      next.draft.metric_ids = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    case "dimensions":
    case "dimension_ids":
      next.draft.dimension_ids = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    case "relations":
    case "allowed_relations":
      next.draft.allowed_relations = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    case "schemas":
    case "allowed_schemas":
      next.draft.allowed_schemas = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    default:
      return { state: next, updated: false };
  }
}

function parseCsv(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    )
  );
}

function inferSimpleIntent(message: string, state: ChatState): ChatTurnResponse | null {
  const lowered = message.toLowerCase();
  const nextState = parseChatState(state);

  if (lowered.includes("weekly") && nextState.draft.schedule_cron === null) {
    nextState.draft.schedule_cron = "0 18 * * 5";
    return {
      assistant_message:
        "Detected a weekly cadence. I set `schedule_cron` to `0 18 * * 5` (Friday 18:00).\nUse `set timezone: <IANA timezone>` if needed.",
      state: nextState
    };
  }

  if (lowered.includes("ceo") && nextState.draft.audience === "Executive") {
    nextState.draft.audience = "CEO";
    return {
      assistant_message: "Audience set to CEO. Continue with `set name: ...` and `preview`.",
      state: nextState
    };
  }

  if (lowered.startsWith("create ") || lowered.startsWith("new report")) {
    const guessedName = message.replace(/^(create|new report)\s*/i, "").trim();
    if (guessedName.length > 0) {
      nextState.draft.name = guessedName;
      nextState.contract_id = null;
      return {
        assistant_message: `Draft name set to "${guessedName}".\n${renderDraftChecklist(nextState)}`,
        state: nextState
      };
    }
  }

  return null;
}

async function saveContract(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const contract = buildContractPayload(state);
  const created = await apiClient.createContract(contract);
  const nextState = parseChatState(state);
  nextState.contract_id = created.id;

  return {
    assistant_message: `Saved contract: ${created.name}\nContract ID: ${created.id}\nUse "run" to execute now.`,
    state: nextState
  };
}

async function runContract(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  let nextState = parseChatState(state);
  let preface = "";

  if (!nextState.contract_id) {
    const saved = await saveContract(nextState, apiClient);
    nextState = saved.state;
    preface = `${saved.assistant_message}\n\n`;
  }

  if (!nextState.contract_id) {
    throw new Error("Contract save failed before run.");
  }

  const run = await apiClient.runContract(nextState.contract_id);
  nextState.last_run_id = run.run_id;

  return {
    assistant_message: `${preface}Run complete.\nRun ID: ${run.run_id}\n\n${renderExecBrief(run.exec_brief)}`,
    state: nextState
  };
}

function buildContractPayload(state: ChatState): ReportContractRecord {
  const draft = state.draft;
  const name = draft.name.trim();
  if (name.length === 0) {
    throw new Error("Set contract name first: set name: <value>");
  }

  const sql = draft.sql_template.trim();
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error("SQL must be SELECT-only. Update with: set sql: SELECT ...");
  }

  const allowedRelations = draft.allowed_relations.length > 0 ? draft.allowed_relations : ["analytics.sales"];
  const allowedSchemas = draft.allowed_schemas.length > 0 ? draft.allowed_schemas : deriveSchemas(allowedRelations);

  return ReportContractSchema.parse({
    id: state.contract_id ?? `contract_${randomUUID()}`,
    name,
    audience: draft.audience.trim().length > 0 ? draft.audience.trim() : "Executive",
    timezone: draft.timezone.trim().length > 0 ? draft.timezone.trim() : "UTC",
    schedule_cron: draft.schedule_cron,
    sql_template: sql,
    metric_ids: draft.metric_ids,
    dimension_ids: draft.dimension_ids,
    guardrails: {
      evidence_row_cap: 200,
      max_batches: 5,
      allowed_relations: allowedRelations,
      allowed_schemas: allowedSchemas,
      timeout_ms: DEFAULT_TIMEOUT_MS,
      deny_write: true
    }
  });
}

function deriveSchemas(relations: string[]): string[] {
  const schemas = relations
    .map((relation) => relation.split(".")[0]?.trim())
    .filter((value): value is string => Boolean(value));

  if (schemas.length === 0) {
    return ["analytics"];
  }

  return Array.from(new Set(schemas));
}

function renderPreview(state: ChatState): string {
  const draft = state.draft;
  const preview = {
    ...draft,
    contract_id: state.contract_id,
    last_run_id: state.last_run_id
  };

  return `Current draft\n${JSON.stringify(preview, null, 2)}\n\n${renderDraftChecklist(state)}`;
}

function renderDraftChecklist(state: ChatState): string {
  const missing: string[] = [];
  if (state.draft.name.trim().length === 0) {
    missing.push("name");
  }

  if (!/^\s*select\b/i.test(state.draft.sql_template)) {
    missing.push("sql_template (must start with SELECT)");
  }

  if (missing.length === 0) {
    return state.contract_id
      ? "Draft is valid and saved. You can run now."
      : 'Draft is valid. Use "save" to persist or "run" to save and execute.';
  }

  return `Missing or invalid fields: ${missing.join(", ")}.`;
}

function renderContractList(contracts: ReportContractRecord[]): string {
  if (contracts.length === 0) {
    return "No contracts found yet.";
  }

  const lines = contracts.slice(0, 12).map((contract) => {
    const schedule = contract.schedule_cron ?? "manual";
    return `- ${contract.name} (${contract.id}) | ${contract.timezone} | ${schedule}`;
  });

  return `Contracts\n${lines.join("\n")}`;
}

function renderExecBrief(execBrief: ExecBriefRecord): string {
  const section = (title: string, values: string[]) =>
    `${title}: ${values.length > 0 ? values.join(" | ") : "No insights."}`;

  return [
    section("What changed", execBrief.what_changed),
    section("Why", execBrief.why),
    section("So what", execBrief.so_what),
    section("What to do", execBrief.what_to_do),
    `Confidence score: ${execBrief.confidence.score.toFixed(2)}`,
    `Confidence rationale: ${execBrief.confidence.rationale}`,
    section("Deltas vs last run", execBrief.deltas_vs_last_run),
    `Appendix refs: ${execBrief.appendix_refs.join(", ")}`
  ].join("\n");
}

async function parseJsonResponse<TSchema extends z.ZodTypeAny>(
  response: Response,
  schema: TSchema
): Promise<z.output<TSchema>> {
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return schema.parse(payload);
}
