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

-- Office locations list (array of strings stored as JSONB)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS locations JSONB;

-- Physical location of each asset (denormalized string)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location TEXT;

-- Optional per-asset lifecycle override in months (NULL -> use the category
-- default). Lets e.g. MacBooks run a 5-year lifecycle while other laptops use 4.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS lifecycle_months INTEGER;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS default_location TEXT;

-- Hardware spec dropdown lists (cpu/ram/storage); NULL -> defaults
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS spec_options JSONB;

-- Owner role (highest privilege): relax the users.role CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Owner', 'Admin', 'Helpdesk', 'Viewer'));

-- Document storage provider config (Owner-managed): local | sharepoint | gdrive
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS document_storage JSONB;

-- Customizable Zimmet Tutanağı (handover form) template (Owner-managed).
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS handover_template JSONB;
-- Multiple named templates (array). When set, takes precedence; handover_template
-- stays mirrored as the default for backward compatibility.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS handover_templates JSONB;

-- Which template was used when the handover was created (reprint/PDF).
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS template_id TEXT;

-- Per-employee handover document archive (generated PDFs + uploaded signed scans)
CREATE TABLE IF NOT EXISTS handover_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id      UUID REFERENCES handovers(id) ON DELETE SET NULL,
  employee_id      UUID NOT NULL,
  employee_name    TEXT,
  kind             TEXT NOT NULL CHECK (kind IN ('generated', 'scan')),
  filename         TEXT NOT NULL,
  mime             TEXT NOT NULL,
  byte_size        INTEGER NOT NULL,
  content          BYTEA NOT NULL,
  uploaded_by      TEXT,
  uploaded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_employee ON handover_documents (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_handover ON handover_documents (handover_id);

-- Repair paperwork (service invoices, reports, photos) attached to a maintenance
-- log. Kept per asset so it stays accessible from the device after the repair is
-- closed. Content in BYTEA → covered by the same auth/RBAC and DB backups.
CREATE TABLE IF NOT EXISTS maintenance_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id   UUID REFERENCES maintenance_logs(id) ON DELETE CASCADE,
  asset_id         UUID NOT NULL,
  asset_tag        TEXT,
  filename         TEXT NOT NULL,
  mime             TEXT NOT NULL,
  byte_size        INTEGER NOT NULL,
  content          BYTEA NOT NULL,
  uploaded_by      TEXT,
  uploaded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_docs_asset ON maintenance_documents (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maint_docs_log ON maintenance_documents (maintenance_id);

-- Who executed a handover, denormalised: reprints must show the ORIGINAL
-- assigner, not whoever happens to be logged in.
ALTER TABLE handovers ADD COLUMN IF NOT EXISTS it_user_name TEXT;

-- IT users can be disabled (kept for audit) or deleted by an Owner.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('Active', 'Disabled'));

-- Admin actions on IT accounts (disable/enable/delete) — permanent audit trail
-- that survives the account itself (no FK on purpose).
CREATE TABLE IF NOT EXISTS user_admin_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_email TEXT NOT NULL,
  target_name  TEXT,
  action       TEXT NOT NULL CHECK (action IN ('disabled', 'enabled', 'deleted', 'role_changed')),
  detail       TEXT,
  by_name      TEXT NOT NULL,
  "timestamp"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_admin_logs ON user_admin_logs (target_email, "timestamp" DESC);

-- Company departments list (managed in Product Catalog, feeds the employee form)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS departments JSONB;

-- Physical stock counts: a session collects scans (barcode/QR/manual) from any
-- signed-in device; closing it compares scans against the live inventory.
CREATE TABLE IF NOT EXISTS stock_counts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  summary         JSONB
);
CREATE TABLE IF NOT EXISTS stock_count_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id        UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  raw             TEXT NOT NULL,
  asset_id        UUID,
  asset_tag       TEXT,
  matched         BOOLEAN NOT NULL DEFAULT FALSE,
  scanned_by_name TEXT,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (count_id, raw)
);
CREATE INDEX IF NOT EXISTS idx_scans_count ON stock_count_scans (count_id, scanned_at DESC);

-- Mobile line (SIM / phone number) inventory — assignable to employees like
-- other zimmet types.
CREATE TABLE IF NOT EXISTS mobile_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number          TEXT NOT NULL UNIQUE,
  operator              TEXT,
  plan                  TEXT,
  sim_serial            TEXT,
  monthly_cost          NUMERIC(10, 2),
  status                TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Cancelled')),
  current_employee_id   UUID REFERENCES employees(id),
  current_employee_name TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lines_employee ON mobile_lines (current_employee_id);

-- Mobile line assign / take-back audit (feeds employee history timeline)
CREATE TABLE IF NOT EXISTS mobile_line_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id         UUID NOT NULL REFERENCES mobile_lines(id) ON DELETE CASCADE,
  phone_number    TEXT NOT NULL,
  employee_id     UUID,
  employee_name   TEXT,
  action_type     TEXT NOT NULL CHECK (action_type IN ('line_assigned', 'line_unassigned')),
  notes           TEXT NOT NULL DEFAULT '',
  changed_by      TEXT,
  changed_by_name TEXT,
  "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_line_history_employee ON mobile_line_history (employee_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_line_history_line ON mobile_line_history (line_id, "timestamp" DESC);

-- UI language default for the instance (per-browser override in localStorage)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_address TEXT;

-- Barcode/asset-label design: sizes (mm) + which fields to print
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS label_config JSONB;
