import { analyzeBatch as analyzeBatchStub } from "@project-overload/evidence";
import {
  AnalystInputSchema,
  BatchAnalysisSchema,
  QueryStrategyOutputSchema,
  type AnalystInput,
  type BatchAnalysis,
  type QueryStrategyInput,
  type QueryStrategyOutput
} from "@project-overload/shared";

export type LlmProvider = "stub" | "openai" | "openrouter";

export interface AnalystClient {
  provider: LlmProvider;
  analyzeBatch(input: AnalystInput): Promise<BatchAnalysis>;
}

export interface QueryStrategistClient {
  provider: LlmProvider;
  planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput>;
}

export type ReportComposerInput = {
  title: string;
  audience: string;
  insight_mode: "business" | "data";
  analyses: Array<{
    question: string;
    highlights: string[];
    risks: string[];
    recommendations: string[];
    data_summary: string;
  }>;
  catalog_summary: string;
};

export interface ReportComposerClient {
  provider: LlmProvider;
  composeReport(input: ReportComposerInput): Promise<string>;
}

export type Fetcher = typeof fetch;

export type CreateAnalystClientOptions = {
  provider: LlmProvider;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
  openrouterAppName?: string;
  openrouterAppUrl?: string;
  openaiModel?: string;
  openrouterModel?: string;
  timeoutMs?: number;
  fallbackToStub?: boolean;
  fetcher?: Fetcher;
};

type ProviderRequest = {
  endpoint: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// ---------------------------------------------------------------------------
// Analyst Client
// ---------------------------------------------------------------------------

export function createStubAnalystClient(): AnalystClient {
  return {
    provider: "stub",
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      return analyzeBatchStub(input);
    }
  };
}

export function createAnalystClientFromEnv(overrides: Partial<CreateAnalystClientOptions> = {}): AnalystClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);

  if (provider === "stub") {
    return createStubAnalystClient();
  }

  const timeoutFromEnv = Number.parseInt(
    process.env.LLM_TIMEOUT_MS ?? process.env.DEFAULT_QUERY_TIMEOUT_MS ?? "",
    10
  );

  const options: CreateAnalystClientOptions = {
    provider,
    openaiApiKey: overrides.openaiApiKey ?? process.env.OPENAI_API_KEY,
    openrouterApiKey: overrides.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
    openrouterBaseUrl: overrides.openrouterBaseUrl ?? process.env.OPENROUTER_BASE_URL,
    openrouterAppName: overrides.openrouterAppName ?? process.env.OPENROUTER_APP_NAME,
    openrouterAppUrl: overrides.openrouterAppUrl ?? process.env.OPENROUTER_APP_URL,
    openaiModel: overrides.openaiModel ?? process.env.OPENAI_MODEL,
    openrouterModel: overrides.openrouterModel ?? process.env.MODEL_GPT,
    timeoutMs: overrides.timeoutMs ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fallbackToStub: overrides.fallbackToStub,
    fetcher: overrides.fetcher
  };

  return createAnalystClient(options);
}

export function createAnalystClient(options: CreateAnalystClientOptions): AnalystClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubAnalystClient();

  if (options.provider === "openai") {
    if (!options.openaiApiKey) {
      return stub;
    }

    const remote = createRemoteAnalystClient({
      provider: "openai",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenAiAnalystRequest(input, options)
    });

    return fallbackToStub ? wrapAnalystWithFallback(remote, stub) : remote;
  }

  if (options.provider === "openrouter") {
    if (!options.openrouterApiKey) {
      return stub;
    }

    const remote = createRemoteAnalystClient({
      provider: "openrouter",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenRouterAnalystRequest(input, options)
    });

    return fallbackToStub ? wrapAnalystWithFallback(remote, stub) : remote;
  }

  return stub;
}

type RemoteAnalystClientOptions = {
  provider: Exclude<LlmProvider, "stub">;
  timeoutMs: number;
  fetcher: Fetcher;
  requestFactory: (input: AnalystInput) => ProviderRequest;
};

function createRemoteAnalystClient(options: RemoteAnalystClientOptions): AnalystClient {
  return {
    provider: options.provider,
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      const validatedInput = AnalystInputSchema.parse(input);
      const request = options.requestFactory(validatedInput);

      const response = await fetchWithTimeout(
        options.fetcher,
        request.endpoint,
        {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.payload)
        },
        options.timeoutMs
      );

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`${options.provider} request failed (${response.status}): ${responseText}`);
      }

      const payload = (await response.json()) as unknown;
      return parseBatchAnalysisPayload(payload);
    }
  };
}

