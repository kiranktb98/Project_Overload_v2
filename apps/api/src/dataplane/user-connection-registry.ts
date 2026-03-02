import { AsyncLocalStorage } from "node:async_hooks";
import { RuntimeConnectionManager, type ConnectionManagerOptions } from "./connection-manager";

const DEFAULT_USER_ID = "default";

export type UserConnectionRegistryOptions = Omit<ConnectionManagerOptions, "tenant_id">;

export const userContextStorage = new AsyncLocalStorage<{ user_id: string }>();

export class UserConnectionRegistry {
  private readonly managers = new Map<string, RuntimeConnectionManager>();
  private readonly initPromises = new Map<string, Promise<void>>();
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
      // Restore any persisted connection for this user.
      // Pass empty env so only the persisted state is restored, not the env-var
      // fallback (which is only for the default/bootstrap manager).
      const initPromise = manager.initFromEnv({}).catch(() => {});
      this.initPromises.set(key, initPromise);
    }
    return manager;
  }

  /**
   * Get or create a manager and ensure its persisted connection has been restored.
   * Use this in route handlers where the connection state must be ready.
   */
  async getOrCreateReady(userId: string): Promise<RuntimeConnectionManager> {
    const key = (userId || "").trim() || DEFAULT_USER_ID;
    const manager = this.getOrCreate(key);
    const pending = this.initPromises.get(key);
    if (pending) {
      await pending;
      this.initPromises.delete(key);
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
    this.initPromises.delete(DEFAULT_USER_ID);
  }

  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const manager of this.managers.values()) {
      promises.push(manager.close());
    }
    await Promise.allSettled(promises);
    this.managers.clear();
    this.initPromises.clear();
  }
}
