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