function wrapAnalystWithFallback(remote: AnalystClient, fallback: AnalystClient): AnalystClient {
  return {
    provider: remote.provider,
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      try {
        return await remote.analyzeBatch(input);
      } catch {
        return fallback.analyzeBatch(input);
      }
    }
  };
}

function parseBatchAnalysisPayload(payload: unknown): BatchAnalysis {
  const direct = BatchAnalysisSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const textPayload = extractTextPayload(payload);
  if (!textPayload) {
    throw new Error("Unable to parse provider response as BatchAnalysis JSON.");
  }

  const parsedTextPayload = parseJsonObjectFromText(textPayload);
  return BatchAnalysisSchema.parse(parsedTextPayload);
}

// ---------------------------------------------------------------------------
// Query Strategist Client
// ---------------------------------------------------------------------------

export function createStubQueryStrategistClient(): QueryStrategistClient {
  return {
    provider: "stub",
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      const tables = input.allowed_relations.length > 0
        ? input.allowed_relations
        : ["public.unknown_table"];
      const mainTable = tables[0];

      if (input.insight_mode === "data") {
        return {
          queries: [
            {
              question: "What is the data quality and completeness?",
              sql: `SELECT * FROM ${mainTable} LIMIT 200`,
              purpose: "Assess data completeness, null rates, and value distributions"
            }
          ]
        };
      }

      const queries: QueryStrategyOutput["queries"] = [];

      if (input.metric_ids.length > 0) {
        queries.push({
          question: `What are the key trends for ${input.metric_ids.join(", ")}?`,
          sql: `SELECT * FROM ${mainTable} LIMIT 200`,
          purpose: "Identify primary metric trends and patterns"
        });
      }

      if (input.dimension_ids.length > 0) {
        queries.push({
          question: `How do metrics break down by ${input.dimension_ids.join(", ")}?`,
          sql: `SELECT * FROM ${mainTable} LIMIT 200`,
          purpose: "Analyze dimensional breakdown"
        });
      }

      if (queries.length === 0) {
        queries.push({
          question: "What are the key business insights from this data?",
          sql: `SELECT * FROM ${mainTable} LIMIT 200`,
          purpose: "General business overview"
        });
      }

      return { queries };
    }
  };
}

export function createQueryStrategistClientFromEnv(
  overrides: Partial<CreateAnalystClientOptions> = {}
): QueryStrategistClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  if (provider === "stub") {
    return createStubQueryStrategistClient();
  }

  const options = resolveClientOptions(overrides);
  return createQueryStrategistClient(options);
}

export function createQueryStrategistClient(options: CreateAnalystClientOptions): QueryStrategistClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2; // double timeout for query planning
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubQueryStrategistClient();

  const buildRequest = (input: QueryStrategyInput): ProviderRequest => {
    return buildOpenRouterGenericRequest(
      queryStrategistSystemPrompt(input),
      queryStrategistUserPrompt(input),
      options
    );
  };

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    return stub;
  }

  const remote: QueryStrategistClient = {
    provider: "openrouter",
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      const request = buildRequest(input);
      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Query strategist failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text) throw new Error("Unable to parse query strategist response.");
      const parsed = parseJsonObjectFromText(text);
      return QueryStrategyOutputSchema.parse(parsed);
    }
  };

  return fallbackToStub ? wrapStrategistWithFallback(remote, stub) : remote;
}

function wrapStrategistWithFallback(
  remote: QueryStrategistClient,
  fallback: QueryStrategistClient
): QueryStrategistClient {
  return {
    provider: remote.provider,
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      try {
        return await remote.planQueries(input);
      } catch {
        return fallback.planQueries(input);
      }
    }
  };
}

function queryStrategistSystemPrompt(input: QueryStrategyInput): string {
  const mode = input.insight_mode === "data"
    ? "DATA QUALITY mode: Write queries to assess data completeness, null rates, duplicate rates, value distributions, outliers, and anomalies. Help the user understand if their data is trustworthy and what needs fixing."
    : "BUSINESS INSIGHTS mode: Write queries that produce aggregated, summarized data for business analysis. Use GROUP BY, SUM, COUNT, AVG, JOINs across tables. The data is trustworthy — focus on trends, comparisons, breakdowns by dimension, and actionable patterns.";

  return [
    "You are a SQL query strategist for a PostgreSQL database.",
    "Your job is to generate 2-4 focused SQL queries, each answering ONE specific question about the data.",
    "",
    `MODE: ${mode}`,
    "",
    "RULES:",
    "- Each query MUST be a valid PostgreSQL SELECT statement.",
    "- Use only the tables and columns from the catalog provided.",
    "- Each query should return at most 200 rows. Use GROUP BY, aggregations, and LIMIT to keep results manageable.",
    "- Write queries that produce SUMMARIZED data (aggregates, distributions, top-N), not raw row dumps.",
    "- Each query answers a DIFFERENT question — don't repeat the same analysis.",
    "- Use JOINs across tables when it adds insight.",
    "- For business mode: focus on metrics, trends, dimensional breakdowns.",
    "- For data mode: focus on NULL counts, distinct value counts, distribution checks, outlier detection.",
    "",
    "Return strictly valid JSON matching this shape:",
    '{"queries": [{"question": "...", "sql": "...", "purpose": "..."}]}',
    "No markdown, no extra keys."
  ].join("\n");
}

