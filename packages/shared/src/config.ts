import { z } from "zod";

export const MetricDefinitionStatusSchema = z.enum(["resolved", "unresolved", "pending"]);
export type MetricDefinitionStatus = z.infer<typeof MetricDefinitionStatusSchema>;

export const MetricDefinitionSchema = z.object({
  metric_key: z.string().min(1),
  display_name: z.string().min(1),
  definition: z.string().min(1),
  filter_description: z.string().default(""),
  filter_column: z.string().default(""),
  filter_values: z.array(z.string()).default([]),
  status: MetricDefinitionStatusSchema.default("pending")
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const GlobalConfigSchema = z.object({
  metric_definitions: z.array(MetricDefinitionSchema).default([])
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const GLOBAL_CONFIG_STATE_KEY = "global_config";

/** Migrate old metric definitions that had a single `filters` string field. */
export function migrateMetricDefinition(raw: Record<string, unknown>): Record<string, unknown> {
  if ("filters" in raw && !("filter_column" in raw)) {
    const oldFilters = String(raw.filters ?? "").trim();
    const migrated = { ...raw };
    delete migrated.filters;
    migrated.filter_description = oldFilters;
    migrated.filter_column = "";
    migrated.filter_values = [];
    migrated.status = oldFilters.length > 0 ? "pending" : "resolved";
    return migrated;
  }
  // Also strip any leftover old fields
  if ("source_type" in raw) {
    const migrated = { ...raw };
    delete migrated.source_type;
    delete migrated.source_columns;
    return migrated;
  }
  return raw;
}
