import { buildApiApp } from "./app";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApiApp();

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});