function queryStrategistUserPrompt(input: QueryStrategyInput): string {
  const parts = [
    `Report goal: ${input.report_goal}`,
    `Audience: ${input.audience}`,
    `Insight mode: ${input.insight_mode}`
  ];

  if (input.metric_ids.length > 0) {
    parts.push(`Key metrics: ${input.metric_ids.join(", ")}`);
  }
  if (input.dimension_ids.length > 0) {
    parts.push(`Dimensions to analyze: ${input.dimension_ids.join(", ")}`);
  }
  if (input.allowed_relations.length > 0) {
    parts.push(`Available tables: ${input.allowed_relations.join(", ")}`);
  }

  parts.push("", "DATABASE CATALOG:", input.catalog_summary);
  parts.push("", "Generate targeted SQL queries. Return JSON only.");

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Report Composer Client
// ---------------------------------------------------------------------------

export function createStubReportComposerClient(): ReportComposerClient {
  return {
    provider: "stub",
    async composeReport(input: ReportComposerInput): Promise<string> {
      return renderStubReportHtml(input);
    }
  };
}

export function createReportComposerClientFromEnv(
  overrides: Partial<CreateAnalystClientOptions> = {}
): ReportComposerClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  if (provider === "stub") {
    return createStubReportComposerClient();
  }

  const options = resolveClientOptions(overrides);
  return createReportComposerClient(options);
}

export function createReportComposerClient(options: CreateAnalystClientOptions): ReportComposerClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2;
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubReportComposerClient();

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    return stub;
  }

  const remote: ReportComposerClient = {
    provider: "openrouter",
    async composeReport(input: ReportComposerInput): Promise<string> {
      const request = buildOpenRouterGenericRequest(
        reportComposerSystemPrompt(input),
        reportComposerUserPrompt(input),
        options
      );

      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Report composer failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text) throw new Error("Unable to parse report composer response.");

      // The LLM returns HTML — extract it if wrapped in markdown code fences
      return extractHtmlFromResponse(text);
    }
  };

  return fallbackToStub ? wrapComposerWithFallback(remote, stub) : remote;
}

function wrapComposerWithFallback(
  remote: ReportComposerClient,
  fallback: ReportComposerClient
): ReportComposerClient {
  return {
    provider: remote.provider,
    async composeReport(input: ReportComposerInput): Promise<string> {
      try {
        return await remote.composeReport(input);
      } catch {
        return fallback.composeReport(input);
      }
    }
  };
}

function reportComposerSystemPrompt(input: ReportComposerInput): string {
  const modeGuidance = input.insight_mode === "data"
    ? "This is a DATA QUALITY report. Focus on data issues, completeness, anomalies, and recommendations for fixing them. Use tables showing null rates, distribution charts, and data quality scores."
    : "This is a BUSINESS INSIGHTS report. Focus on trends, opportunities, risks, and actionable recommendations. Use charts for trends, tables for breakdowns, and clear executive-friendly language.";

  return [
    "You are an expert report designer. Generate a complete, self-contained HTML document for a professional executive report.",
    "",
    modeGuidance,
    "",
    "DESIGN RULES:",
    "- Return a COMPLETE HTML document with <!doctype html>, <head> with embedded CSS, and <body>.",
    "- Use a clean, modern design with a professional color scheme.",
    "- Include inline SVG charts where data supports it (bar charts, simple line charts, pie charts).",
    "- Use HTML tables with good styling for data breakdowns.",
    "- Make it visually appealing — use cards, subtle borders, clean typography.",
    "- Each analysis section should have a clear heading, key finding callout, and supporting data.",
    "- Include a summary section at the top with the most important 2-3 takeaways.",
    "- End with a clear 'Recommended Actions' section.",
    "- Use the Sora or system font stack for clean rendering.",
    "- The report must be printable and look good as a PDF.",
    "- Do NOT use any external dependencies (no CDN links, no JavaScript).",
    "- Return ONLY the HTML document, no markdown fences or explanations."
  ].join("\n");
}

