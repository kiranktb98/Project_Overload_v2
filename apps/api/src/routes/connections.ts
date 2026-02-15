import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RuntimeConnectionManager } from "../dataplane/connection-manager";

const TestConnectionPayloadSchema = z.object({
  connection_string: z.string().trim().min(1)
});

const ConnectPayloadSchema = z.object({
  name: z.string().trim().min(1).optional(),
  connection_string: z.string().trim().min(1),
  allowed_relations: z.array(z.string().trim().min(1)).default([])
});

const AllowlistPayloadSchema = z.object({
  allowed_relations: z.array(z.string().trim().min(1)).min(1)
});

const QueryPayloadSchema = z.object({
  sql: z.string().trim().min(1),
  limit: z.number().int().min(1).max(2000).optional()
});

export function registerConnectionRoutes(app: FastifyInstance, manager: RuntimeConnectionManager): void {
  app.get("/connections/active", async () => {
    return manager.getContext();
  });

  app.get("/connections/tables", async () => {
    return {
      tables: manager.getTables()
    };
  });

  app.post("/connections/test", async (request, reply) => {
    const payload = TestConnectionPayloadSchema.parse(request.body);
    const result = await manager.testConnection(payload.connection_string);
    return reply.code(200).send({
      ok: true,
      ...result
    });
  });

  app.post("/connections/connect", async (request, reply) => {
    const payload = ConnectPayloadSchema.parse(request.body);
    const context = await manager.connect({
      name: payload.name,
      connection_string: payload.connection_string,
      allowed_relations: payload.allowed_relations
    });

    return reply.code(200).send(context);
  });

  app.post("/connections/allowlist", async (request, reply) => {
    const payload = AllowlistPayloadSchema.parse(request.body);
    const context = manager.updateAllowlist(payload.allowed_relations);
    return reply.code(200).send(context);
  });

  app.post("/connections/query", async (request, reply) => {
    const payload = QueryPayloadSchema.parse(request.body);
    const result = await manager.runSafeQuery(payload.sql, payload.limit);
    return reply.code(200).send(result);
  });

  app.post("/connections/disconnect", async (_request, reply) => {
    await manager.disconnect();
    return reply.code(200).send({
      ok: true
    });
  });
}
