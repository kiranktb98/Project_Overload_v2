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
  const normalizedSql = sql;
  const cteNames = extractCteNames(normalizedSql);
  const relationNames = new Set<string>();

  const keywordRegex = /\b(from|join)\b/gi;
  let match: RegExpExecArray | null = keywordRegex.exec(normalizedSql);

  while (match) {
    let cursor = skipWhitespace(normalizedSql, keywordRegex.lastIndex);

    if (normalizedSql.slice(cursor, cursor + 4).toLowerCase() === "only") {
      cursor = skipWhitespace(normalizedSql, cursor + 4);
    }

    if (normalizedSql[cursor] === "(") {
      match = keywordRegex.exec(normalizedSql);
      continue;
    }

    const parsed = parseQualifiedIdentifier(normalizedSql, cursor);
    if (!parsed) {
      match = keywordRegex.exec(normalizedSql);
      continue;
    }

    const normalizedRelation = parsed.parts.join(".").toLowerCase();
    const nextNonSpace = skipWhitespace(normalizedSql, parsed.nextIndex);
    const looksLikeFunctionCall = normalizedSql[nextNonSpace] === "(";
    const isCteAlias = parsed.parts.length === 1 && cteNames.has(normalizedRelation);

    if (!looksLikeFunctionCall && !isCteAlias) {
      relationNames.add(normalizedRelation);
    }

    match = keywordRegex.exec(normalizedSql);
  }

  return Array.from(relationNames);
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

type ParsedIdentifier = {
  value: string;
  nextIndex: number;
};

type ParsedQualifiedIdentifier = {
  parts: string[];
  nextIndex: number;
};

function extractCteNames(sql: string): Set<string> {
  const cteNames = new Set<string>();
  let cursor = skipWhitespace(sql, 0);

  if (sql.slice(cursor, cursor + 4).toLowerCase() !== "with") {
    return cteNames;
  }
  cursor = skipWhitespace(sql, cursor + 4);

  if (sql.slice(cursor, cursor + 9).toLowerCase() === "recursive") {
    cursor = skipWhitespace(sql, cursor + 9);
  }

  while (cursor < sql.length) {
    const cteIdentifier = parseIdentifier(sql, cursor);
    if (!cteIdentifier) {
      break;
    }

    cteNames.add(cteIdentifier.value.toLowerCase());
    cursor = skipWhitespace(sql, cteIdentifier.nextIndex);

    if (sql[cursor] === "(") {
      const colListEnd = skipBalancedParentheses(sql, cursor);
      if (colListEnd === -1) {
        break;
      }
      cursor = skipWhitespace(sql, colListEnd + 1);
    }

    if (sql.slice(cursor, cursor + 2).toLowerCase() === "as") {
      cursor = skipWhitespace(sql, cursor + 2);
    }

    if (sql[cursor] !== "(") {
      break;
    }

    const bodyEnd = skipBalancedParentheses(sql, cursor);
    if (bodyEnd === -1) {
      break;
    }
    cursor = skipWhitespace(sql, bodyEnd + 1);

    if (sql[cursor] !== ",") {
      break;
    }

    cursor = skipWhitespace(sql, cursor + 1);
  }

  return cteNames;
}

function parseQualifiedIdentifier(sql: string, startIndex: number): ParsedQualifiedIdentifier | null {
  const first = parseIdentifier(sql, startIndex);
  if (!first) {
    return null;
  }

  const parts = [first.value];
  let cursor = first.nextIndex;

  while (cursor < sql.length) {
    cursor = skipWhitespace(sql, cursor);
    if (sql[cursor] !== ".") {
      break;
    }

    cursor = skipWhitespace(sql, cursor + 1);
    const nextPart = parseIdentifier(sql, cursor);
    if (!nextPart) {
      break;
    }

    parts.push(nextPart.value);
    cursor = nextPart.nextIndex;
  }

  return { parts: normalizeRelationParts(parts), nextIndex: cursor };
}

function parseIdentifier(sql: string, startIndex: number): ParsedIdentifier | null {
  const cursor = skipWhitespace(sql, startIndex);
  const first = sql[cursor];

  if (!first) {
    return null;
  }

  if (first === "\"") {
    let index = cursor + 1;
    let value = "";

    while (index < sql.length) {
      const current = sql[index];
      if (current === "\"") {
        if (sql[index + 1] === "\"") {
          value += "\"";
          index += 2;
          continue;
        }

        return { value, nextIndex: index + 1 };
      }

      value += current;
      index += 1;
    }

    return null;
  }

  if (first === "`") {
    let index = cursor + 1;
    let value = "";

    while (index < sql.length) {
      const current = sql[index];
      if (current === "`") {
        return { value, nextIndex: index + 1 };
      }

      value += current;
      index += 1;
    }

    return null;
  }

  if (!/[A-Za-z_]/.test(first)) {
    return null;
  }

  let index = cursor + 1;
  while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index]!)) {
    index += 1;
  }

  return { value: sql.slice(cursor, index), nextIndex: index };
}

function normalizeRelationParts(parts: string[]): string[] {
  if (parts.length === 1 && parts[0]?.includes(".")) {
    const inlineParts = parts[0]
      .split(".")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (inlineParts.length >= 2) {
      return inlineParts.slice(-2);
    }
  }

  if (parts.length >= 3) {
    return parts.slice(-2);
  }

  return parts;
}

function skipWhitespace(sql: string, index: number): number {
  let cursor = index;
  while (cursor < sql.length && /\s/.test(sql[cursor]!)) {
    cursor += 1;
  }
  return cursor;
}

function skipBalancedParentheses(sql: string, openIndex: number): number {
  if (sql[openIndex] !== "(") {
    return -1;
  }

  let depth = 0;
  let index = openIndex;

  while (index < sql.length) {
    const char = sql[index]!;

    if (char === "'") {
      index = skipSingleQuotedString(sql, index);
      continue;
    }

    if (char === "\"") {
      index = skipDoubleQuotedIdentifier(sql, index);
      continue;
    }

    if (char === "(") {
      depth += 1;
      index += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
      index += 1;
      continue;
    }

    index += 1;
  }

  return -1;
}

function skipSingleQuotedString(sql: string, quoteIndex: number): number {
  let index = quoteIndex + 1;
  while (index < sql.length) {
    if (sql[index] === "'") {
      if (sql[index + 1] === "'") {
        index += 2;
        continue;
      }

      return index + 1;
    }
    index += 1;
  }

  return sql.length;
}

function skipDoubleQuotedIdentifier(sql: string, quoteIndex: number): number {
  let index = quoteIndex + 1;
  while (index < sql.length) {
    if (sql[index] === "\"") {
      if (sql[index + 1] === "\"") {
        index += 2;
        continue;
      }

      return index + 1;
    }
    index += 1;
  }

  return sql.length;
}
