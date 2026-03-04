import type {
  Dimension,
  Metric,
  ReportContract,
  ReportRun,
  SemanticEntity,
  SemanticField,
  SemanticRelationship
} from "@project-overload/shared";

export type SemanticCollections = {
  entities: SemanticEntity;
  fields: SemanticField;
  relationships: SemanticRelationship;
  metrics: Metric;
  dimensions: Dimension;
};

export type SemanticCollectionName = keyof SemanticCollections;

export type StoreRequestContext = {
  tenant_id: string;
};

export type PlatformUserRecord = {
  id: string;
  tenant_id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type ChatSessionMessageRecord = {
  role: "user" | "assistant";
  text: string;
  download_url: string | null;
  exec_brief_html: string | null;
  at: string;
};

export type ChatSessionRecord = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  title_auto: boolean;
  naming_in_progress: boolean;
  state: Record<string, unknown> | null;
  user_messages: string[];
  db_bootstrapped: boolean;
  messages: ChatSessionMessageRecord[];
  created_at: string;
  updated_at: string;
};

export type ReportContractVersionRecord = {
  contract_id: string;
  tenant_id: string;
  version: number;
  payload: ReportContract;
  note: string | null;
  created_at: string;
};

export type RagChunkUpsertRecord = {
  user_id: string;
  session_id: string;
  source: string;
  label: string;
  text_content: string;
  content_hash: string;
  embedding: number[];
};

export type RagChunkSearchResult = {
  source: string;
  label: string;
  text: string;
  similarity: number;
};

export interface MetadataStore {
  createSemantic<K extends SemanticCollectionName>(
    collection: K,
    payload: SemanticCollections[K],
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K]>;
  listSemantic<K extends SemanticCollectionName>(
    collection: K,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K][]>;
  getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K] | null>;

  createReportContract(payload: ReportContract, context?: StoreRequestContext): Promise<ReportContract>;
  listReportContracts(context?: StoreRequestContext): Promise<ReportContract[]>;
  getReportContract(id: string, context?: StoreRequestContext): Promise<ReportContract | null>;
  createReportContractVersion(
    contractId: string,
    payload: ReportContract,
    note: string | null,
    context?: StoreRequestContext
  ): Promise<ReportContractVersionRecord>;
  listReportContractVersions(contractId: string, context?: StoreRequestContext): Promise<ReportContractVersionRecord[]>;

  createReportRun(payload: ReportRun, context?: StoreRequestContext): Promise<ReportRun>;
  listReportRuns(contractId: string, context?: StoreRequestContext): Promise<ReportRun[]>;
  getLatestReportRun(contractId: string, context?: StoreRequestContext): Promise<ReportRun | null>;
  getReportRunById(runId: string, context?: StoreRequestContext): Promise<ReportRun | null>;

  setSystemState(key: string, payload: Record<string, unknown> | null, context?: StoreRequestContext): Promise<void>;
  getSystemState(key: string, context?: StoreRequestContext): Promise<Record<string, unknown> | null>;

  upsertPlatformUser(payload: Omit<PlatformUserRecord, "created_at" | "last_login_at">, context?: StoreRequestContext): Promise<PlatformUserRecord>;
  getPlatformUserByUsername(username: string, context?: StoreRequestContext): Promise<PlatformUserRecord | null>;
  markPlatformUserLogin(userId: string, context?: StoreRequestContext): Promise<void>;

  listChatSessions(userId: string, context?: StoreRequestContext): Promise<ChatSessionRecord[]>;
  upsertChatSession(
    payload: Omit<ChatSessionRecord, "tenant_id" | "created_at" | "updated_at">,
    context?: StoreRequestContext
  ): Promise<ChatSessionRecord>;
  upsertChatRagChunks(payload: RagChunkUpsertRecord[], context?: StoreRequestContext): Promise<void>;
  searchChatRagChunks(
    payload: {
      user_id: string;
      session_id: string;
      embedding: number[];
      limit: number;
    },
    context?: StoreRequestContext
  ): Promise<RagChunkSearchResult[]>;

  appendAuditLog(eventType: string, payload: Record<string, unknown>, context?: StoreRequestContext): Promise<void>;
  close(): Promise<void>;
}
