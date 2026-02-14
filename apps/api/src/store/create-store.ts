import { InMemoryMetadataStore } from "./in-memory-store";
import { PostgresMetadataStore } from "./postgres-store";
import type { MetadataStore } from "./types";

export async function createMetadataStoreFromEnv(): Promise<MetadataStore> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return PostgresMetadataStore.create(connectionString);
  }

  return new InMemoryMetadataStore();
}

export { InMemoryMetadataStore, PostgresMetadataStore };
export type { MetadataStore };