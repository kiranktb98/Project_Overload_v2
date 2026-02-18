import type { FastifyRequest } from "fastify";
import type { StoreRequestContext } from "../store";

const DEFAULT_TENANT_ID = "default";
const DEFAULT_ACTOR_ID = "system";

export type RequestActorContext = StoreRequestContext & {
  actor_id: string;
};

export function resolveRequestContext(request: FastifyRequest): RequestActorContext {
  const tenantId = readHeaderValue(request, "x-tenant-id") ?? DEFAULT_TENANT_ID;
  const actorId = readHeaderValue(request, "x-actor-id") ?? DEFAULT_ACTOR_ID;

  return {
    tenant_id: tenantId,
    actor_id: actorId
  };
}

export function validateApiAuth(request: FastifyRequest): { ok: true } | { ok: false; message: string } {
  const required = parseBoolean(process.env.API_AUTH_REQUIRED);
  if (!required) {
    return { ok: true };
  }

  const expected = process.env.API_AUTH_TOKEN?.trim();
  if (!expected) {
    return { ok: false, message: "API auth is required but API_AUTH_TOKEN is not configured on server." };
  }

  const provided = readHeaderValue(request, "x-api-key");
  if (!provided || provided !== expected) {
    return { ok: false, message: "Unauthorized: missing or invalid x-api-key." };
  }

  return { ok: true };
}

function readHeaderValue(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const candidate of value) {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
