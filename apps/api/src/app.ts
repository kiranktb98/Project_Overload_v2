import Fastify from "fastify";

export function buildApiApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok", service: "api" }));

  return app;
}