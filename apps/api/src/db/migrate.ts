import { Pool } from "pg";
import { loadInitialMigrationSql } from "./sql";
import { loadEnvironment } from "../load-env";

loadEnvironment(import.meta.url);

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const pool = new Pool({ connectionString });
  const sql = await loadInitialMigrationSql();

  try {
    await pool.query(sql);
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
