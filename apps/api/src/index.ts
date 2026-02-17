import { buildApiApp } from "./app";
import { loadEnvironment } from "./load-env";

loadEnvironment(import.meta.url);

validateRequiredEnv();

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApiApp();

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

function validateRequiredEnv(): void {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required (e.g. postgresql://po:po@localhost:54321/po_v2)");
  }

  if (!process.env.APP_ENCRYPTION_KEY) {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      errors.push("APP_ENCRYPTION_KEY is required in production");
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`[env] ${error}\n`);
    }
    if (errors.some((e) => !e.includes("production"))) {
      process.stderr.write("[env] Check your .env file - copy .env.example if you haven't already.\n");
    }
  }
}
