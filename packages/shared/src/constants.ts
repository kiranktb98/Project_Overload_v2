export const EVIDENCE_ROW_CAP = 200;
export const MAX_BATCHES = 5;

export const DEFAULT_PII_FIELDS = [
  "email",
  "customer_email",
  "phone",
  "phone_number",
  "ssn",
  "social_security",
  "credit_card",
  "card_number",
  "address",
  "date_of_birth",
  "dob",
  "ip_address",
  "password",
  "secret"
];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };