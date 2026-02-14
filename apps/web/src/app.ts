import Fastify from "fastify";

export function buildWebApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok", service: "web" }));

  return app;
}