function reportComposerUserPrompt(input: ReportComposerInput): string {
  const sections = input.analyses.map((a, i) => [
    `--- Analysis ${i + 1}: ${a.question} ---`,
    `Key findings: ${a.highlights.join("; ") || "None"}`,
    `Risks: ${a.risks.join("; ") || "None"}`,
    `Recommendations: ${a.recommendations.join("; ") || "None"}`,
    `Data summary: ${a.data_summary}`
  ].join("\n")).join("\n\n");

  return [
    `Report title: ${input.title}`,
    `Audience: ${input.audience}`,
    `Report type: ${input.insight_mode === "data" ? "Data Quality Assessment" : "Business Insights Report"}`,
    "",
    "ANALYSIS RESULTS:",
    sections,
    "",
    "Generate the complete HTML report document."
  ].join("\n");
}

function renderStubReportHtml(input: ReportComposerInput): string {
  const analysisHtml = input.analyses.map((a) => {
    const highlights = a.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("");
    const risks = a.risks.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    const recs = a.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    return `
    <section class="analysis-card">
      <h2>${escapeHtml(a.question)}</h2>
      ${highlights.length > 0 ? `<h3>Key Findings</h3><ul>${highlights}</ul>` : ""}
      ${risks.length > 0 ? `<h3>Risks</h3><ul>${risks}</ul>` : ""}
      ${recs.length > 0 ? `<h3>Recommendations</h3><ul>${recs}</ul>` : ""}
      <p class="data-note">${escapeHtml(a.data_summary)}</p>
    </section>`;
  }).join("\n");

  const typeLabel = input.insight_mode === "data" ? "Data Quality Assessment" : "Business Insights Report";

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(input.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#1f2937;background:#f8fafc}
  .header{text-align:center;margin-bottom:32px;padding:24px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;border-radius:12px}
  .header h1{margin:0 0 4px;font-size:1.5rem}
  .header p{margin:0;opacity:0.85;font-size:0.9rem}
  .analysis-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:16px}
  .analysis-card h2{margin:0 0 12px;font-size:1.1rem;color:#0f172a}
  .analysis-card h3{margin:14px 0 6px;font-size:0.9rem;color:#475569}
  .analysis-card ul{padding-left:18px;margin:4px 0}
  .analysis-card li{margin-bottom:4px;font-size:0.88rem;line-height:1.5}
  .data-note{font-size:0.8rem;color:#64748b;margin-top:12px;padding:8px;background:#f1f5f9;border-radius:6px}
</style></head><body>
  <div class="header">
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(typeLabel)} | ${escapeHtml(input.audience)} audience</p>
  </div>
  ${analysisHtml}
</body></html>`;
}

function extractHtmlFromResponse(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // If it starts with <!doctype or <html, it's raw HTML
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) return trimmed;

  return trimmed;
}

// ---------------------------------------------------------------------------
// Analyst Prompts (insight-mode-aware)
// ---------------------------------------------------------------------------

function analystSystemPrompt(input: AnalystInput): string {
  const questionContext = input.question
    ? `Focus your analysis on answering this specific question: "${input.question}"`
    : "Provide a general analysis of the data.";

  const modeGuidance = input.insight_mode === "data"
    ? "This is a DATA QUALITY analysis. Focus on: null values, missing data, inconsistencies, suspicious patterns, data type issues, outliers, and recommendations for data cleanup. Treat the data critically."
    : "This is a BUSINESS analysis. The data is trustworthy. Focus on: trends, comparisons, notable changes, business implications, and actionable recommendations. Think like a business analyst presenting to the audience.";

  return [
    "You are a data analyst. Analyze the provided dataset and return structured findings.",
    "",
    modeGuidance,
    questionContext,
    "",
    "Return strictly valid JSON matching this shape:",
    '{"request_id": "...", "batch_index": 0, "total_batches": 1, "highlights": ["..."], "risks": ["..."], "recommendations": ["..."], "confidence_score": 0.85, "appendix_refs": ["..."]}',
    "",
    "- highlights: The most important findings (3-5 items).",
    "- risks: Issues, concerns, or negative trends (1-3 items).",
    "- recommendations: Specific actionable next steps (2-4 items).",
    "- confidence_score: 0.0-1.0 based on data quality and coverage.",
    "No markdown, no extra keys."
  ].join("\n");
}

function analystUserPrompt(input: AnalystInput): string {
  const packet = input.evidence_packet;
  const rowPreview = packet.rows.slice(0, 10)
    .map((r) => JSON.stringify(r)).join("\n");
  const allColumns = packet.rows.length > 0 ? Object.keys(packet.rows[0]) : [];

  const parts = [
    `request_id: ${input.request_id}`,
    `batch_index: ${input.batch_index}`,
    `total_batches: ${input.total_batches}`,
    `row_count: ${packet.row_count}`,
    `columns: ${allColumns.join(", ")}`,
    `word_budget: ${input.summary_word_budget}`
  ];

  if (input.question) {
    parts.push(`question: ${input.question}`);
  }

  parts.push("", "Sample rows (first 10):", rowPreview);

  if (packet.row_count > 10) {
    parts.push(`... and ${packet.row_count - 10} more rows.`);
  }

  parts.push("", "Analyze and return JSON only.");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Shared Request Builders
// ---------------------------------------------------------------------------

function buildOpenAiAnalystRequest(input: AnalystInput, options: CreateAnalystClientOptions): ProviderRequest {
  return {
    endpoint: "https://api.openai.com/v1/responses",
    headers: {
      Authorization: `Bearer ${options.openaiApiKey}`,
      "content-type": "application/json"
    },
    payload: {
      model: options.openaiModel ?? DEFAULT_OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "text", text: analystSystemPrompt(input) }] },
        { role: "user", content: [{ type: "text", text: analystUserPrompt(input) }] }
      ],
      temperature: 0
    }
  };
}

function buildOpenRouterAnalystRequest(input: AnalystInput, options: CreateAnalystClientOptions): ProviderRequest {
  return buildOpenRouterGenericRequest(
    analystSystemPrompt(input),
    analystUserPrompt(input),
    options
  );
}

function buildOpenRouterGenericRequest(
  systemPrompt: string,
  userPrompt: string,
  options: CreateAnalystClientOptions
): ProviderRequest {
  const baseUrl = (options.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.openrouterApiKey}`,
    "content-type": "application/json"
  };

  if (options.openrouterAppName) {
    headers["X-Title"] = options.openrouterAppName;
  }

  if (options.openrouterAppUrl) {
    headers["HTTP-Referer"] = options.openrouterAppUrl;
  }

  return {
    endpoint: `${baseUrl}/chat/completions`,
    headers,
    payload: {
      model: options.openrouterModel ?? DEFAULT_OPENROUTER_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }
  };
}

function resolveClientOptions(overrides: Partial<CreateAnalystClientOptions>): CreateAnalystClientOptions {
  const timeoutFromEnv = Number.parseInt(
    process.env.LLM_TIMEOUT_MS ?? process.env.DEFAULT_QUERY_TIMEOUT_MS ?? "",
    10
  );

  return {
    provider: parseProvider(overrides.provider ?? process.env.LLM_PROVIDER),
    openaiApiKey: overrides.openaiApiKey ?? process.env.OPENAI_API_KEY,
    openrouterApiKey: overrides.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
    openrouterBaseUrl: overrides.openrouterBaseUrl ?? process.env.OPENROUTER_BASE_URL,
    openrouterAppName: overrides.openrouterAppName ?? process.env.OPENROUTER_APP_NAME,
    openrouterAppUrl: overrides.openrouterAppUrl ?? process.env.OPENROUTER_APP_URL,
    openaiModel: overrides.openaiModel ?? process.env.OPENAI_MODEL,
    openrouterModel: overrides.openrouterModel ?? process.env.MODEL_GPT,
    timeoutMs: overrides.timeoutMs ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fallbackToStub: overrides.fallbackToStub,
    fetcher: overrides.fetcher
  };
}

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------

function extractTextPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];

    if (isRecord(first)) {
      const message = first.message;
      if (isRecord(message)) {
        const content = message.content;
        if (typeof content === "string") {
          return content;
        }

        if (Array.isArray(content)) {
          const textChunks = content
            .map((entry) => {
              if (!isRecord(entry)) return null;
              if (typeof entry.text === "string") return entry.text;
              return null;
            })
            .filter((value): value is string => value !== null);

          if (textChunks.length > 0) {
            return textChunks.join("\n");
          }
        }
      }
    }
  }

  return null;
}

function parseJsonObjectFromText(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const extracted = extractFirstJsonObject(trimmed);
    if (!extracted) {
      throw new Error("Provider text response did not contain a valid JSON object.");
    }

    return JSON.parse(extracted) as Record<string, unknown>;
  }
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseProvider(rawProvider: string | LlmProvider | undefined): LlmProvider {
  if (!rawProvider) {
    return "stub";
  }

  const normalized = String(rawProvider).toLowerCase();

  if (normalized === "openai") {
    return "openai";
  }

  if (normalized === "openrouter") {
    return "openrouter";
  }

  return "stub";
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
