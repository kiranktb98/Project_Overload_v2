import { AsyncLocalStorage } from "node:async_hooks";
import { RuntimeConnectionManager, type ConnectionManagerOptions } from "./connection-manager";

const DEFAULT_USER_ID = "default";

export type UserConnectionRegistryOptions = Omit<ConnectionManagerOptions, "tenant_id">;

export const userContextStorage = new AsyncLocalStorage<{ user_id: string }>();

export class UserConnectionRegistry {
  private readonly managers = new Map<string, RuntimeConnectionManager>();
  private readonly options: UserConnectionRegistryOptions;

  constructor(options: UserConnectionRegistryOptions = {}) {
    this.options = options;
  }

  getOrCreate(userId: string): RuntimeConnectionManager {
    const key = (userId || "").trim() || DEFAULT_USER_ID;
    let manager = this.managers.get(key);
    if (!manager) {
      manager = new RuntimeConnectionManager({
        ...this.options,
        tenant_id: key
      });
      this.managers.set(key, manager);
    }
    return manager;
  }

  resolveForRequest(): RuntimeConnectionManager {
    const ctx = userContextStorage.getStore();
    const userId = ctx?.user_id ?? DEFAULT_USER_ID;
    return this.getOrCreate(userId);
  }

  async rowProvider(sql: string): Promise<Record<string, unknown>[]> {
    return this.resolveForRequest().rowProvider(sql);
  }

  async initFromEnv(env?: Record<string, string | undefined>): Promise<void> {
    // Create and init a default manager so env-based connections work
    const defaultManager = this.getOrCreate(DEFAULT_USER_ID);
    await defaultManager.initFromEnv(env);
  }

  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const manager of this.managers.values()) {
      promises.push(manager.close());
    }
    await Promise.allSettled(promises);
    this.managers.clear();
  }
}
