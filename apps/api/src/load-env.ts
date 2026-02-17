import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

export function loadEnvironment(importMetaUrl: string): void {
  const currentDir = path.dirname(fileURLToPath(importMetaUrl));
  const envFile = findNearestEnvFile(currentDir);

  if (envFile) {
    loadDotenv({ path: envFile });
    return;
  }

  loadDotenv();
}

function findNearestEnvFile(startDir: string): string | null {
  let dir = startDir;

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.resolve(dir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}
