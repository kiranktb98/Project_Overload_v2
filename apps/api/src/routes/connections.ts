import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RuntimeConnectionManager } from "../dataplane/connection-manager";

const TestConnectionPayloadSchema = z.object({
  connection_string: z.string().trim().min(1),
  tls_ca_pem: z.string().trim().min(1).optional()
});

const ConnectPayloadSchema = z.object({
  name: z.string().trim().min(1).optional(),
  connection_string: z.string().trim().min(1),
  tls_ca_pem: z.string().trim().min(1).optional(),
  allowed_relations: z.array(z.string().trim().min(1)).default([])
});

const AllowlistPayloadSchema = z.object({
  allowed_relations: z.array(z.string().trim().min(1)).min(1)
});

const FixScriptPayloadSchema = z.object({
  allowlisted_relations: z.array(z.string().trim().min(1)).min(1),
  reader_role: z.string().trim().min(1).optional(),
  reader_password: z.string().trim().min(1).optional()
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
      relations: manager.getTables()
    };
  });

  app.post("/connections/test", async (request, reply) => {
    const payload = TestConnectionPayloadSchema.parse(request.body);
    try {
      const result = await manager.testConnection(payload.connection_string, payload.tls_ca_pem);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to test connection"
      });
    }
  });

  app.post("/connections/connect", async (request, reply) => {
    const payload = ConnectPayloadSchema.parse(request.body);
    try {
      const context = await manager.connect({
        name: payload.name,
        connection_string: payload.connection_string,
        tls_ca_pem: payload.tls_ca_pem,
        allowed_relations: payload.allowed_relations
      });

      return reply.code(200).send(context);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to connect"
      });
    }
  });

  app.post("/connections/allowlist", async (request, reply) => {
    const payload = AllowlistPayloadSchema.parse(request.body);
    try {
      const context = manager.updateAllowlist(payload.allowed_relations);
      return reply.code(200).send(context);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update allowlist"
      });
    }
  });

  app.post("/connections/fix-script", async (request, reply) => {
    const payload = FixScriptPayloadSchema.parse(request.body);
    try {
      const script = manager.generateFixScript({
        allowlisted_relations: payload.allowlisted_relations,
        reader_role: payload.reader_role,
        reader_password: payload.reader_password
      });

      return reply.code(200).send({
        ok: true,
        script
      });
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to generate script"
      });
    }
  });

  app.get("/connections/query-logs", async (_request, reply) => {
    return reply.code(200).send({
      logs: manager.getQueryLogs()
    });
  });

  app.post("/connections/query", async (request, reply) => {
    const payload = QueryPayloadSchema.parse(request.body);
    try {
      const result = await manager.runSafeQuery(payload.sql, payload.limit);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to run query"
      });
    }
  });

  app.post("/connections/disconnect", async (_request, reply) => {
    try {
      await manager.disconnect();
      return reply.code(200).send({
        ok: true
      });
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to disconnect"
      });
    }
  });
}
