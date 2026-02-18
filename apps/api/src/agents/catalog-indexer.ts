import { createHash, randomUUID } from "node:crypto";

export type CatalogColumnProfile = {
  column_name: string;
  data_type: string;
};

export type LowCardinalityColumn = {
  column_name: string;
  distinct_values: string[];
};

export type CatalogTableIndexInput = {
  business_id: string;
  qualified_name: string;
  columns: CatalogColumnProfile[];
  sample_rows: Record<string, unknown>[];
  low_cardinality_columns: LowCardinalityColumn[];
};

export type CatalogTableIndexOutput = {
  table_id: string;
  summary: string;
};

export function generateBusinessId(): string {
  const compact = randomUUID().replace(/-/g, "");
  return `biz_${compact.slice(0, 16)}`;
}

export function generateTableId(businessId: string, qualifiedName: string): string {
  const hash = createHash("sha256")
    .update(`${businessId}:${qualifiedName.toLowerCase()}`)
    .digest("hex");
  return `tbl_${hash.slice(0, 16)}`;
}

export function catalogAgentIndexTable(input: CatalogTableIndexInput): CatalogTableIndexOutput {
  return {
    table_id: generateTableId(input.business_id, input.qualified_name),
    summary: summarizeTableFromSample(input)
  };
}

function summarizeTableFromSample(input: CatalogTableIndexInput): string {
  const [, rawTableName = input.qualified_name] = input.qualified_name.split(".", 2);
  const tableLabel = humanizeIdentifier(rawTableName);
  const sampleSize = input.sample_rows.length;
  const descriptor = sampleSize > 0
    ? `based on ${sampleSize} sampled row${sampleSize === 1 ? "" : "s"}`
    : "based on schema-level metadata";

  const keyColumns = input.columns
    .map((column) => column.column_name)
    .filter((name) => /(id|name|status|type|category|segment|region|country|date|time|amount|total|price|count)/i.test(name))
    .slice(0, 6);

  const example = extractSampleExample(input.sample_rows);
  const lowCard = input.low_cardinality_columns
    .slice(0, 3)
    .map((entry) => `${entry.column_name}=${entry.distinct_values.slice(0, 4).join("|")}`)
    .join("; ");

  const lines: string[] = [
    `${input.qualified_name} appears to store ${tableLabel} data (${descriptor}).`
  ];

  if (keyColumns.length > 0) {
    lines.push(`Likely key fields: ${keyColumns.join(", ")}.`);
  }

  if (example.length > 0) {
    lines.push(`Sample signal: ${example}.`);
  }

  if (lowCard.length > 0) {
    lines.push(`Low-cardinality dimensions include ${lowCard}.`);
  }

  return lines.join(" ");
}

function extractSampleExample(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const first = rows[0];
  const parts: string[] = [];
  for (const [key, value] of Object.entries(first)) {
    if (parts.length >= 4) {
      break;
    }
    if (value === null || value === undefined) {
      continue;
    }
    const normalized = normalizeSampleValue(value);
    if (normalized.length === 0) {
      continue;
    }
    parts.push(`${key}=${normalized}`);
  }

  return parts.join(", ");
}

function normalizeSampleValue(value: unknown): string {
  if (typeof value === "string") {
    return truncate(value, 40);
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return "";
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  const clean = value.trim();
  if (clean.length <= max) {
    return clean;
  }
  return `${clean.slice(0, max - 3)}...`;
}
