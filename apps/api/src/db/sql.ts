import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function loadInitialMigrationSql(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const migrationPath = path.resolve(currentDir, "../../../../infra/migrations/001_init.sql");

  return readFile(migrationPath, "utf8");
}