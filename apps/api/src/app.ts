import Fastify from "fastify";
import { ZodError } from "zod";
import { LocalStubDataPlane, type DataPlane } from "@project-overload/dataplane";
import { createMetadataStoreFromEnv, type MetadataStore } from "./store";
import { registerSemanticRoutes } from "./routes/semantic";
import { registerContractRoutes } from "./routes/contracts";

export type ApiDependencies = {
  store: MetadataStore;
  data_plane: DataPlane;
};

export async function buildApiApp(options: Partial<ApiDependencies> = {}) {
  const app = Fastify({ logger: false });

  const store = options.store ?? (await createMetadataStoreFromEnv());
  const dataPlane =
    options.data_plane ??
    new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 320 }, (_, index) => ({
          order_id: `order_${index + 1}`,
          customer_id: `customer_${(index % 50) + 1}`,
          customer_email: `customer_${(index % 50) + 1}@example.com`,
          amount: (index % 25) + 10,
          region: ["NA", "EU", "APAC"][index % 3],
          event_time: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`
        }))
    });

  app.get("/health", async () => ({ status: "ok", service: "api" }));

  registerSemanticRoutes(app, store);
  registerContractRoutes(app, store, dataPlane);

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
  });

  return app;
}