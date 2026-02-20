import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RuntimeConnectionManager } from "../dataplane/connection-manager";

const ProviderSchema = z.enum(["postgres", "supabase", "neon", "mysql", "snowflake", "bigquery"]);

const TestConnectionPayloadSchema = z.object({
  connection_string: z.string().trim().min(1),
  tls_ca_pem: z.string().trim().min(1).optional(),
  provider: ProviderSchema.default("postgres")
});

const ConnectPayloadSchema = z.object({
  name: z.string().trim().min(1).optional(),
  connection_string: z.string().trim().min(1),
  provider: ProviderSchema.default("postgres"),
  tls_ca_pem: z.string().trim().min(1).optional(),
  allowed_relations: z.array(z.string().trim().min(1)).default([]),
  business_context: z.string().trim().max(2000).optional()
});

const BusinessContextPayloadSchema = z.object({
  business_context: z.string().trim().max(2000)
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
      const result = await manager.testConnection(payload.connection_string, payload.tls_ca_pem, payload.provider);
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
        provider: payload.provider,
        tls_ca_pem: payload.tls_ca_pem,
        allowed_relations: payload.allowed_relations,
        business_context: payload.business_context
      });

      return reply.code(200).send(context);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to connect"
      });
    }
  });

  app.get("/connections/catalog", async (_request, reply) => {
    const catalog = manager.getCatalog();
    if (!catalog) {
      return reply.code(200).send({ business_id: null, tables: [], business_context: "", cataloged_at: null });
    }
    return reply.code(200).send(catalog);
  });

  app.post("/connections/catalog/refresh", async (_request, reply) => {
    try {
      const catalog = await manager.refreshCatalog();
      return reply.code(200).send(catalog ?? { tables: [], business_context: "", cataloged_at: null });
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to refresh catalog"
      });
    }
  });

  app.post("/connections/catalogue", async (_request, reply) => {
    try {
      const catalog = await manager.refreshCatalog();
      return reply.code(200).send(catalog ?? { business_id: null, tables: [], business_context: "", cataloged_at: null });
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to run catalogue agent"
      });
    }
  });

  app.post("/connections/business-context", async (request, reply) => {
    const payload = BusinessContextPayloadSchema.parse(request.body);
    try {
      manager.updateBusinessContext(payload.business_context);
      return reply.code(200).send({ ok: true, business_context: payload.business_context });
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to update business context"
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

  app.post("/connections/validate", async (_request, reply) => {
    try {
      const result = await manager.validateAllowlistAccess();
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: error instanceof Error ? error.message : "Unable to validate allowlist"
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
