import { buildWebApp } from "./app";
import { loadEnvironment } from "./load-env";
import { ensureMarketingBundle } from "./marketing-build";

loadEnvironment(import.meta.url);

const port = Number.parseInt(process.env.WEB_PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

await ensureMarketingBundle();

const app = buildWebApp();

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
