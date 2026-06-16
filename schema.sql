-- Komuniti Kita Multi-Tenant Schema
-- Run with: wrangler d1 execute komuniti-kita --remote --file schema.sql

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Seed a default tenant for backward compatibility
INSERT OR IGNORE INTO tenants (id, name, slug, settings, created_at, updated_at)
VALUES ('default', 'Komuniti Kita', 'komuniti-kita', '{}', datetime('now'), datetime('now'));

-- ============================================================
-- TENANT INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_invites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  created_by TEXT,
  max_uses INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_code ON tenant_invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_tenant ON tenant_invites(tenant_id);

INSERT OR IGNORE INTO tenant_invites (id, tenant_id, code, description, created_by, created_at, updated_at)
VALUES ('default-invite', 'default', 'KOMUNITI', 'Default community invite', 'system', datetime('now'), datetime('now'));

-- ============================================================
-- PENDING APPROVALS (users requesting to join a tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_tenant ON pending_approvals(tenant_id, status);

-- ============================================================
-- USERS (now scoped per tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  username TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  status TEXT,
  role TEXT,
  password_hash TEXT,
  password_updated_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tenant_id, email)
);

-- ============================================================
-- ROLES (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  start_page TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tenant_id, name)
);

-- ============================================================
-- ROLE PERMISSIONS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  resource TEXT,
  can_create INTEGER,
  can_read INTEGER,
  can_update INTEGER,
  can_delete INTEGER,
  PRIMARY KEY (role_id, resource)
);

-- ============================================================
-- CHECKPOINTS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  created_at TEXT,
  updated_at TEXT
);

-- ============================================================
-- CHECK-IN LOGS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS check_in_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  checkpoint_id TEXT,
  user_id TEXT,
  checkpoint_name TEXT,
  user_name TEXT,
  timestamp TEXT,
  created_at TEXT
);

-- ============================================================
-- RESIDENTS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  house_no TEXT,
  house_type TEXT,
  owners TEXT DEFAULT '[]',
  vehicles TEXT DEFAULT '[]',
  owners_json TEXT DEFAULT '[]',
  vehicles_json TEXT DEFAULT '[]',
  created_at TEXT,
  updated_at TEXT
);

-- ============================================================
-- HOMESTAY CHECK-INS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS homestay_checkins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  homestay_id TEXT,
  person_in_charge TEXT,
  number_of_guests INTEGER,
  number_plates TEXT DEFAULT '[]',
  date_of_arrival TEXT,
  date_of_departure TEXT,
  additional_notes TEXT,
  submitted_at TEXT
);

-- ============================================================
-- PAYMENTS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  house_id TEXT,
  amount REAL,
  receipt_key TEXT,
  payment_date TEXT,
  status TEXT DEFAULT 'pending'
);

-- ============================================================
-- BILLING SETTINGS (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  frequency TEXT,
  rate REAL,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tenant_id, frequency)
);

-- ============================================================
-- BILLING SUMMARY CACHE (per-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_summary (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  house_id TEXT,
  house_no TEXT,
  frequency TEXT,
  year TEXT,
  month TEXT,
  amount_due REAL,
  amount_paid REAL,
  debit REAL,
  credit REAL,
  status TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tenant_id, house_id, frequency, year, month)
);
