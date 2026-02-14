import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  DimensionSchema,
  MetricSchema,
  SemanticEntitySchema,
  SemanticFieldSchema,
  SemanticRelationshipSchema
} from "@project-overload/shared";
import type { MetadataStore } from "../store";

export function registerSemanticRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.post("/semantic/entities", async (request, reply) => {
    const payload = SemanticEntitySchema.parse(withId(request.body));
    const created = await store.createSemantic("entities", payload);
    reply.code(201).send(created);
  });

  app.get("/semantic/entities", async () => {
    return store.listSemantic("entities");
  });

  app.get("/semantic/entities/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const entity = await store.getSemantic("entities", id);

    if (!entity) {
      return reply.code(404).send({ message: "Entity not found" });
    }

    return entity;
  });

  app.post("/semantic/fields", async (request, reply) => {
    const payload = SemanticFieldSchema.parse(withId(request.body));
    const created = await store.createSemantic("fields", payload);
    reply.code(201).send(created);
  });

  app.get("/semantic/fields", async () => {
    return store.listSemantic("fields");
  });

  app.get("/semantic/fields/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const field = await store.getSemantic("fields", id);

    if (!field) {
      return reply.code(404).send({ message: "Field not found" });
    }

    return field;
  });

  app.post("/semantic/relationships", async (request, reply) => {
    const payload = SemanticRelationshipSchema.parse(withId(request.body));
    const created = await store.createSemantic("relationships", payload);
    reply.code(201).send(created);
  });

  app.get("/semantic/relationships", async () => {
    return store.listSemantic("relationships");
  });

  app.get("/semantic/relationships/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const relationship = await store.getSemantic("relationships", id);

    if (!relationship) {
      return reply.code(404).send({ message: "Relationship not found" });
    }

    return relationship;
  });

  app.post("/semantic/metrics", async (request, reply) => {
    const payload = MetricSchema.parse(withId(request.body));
    const created = await store.createSemantic("metrics", payload);
    reply.code(201).send(created);
  });

  app.get("/semantic/metrics", async () => {
    return store.listSemantic("metrics");
  });

  app.get("/semantic/metrics/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const metric = await store.getSemantic("metrics", id);

    if (!metric) {
      return reply.code(404).send({ message: "Metric not found" });
    }

    return metric;
  });

  app.post("/semantic/dimensions", async (request, reply) => {
    const payload = DimensionSchema.parse(withId(request.body));
    const created = await store.createSemantic("dimensions", payload);
    reply.code(201).send(created);
  });

  app.get("/semantic/dimensions", async () => {
    return store.listSemantic("dimensions");
  });

  app.get("/semantic/dimensions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dimension = await store.getSemantic("dimensions", id);

    if (!dimension) {
      return reply.code(404).send({ message: "Dimension not found" });
    }

    return dimension;
  });
}

function withId(body: unknown): Record<string, unknown> {
  const payload = body as Record<string, unknown>;

  return {
    id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : randomUUID(),
    ...payload
  };
}