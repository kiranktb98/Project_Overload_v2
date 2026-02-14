export const EVIDENCE_ROW_CAP = 200;
export const MAX_BATCHES = 5;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };