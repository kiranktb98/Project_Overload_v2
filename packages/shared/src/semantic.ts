import { z } from "zod";

export const IdSchema = z.string().min(1);

export const SemanticEntitySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  created_at: z.string().datetime().optional()
});

export const SemanticFieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "currency",
  "percentage"
]);

export const SemanticFieldSchema = z.object({
  id: IdSchema,
  entity_id: IdSchema,
  name: z.string().min(1),
  type: SemanticFieldTypeSchema,
  description: z.string().default(""),
  pii: z.boolean().default(false)
});

export const RelationshipKeySchema = z.object({
  from_field: z.string().min(1),
  to_field: z.string().min(1)
});

export const SemanticRelationshipSchema = z.object({
  id: IdSchema,
  from_entity_id: IdSchema,
  to_entity_id: IdSchema,
  join_keys: z.array(RelationshipKeySchema).min(1),
  cardinality: z.enum(["one_to_one", "one_to_many", "many_to_one", "many_to_many"]),
  confidence: z.number().min(0).max(1)
});

export const MetricSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  definition: z.string().min(1),
  grain: z.string().min(1),
  sql_snippet_template: z.string().min(1).optional()
});

export const DimensionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  entity_id: IdSchema.optional(),
  field_id: IdSchema.optional(),
  description: z.string().default(""),
  approved: z.boolean().default(true)
});

export type SemanticEntity = z.infer<typeof SemanticEntitySchema>;
export type SemanticField = z.infer<typeof SemanticFieldSchema>;
export type SemanticRelationship = z.infer<typeof SemanticRelationshipSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type Dimension = z.infer<typeof DimensionSchema>;