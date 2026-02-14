import Fastify from "fastify";
import { ZodError } from "zod";
import { createDataPlaneFromEnv, type DataPlane } from "@project-overload/dataplane";
import { createAnalystClientFromEnv, type AnalystClient } from "@project-overload/llm-client";
import { createMetadataStoreFromEnv, type MetadataStore } from "./store";
import { registerSemanticRoutes } from "./routes/semantic";
import { registerContractRoutes } from "./routes/contracts";
import { createLocalRowProviderFromEnv } from "./dataplane/local-row-provider";

export type ApiDependencies = {
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
};

export async function buildApiApp(options: Partial<ApiDependencies> = {}) {
  const app = Fastify({ logger: false });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const rawBody = (typeof body === "string" ? body : body.toString("utf8")).trim();

      if (rawBody.length === 0) {
        done(null, {});
        return;
      }

      try {
        done(null, JSON.parse(rawBody));
      } catch (error) {
        done(error as Error);
      }
    }
  );

  const store = options.store ?? (await createMetadataStoreFromEnv());
  const localRowProvider = options.data_plane ? null : createLocalRowProviderFromEnv();
  const dataPlane =
    options.data_plane ??
    createDataPlaneFromEnv({
      local_stub_options: {
        row_provider: localRowProvider?.row_provider
      }
    });
  const analystClient = options.analyst_client ?? createAnalystClientFromEnv();

  app.get("/health", async () => ({ status: "ok", service: "api" }));

  registerSemanticRoutes(app, store);
  registerContractRoutes(app, store, dataPlane, analystClient);

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Validation failed",
        issues: error.issues
      });
    }

    if (error instanceof Error) {
      return reply.code(500).send({ message: error.message });
    }

    return reply.code(500).send({ message: "Unknown error" });
  });

  app.addHook("onClose", async () => {
    await store.close();
    await localRowProvider?.close();
  });

  return app;
}
