CREATE TABLE IF NOT EXISTS semantic_entities (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semantic_fields (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semantic_relationships (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dimensions (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_contracts (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_runs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS report_runs_contract_created_idx
  ON report_runs(contract_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_contract_versions (
  id BIGSERIAL PRIMARY KEY,
  contract_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, tenant_id, version)
);

CREATE INDEX IF NOT EXISTS report_contract_versions_contract_tenant_idx
  ON report_contract_versions(contract_id, tenant_id, version DESC);

CREATE TABLE IF NOT EXISTS system_state (
  state_key TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (state_key, tenant_id)
);

CREATE TABLE IF NOT EXISTS scheduled_report_profiles (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS scheduled_report_profiles_updated_idx
  ON scheduled_report_profiles(tenant_id, updated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  username TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  display_name TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NULL,
  UNIQUE (tenant_id, username)
);

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL;

CREATE TABLE IF NOT EXISTS customer_accounts (
  tenant_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_updated_idx
  ON support_tickets(tenant_id, updated_at DESC, created_at DESC);

DROP TABLE IF EXISTS invoice_ledger;

CREATE TABLE IF NOT EXISTS infra_cost_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS infra_cost_ledger_tenant_updated_idx
  ON infra_cost_ledger(tenant_id, updated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS openrouter_balance_history (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS openrouter_balance_history_created_idx
  ON openrouter_balance_history(created_at DESC);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_auto BOOLEAN NOT NULL DEFAULT TRUE,
  naming_in_progress BOOLEAN NOT NULL DEFAULT FALSE,
  state JSONB NULL,
  user_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  db_bootstrapped BOOLEAN NOT NULL DEFAULT FALSE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
  ON chat_sessions(tenant_id, user_id, updated_at DESC);

INSERT INTO platform_users (
  id,
  tenant_id,
  username,
  password_salt,
  password_hash,
  role,
  display_name,
  is_active
)
VALUES (
  'user_test123',
  'default',
  'test123',
  '99abe147221b66a4b3323aa942e6d2f4',
  '09ba67974ef96ca0ff5d6bde095bf986d9e1030fb5cffff66ee2cbc9c5aae603077464b8f8994b583b2f0f01b0d29b48db23345cc04d6ccf0e413d66b965237d',
  'customer',
  'Claritect User',
  TRUE
)
ON CONFLICT (tenant_id, username) DO NOTHING;

INSERT INTO platform_users (
  id,
  tenant_id,
  username,
  password_salt,
  password_hash,
  role,
  display_name,
  is_active
)
VALUES (
  'user_claritect_admin',
  'default',
  'claritect_admin',
  '99abe147221b66a4b3323aa942e6d2f4',
  '09ba67974ef96ca0ff5d6bde095bf986d9e1030fb5cffff66ee2cbc9c5aae603077464b8f8994b583b2f0f01b0d29b48db23345cc04d6ccf0e413d66b965237d',
  'admin',
  'Claritect Admin',
  TRUE
)
ON CONFLICT (tenant_id, username) DO NOTHING;

INSERT INTO customer_accounts (tenant_id, payload)
VALUES (
  'default',
  '{
    "tenant_id":"default",
    "name":"Claritect Pilot",
    "plan_tier":"Growth",
    "status":"active",
    "primary_contact_name":"Claritect Team",
    "primary_contact_email":"owner@example.com",
    "billing_status":"current",
    "renewal_date":null,
    "owner":"Claritect Team",
    "notes":"Default seeded customer account.",
    "entitlements":{
      "seats":10,
      "scheduled_reports":24,
      "monthly_runs":250,
      "ai_budget_usd":null,
      "feature_flags":["marketing_site","admin_console","scheduled_reports","business_case"]
    },
    "created_at":"2026-01-01T00:00:00.000Z",
    "updated_at":"2026-01-01T00:00:00.000Z"
  }'::jsonb
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Local analytics fixture dataset for deterministic report testing.
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.customers (
  customer_id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  region TEXT NOT NULL,
  segment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics.sales (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES analytics.customers(customer_id),
  event_time TIMESTAMPTZ NOT NULL,
  region TEXT NOT NULL,
  channel TEXT NOT NULL,
  product_category TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  discount_rate NUMERIC(6, 4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sales_event_time_idx
  ON analytics.sales(event_time DESC);

CREATE INDEX IF NOT EXISTS sales_region_event_time_idx
  ON analytics.sales(region, event_time DESC);

CREATE INDEX IF NOT EXISTS sales_customer_idx
  ON analytics.sales(customer_id);

INSERT INTO analytics.customers (
  customer_id,
  customer_name,
  customer_email,
  phone,
  region,
  segment,
  created_at
)
SELECT
  'cust_' || LPAD(gs::text, 5, '0') AS customer_id,
  'Customer ' || gs AS customer_name,
  'customer_' || gs || '@example.com' AS customer_email,
  '+1-555-' || LPAD((1000000 + gs)::text, 7, '0') AS phone,
  (ARRAY['NA', 'EU', 'APAC', 'LATAM', 'MEA'])[(gs % 5) + 1] AS region,
  (ARRAY['Enterprise', 'Mid-Market', 'SMB'])[(gs % 3) + 1] AS segment,
  '2023-01-01'::timestamptz + make_interval(days => (gs % 700)) AS created_at
FROM generate_series(1, 12000) AS gs
WHERE NOT EXISTS (SELECT 1 FROM analytics.customers LIMIT 1);

INSERT INTO analytics.sales (
  order_id,
  customer_id,
  event_time,
  region,
  channel,
  product_category,
  quantity,
  amount,
  discount_rate,
  status
)
SELECT
  'ord_' || LPAD(gs::text, 7, '0') AS order_id,
  'cust_' || LPAD((((gs * 7) % 12000) + 1)::text, 5, '0') AS customer_id,
  '2024-01-01'::timestamptz + make_interval(days => (gs % 720), hours => (gs % 24), mins => (gs % 60)) AS event_time,
  (ARRAY['NA', 'EU', 'APAC', 'LATAM', 'MEA'])[((gs * 3) % 5) + 1] AS region,
  (ARRAY['direct', 'partner', 'online', 'field'])[(gs % 4) + 1] AS channel,
  (ARRAY['Compute', 'Storage', 'Security', 'Analytics', 'AI'])[(gs % 5) + 1] AS product_category,
  ((gs % 5) + 1) AS quantity,
  ROUND((((gs % 380) + 40) * ((gs % 5) + 1) * (1 + ((gs % 9) * 0.03)))::numeric, 2) AS amount,
  CASE
    WHEN (gs % 11) = 0 THEN 0.1500
    WHEN (gs % 7) = 0 THEN 0.0800
    ELSE 0.0000
  END AS discount_rate,
  (ARRAY['completed', 'completed', 'completed', 'completed', 'refunded', 'cancelled'])[(gs % 6) + 1] AS status
FROM generate_series(1, 75000) AS gs
WHERE NOT EXISTS (SELECT 1 FROM analytics.sales LIMIT 1);

CREATE OR REPLACE VIEW analytics.sales_enriched AS
SELECT
  s.order_id,
  s.customer_id,
  c.customer_name,
  c.customer_email,
  c.segment,
  s.event_time,
  s.region,
  s.channel,
  s.product_category,
  s.quantity,
  s.amount,
  s.discount_rate,
  ROUND((s.amount * (1 - s.discount_rate))::numeric, 2) AS net_amount,
  s.status
FROM analytics.sales AS s
INNER JOIN analytics.customers AS c
  ON c.customer_id = s.customer_id;
