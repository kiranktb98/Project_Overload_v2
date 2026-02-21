import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string, salt?: string): Promise<{ salt: string; hash: string }> {
  const resolvedSalt = salt ?? randomBytes(16).toString("hex");
  const derived = (await scrypt(password, resolvedSalt, KEY_LENGTH)) as Buffer;
  return {
    salt: resolvedSalt,
    hash: derived.toString("hex")
  };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHashHex: string
): Promise<boolean> {
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(expectedHashHex, "hex");
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
