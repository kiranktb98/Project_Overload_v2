import { z } from "zod";

export const MetricDefinitionSchema = z.object({
  metric_key: z.string().min(1),
  display_name: z.string().min(1),
  definition: z.string().min(1)
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const GlobalConfigSchema = z.object({
  metric_definitions: z.array(MetricDefinitionSchema).default([])
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const GLOBAL_CONFIG_STATE_KEY = "global_config";

export const UserSettingsSchema = z.object({
  metric_definitions: z.array(MetricDefinitionSchema).default([]),
  business_context: z.string().default("")
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const USER_SETTINGS_STATE_KEY = "user_settings_v1";

/** Migrate old metric definitions to simplified schema (display_name + definition only). */
export function migrateMetricDefinition(raw: Record<string, unknown>): Record<string, unknown> {
  const migrated = { ...raw };
  // Strip legacy fields
  delete migrated.filters;
  delete migrated.filter_description;
  delete migrated.filter_column;
  delete migrated.filter_values;
  delete migrated.status;
  delete migrated.source_type;
  delete migrated.source_columns;
  return migrated;
}
