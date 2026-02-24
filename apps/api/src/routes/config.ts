import type { FastifyInstance } from "fastify";
import { GlobalConfigSchema, GLOBAL_CONFIG_STATE_KEY } from "@project-overload/shared";
import type { MetadataStore } from "../store";
import { resolveRequestContext } from "../security/request-context";

export function registerConfigRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.get("/config/global", async (request, reply) => {
    const context = resolveRequestContext(request);
    const raw = await store.getSystemState(GLOBAL_CONFIG_STATE_KEY, context);
    const config = GlobalConfigSchema.parse(raw ?? {});
    return reply.code(200).send(config);
  });

  app.put("/config/global", async (request, reply) => {
    const context = resolveRequestContext(request);
    const parsed = GlobalConfigSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid global config payload",
        issues: parsed.error.issues
      });
    }

    await store.setSystemState(
      GLOBAL_CONFIG_STATE_KEY,
      parsed.data as unknown as Record<string, unknown>,
      context
    );

    await store.appendAuditLog(
      "global_config_updated",
      {
        metric_definitions_count: parsed.data.metric_definitions.length
      },
      context
    );

    return reply.code(200).send(parsed.data);
  });
}
