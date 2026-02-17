import { Pool } from "pg";

export type LocalRowSource = "synthetic" | "postgres";

export type LocalRowProvider = (sql: string) => Promise<Record<string, unknown>[]>;

export type LocalRowProviderRuntime = {
  source: LocalRowSource;
  row_provider: LocalRowProvider;
  close: () => Promise<void>;
};

type LocalRowProviderEnv = {
  [key: string]: string | undefined;
  DATAPLANE_LOCAL_SOURCE?: string;
  DATAPLANE_LOCAL_PG_URL?: string;
  DATABASE_URL?: string;
};

export function createLocalRowProviderFromEnv(
  env: LocalRowProviderEnv = process.env
): LocalRowProviderRuntime {
  const source = parseLocalRowSource(env.DATAPLANE_LOCAL_SOURCE);

  if (source === "postgres") {
    const connectionString = env.DATAPLANE_LOCAL_PG_URL ?? env.DATABASE_URL;
    if (!connectionString) {
      return createSyntheticRowProviderRuntime();
    }

    return createPostgresRowProviderRuntime(connectionString);
  }

  return createSyntheticRowProviderRuntime();
}

export function parseLocalRowSource(rawSource: string | undefined): LocalRowSource {
  const normalized = (rawSource ?? "synthetic").trim().toLowerCase();
  return normalized === "postgres" ? "postgres" : "synthetic";
}

function createPostgresRowProviderRuntime(connectionString: string): LocalRowProviderRuntime {
  let pool: Pool | null = null;

  const getPool = (): Pool => {
    if (!pool) {
      pool = new Pool({
        connectionString,
        max: 5
      });
    }

    return pool;
  };

  return {
    source: "postgres",
    row_provider: async (sql: string) => {
      const result = await getPool().query(sql);
      return result.rows as Record<string, unknown>[];
    },
    close: async () => {
      if (!pool) {
        return;
      }

      await pool.end();
      pool = null;
    }
  };
}

function createSyntheticRowProviderRuntime(): LocalRowProviderRuntime {
  return {
    source: "synthetic",
    row_provider: async () =>
      Array.from({ length: 500 }, (_, index) => ({
        order_id: `order_${index + 1}`,
        customer_id: `customer_${(index % 120) + 1}`,
        customer_email: `customer_${(index % 120) + 1}@example.com`,
        amount: ((index % 45) + 20) * ((index % 4) + 1),
        region: ["NA", "EU", "APAC", "LATAM", "MEA"][index % 5],
        channel: ["direct", "partner", "online", "field"][index % 4],
        product_category: ["Compute", "Storage", "Security", "Analytics", "AI"][index % 5],
        event_time: `2025-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`
      })),
    close: async () => {}
  };
}
