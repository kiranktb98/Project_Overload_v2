import { z } from "zod";

export const MetricDefinitionSchema = z.object({
  metric_key: z.string().min(1),
  display_name: z.string().min(1),
  definition: z.string().min(1),
  source_type: z.enum(["column", "derived"]).default("derived"),
  source_columns: z.array(z.string().min(1)).default([])
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const GlobalConfigSchema = z.object({
  metric_definitions: z.array(MetricDefinitionSchema).default([])
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const GLOBAL_CONFIG_STATE_KEY = "global_config";
