import { z } from "zod";

export const ConnectionProviderSchema = z.enum([
  "postgres",
  "supabase",
  "neon",
  "mysql",
  "snowflake",
  "bigquery",
  "powerbi_semantic"
]);

export const QueryFamilySchema = z.enum([
  "sql",
  "powerbi_semantic"
]);

export const PowerBiSemanticModelSchema = z.object({
  workspace_id: z.string().min(1),
  workspace_name: z.string().min(1),
  model_id: z.string().min(1),
  model_name: z.string().min(1),
  entities: z.array(z.string().min(1)).default([]),
  measures: z.array(z.string().min(1)).default([]),
  dimensions: z.array(z.string().min(1)).default([]),
  preview_rows: z.array(z.record(z.string(), z.unknown())).default([])
});

export const ExecutionContextSchema = z.object({
  query_family: QueryFamilySchema,
  powerbi_semantic_model: PowerBiSemanticModelSchema.nullable().default(null)
});

export type ConnectionProvider = z.infer<typeof ConnectionProviderSchema>;
export type QueryFamily = z.infer<typeof QueryFamilySchema>;
export type PowerBiSemanticModel = z.infer<typeof PowerBiSemanticModelSchema>;
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
