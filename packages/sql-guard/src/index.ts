export class SqlGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqlGuardError";
  }
}

const WRITE_KEYWORDS = /\b(insert|update|delete|merge|upsert|create|drop|alter|truncate|grant|revoke|comment|copy|call|vacuum|analyze|refresh)\b/i;
const SELECT_START = /^\s*(select|with)\b/i;

export function assertSelectOnly(sql: string): void {
  if (!sql || !sql.trim()) {
    throw new SqlGuardError("SQL cannot be empty.");
  }

  if (!SELECT_START.test(sql)) {
    throw new SqlGuardError("Only SELECT or WITH queries are allowed.");
  }

  if (WRITE_KEYWORDS.test(sql)) {
    throw new SqlGuardError("Write or DDL SQL is not allowed.");
  }

  if (sql.includes(";")) {
    throw new SqlGuardError("Multiple SQL statements are not allowed.");
  }
}

export function ensureLimit(sql: string, limit: number): string {
  if (limit <= 0) {
    throw new SqlGuardError("Limit must be greater than zero.");
  }

  assertSelectOnly(sql);

  const existingLimit = /\blimit\s+(\d+)\b(?![\s\S]*\blimit\b)/i;
  const match = sql.match(existingLimit);

  if (!match) {
    return `${sql.trim()} LIMIT ${limit}`;
  }

  const currentLimit = Number.parseInt(match[1], 10);
  if (Number.isNaN(currentLimit) || currentLimit > limit) {
    return sql.replace(existingLimit, `LIMIT ${limit}`);
  }

  return sql;
}

export function extractReferencedRelations(sql: string): string[] {
  assertSelectOnly(sql);

  const relationRegex = /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
  const relations = new Set<string>();
  let match: RegExpExecArray | null = relationRegex.exec(sql);

  while (match) {
    relations.add(match[1].toLowerCase());
    match = relationRegex.exec(sql);
  }

  return Array.from(relations);
}

export function assertAllowlistedRelations(sql: string, allowlist: string[]): void {
  const normalizedAllowlist = new Set(allowlist.map((entry) => entry.toLowerCase()));
  const relations = extractReferencedRelations(sql);

  const blocked = relations.filter((relation) => !normalizedAllowlist.has(relation));
  if (blocked.length > 0) {
    throw new SqlGuardError(`Relations are not allowlisted: ${blocked.join(", ")}`);
  }
}

export function assertAllowlistedSchemas(sql: string, allowlistedSchemas: string[]): void {
  const normalized = new Set(allowlistedSchemas.map((schema) => schema.toLowerCase()));
  const blockedSchemas = extractReferencedRelations(sql)
    .map((relation) => relation.split(".")[0])
    .filter((schema) => !normalized.has(schema));

  if (blockedSchemas.length > 0) {
    throw new SqlGuardError(`Schemas are not allowlisted: ${Array.from(new Set(blockedSchemas)).join(", ")}`);
  }
}