export const EVIDENCE_ROW_CAP = 200;
export const MAX_BATCHES = 5;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];