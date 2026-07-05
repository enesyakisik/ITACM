-- ITACM — IT Asset Control Pro: PostgreSQL schema (idempotent).
-- Applied automatically on server startup (see migrate.js).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Admin', 'Helpdesk', 'Viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name          TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  department         TEXT,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  active_asset_count INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag             TEXT NOT NULL UNIQUE,
  serial_number         TEXT NOT NULL,
  brand                 TEXT NOT NULL,
  model                 TEXT NOT NULL,
  category              TEXT NOT NULL,
  mac_ethernet          TEXT,
  mac_wifi              TEXT,
  specs                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'In Stock'
                        CHECK (status IN ('In Stock', 'Assigned', 'In Repair', 'Scrap')),
  current_employee_id   UUID REFERENCES employees(id),
  current_employee_name TEXT,
  warranty_end_date     TIMESTAMPTZ,
  qr_code_string        TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_status   ON assets (status, asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets (category);

CREATE TABLE IF NOT EXISTS licenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  software_name   TEXT NOT NULL,
  vendor          TEXT,
  license_key     TEXT NOT NULL,
  total_seats     INTEGER NOT NULL CHECK (total_seats >= 1),
  used_seats      INTEGER NOT NULL DEFAULT 0 CHECK (used_seats >= 0),
  expiration_date TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (used_seats <= total_seats)
);
CREATE INDEX IF NOT EXISTS idx_licenses_expiration ON licenses (expiration_date);

CREATE TABLE IF NOT EXISTS consumables (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name                 TEXT NOT NULL,
  total_stock               INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  minimum_stock_alert_level INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handovers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id),
  employee_name    TEXT NOT NULL,
  it_user_id       TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_type    TEXT NOT NULL DEFAULT 'single' CHECK (document_type IN ('single', 'separate')),
  items            JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_handovers_employee ON handovers (employee_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_handovers_date     ON handovers (transaction_date DESC);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID NOT NULL REFERENCES assets(id),
  asset_tag         TEXT NOT NULL,
  service_company   TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  cost              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sent_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  return_date       TIMESTAMPTZ,
  previous_status   TEXT,
  previous_employee JSONB,
  resolution_note   TEXT
);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_logs (asset_id, sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_open  ON maintenance_logs (sent_date DESC) WHERE return_date IS NULL;

CREATE TABLE IF NOT EXISTS asset_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES assets(id),
  asset_tag   TEXT NOT NULL,
  employee_id UUID,
  action_type TEXT NOT NULL CHECK (action_type IN ('assigned', 'returned', 'sent_to_repair')),
  notes       TEXT NOT NULL DEFAULT '',
  changed_by  TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_asset ON asset_history (asset_id, "timestamp" DESC);

-- Denormalized names so the audit trail is readable without joins
ALTER TABLE asset_history ADD COLUMN IF NOT EXISTS employee_name   TEXT;
ALTER TABLE asset_history ADD COLUMN IF NOT EXISTS changed_by_name TEXT;

-- Login auditing
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs (user_id, "timestamp" DESC);

-- Software (license) assignment to employees — "yazılım zimmeti"
CREATE TABLE IF NOT EXISTS license_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id       UUID NOT NULL REFERENCES licenses(id),
  software_name    TEXT NOT NULL,
  employee_id      UUID NOT NULL REFERENCES employees(id),
  employee_name    TEXT NOT NULL,
  assigned_by      TEXT NOT NULL,
  assigned_by_name TEXT,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ,
  revoked_by       TEXT
);
CREATE INDEX IF NOT EXISTS idx_lic_assign_emp ON license_assignments (employee_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lic_assign_lic ON license_assignments (license_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_employee ON asset_history (employee_id, "timestamp" DESC);

-- Company branding & onboarding (single-row settings table)
CREATE TABLE IF NOT EXISTS app_settings (
  id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'IT Asset Control Pro',
  company_logo TEXT,
  onboarded    BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Editable handover-form terms text (NULL → application default)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS handover_terms TEXT;

-- Purchase date replaces warranty in the UI (column kept for compatibility)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ;
UPDATE assets SET purchase_date = created_at WHERE purchase_date IS NULL;

-- Product catalog: brand/model lists that feed the asset form dropdowns
CREATE TABLE IF NOT EXISTS catalog_models (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  brand    TEXT NOT NULL,
  model    TEXT NOT NULL,
  UNIQUE (category, brand, model)
);

-- Repair progress notes: free-form updates while a device is in service
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS progress_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE asset_history DROP CONSTRAINT IF EXISTS asset_history_action_type_check;
ALTER TABLE asset_history ADD CONSTRAINT asset_history_action_type_check
  CHECK (action_type IN ('assigned', 'returned', 'sent_to_repair', 'repair_update'));

-- Category lifecycle durations (months); NULL -> application defaults
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS lifecycles JSONB;
