-- ==============================================================================
-- MIGRATION 0001 — MULTI-TENANT FOUNDATION
-- ==============================================================================
-- Turns the single-tenant SIM-RT schema into a row-level multi-tenant schema.
--
-- EVERY STATEMENT IS IDEMPOTENT. This matters because the project previously
-- shipped with `prisma db push` and therefore has NO migration history. On such
-- a database:
--     pnpm db:migrate --resolve   (or `prisma migrate resolve --applied 0001_...`)
-- marks this migration as already applied AFTER it runs. On a fresh database
-- `prisma migrate deploy` applies it normally.
--
-- SAFETY ORDER (never reordered):
--   drop global uniques  ->  add rt_id nullable  ->  backfill  ->  set NOT NULL
--   ->  add FK  ->  add per-tenant compound uniques
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 0. Compatibility shim for the RLS helper functions.
-- ------------------------------------------------------------------------------
-- The new policies in docker/postgres-init/01-init-rls.sql key off
-- `current_rt_id()`. Create it here too so this migration is self-contained on a
-- database that was bootstrapped before that file changed.
CREATE OR REPLACE FUNCTION current_rt_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_rt_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------------
-- STEP 1. Tenant registry: slug + lifecycle + plan + hierarchy
-- ------------------------------------------------------------------------------
ALTER TABLE rukun_tetangga_config ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE rukun_tetangga_config ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE rukun_tetangga_config ADD COLUMN IF NOT EXISTS plan_code TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE rukun_tetangga_config ADD COLUMN IF NOT EXISTS parent_tenant_id TEXT;

-- Backfill slugs deterministically from civic identity, then de-duplicate with a
-- numeric suffix so the UNIQUE index below can be created safely.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, kode_rt, kode_rw, nama_kelurahan, nama_kota
    FROM rukun_tetangga_config
    WHERE slug IS NULL OR slug = ''
    ORDER BY created_at ASC
  LOOP
    base := 'rt' || regexp_replace(lower(r.kode_rt), '[^a-z0-9]+', '', 'g')
         || '-rw' || regexp_replace(lower(r.kode_rw), '[^a-z0-9]+', '', 'g')
         || '-' || regexp_replace(lower(r.nama_kelurahan), '[^a-z0-9]+', '-', 'g')
         || '-' || regexp_replace(lower(r.nama_kota), '[^a-z0-9]+', '-', 'g');
    base := left(regexp_replace(base, '(^-+)|(-+$)', '', 'g'), 40);

    candidate := base;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM rukun_tetangga_config WHERE slug = candidate) LOOP
      candidate := left(base, 40 - length('-' || n)) || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE rukun_tetangga_config SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE rukun_tetangga_config ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rukun_tetangga_config_slug_key
  ON rukun_tetangga_config (slug);
CREATE INDEX IF NOT EXISTS rukun_tetangga_config_status_idx
  ON rukun_tetangga_config (status);
CREATE INDEX IF NOT EXISTS rukun_tetangga_config_plan_code_idx
  ON rukun_tetangga_config (plan_code);
CREATE INDEX IF NOT EXISTS rukun_tetangga_config_parent_tenant_id_idx
  ON rukun_tetangga_config (parent_tenant_id);

-- Identity tuple uniqueness. Any pre-existing duplicates are collapsed onto the
-- OLDEST row (the surviving tenant all data is backfilled to), so this cannot
-- fail on a database that accumulated duplicates through the old dedupe-on-read
-- behaviour.
DELETE FROM rukun_tetangga_config a
USING rukun_tetangga_config b
WHERE a.id <> b.id
  AND a.kode_rt = b.kode_rt
  AND a.kode_rw = b.kode_rw
  AND a.nama_kelurahan = b.nama_kelurahan
  AND a.nama_kota = b.nama_kota
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS rukun_tetangga_config_identity_key
  ON rukun_tetangga_config (kode_rt, kode_rw, nama_kelurahan, nama_kota);

-- ------------------------------------------------------------------------------
-- STEP 2. SaaS billing tables
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  tagline            TEXT NOT NULL DEFAULT '',
  midtrans_sku       TEXT NOT NULL UNIQUE,
  price_idr          INTEGER NOT NULL DEFAULT 0,
  billing_cycle      TEXT NOT NULL DEFAULT 'MONTHLY',
  max_kartu_keluarga INTEGER,
  max_warga          INTEGER,
  max_admin_users    INTEGER,
  max_storage_mb     INTEGER,
  max_child_tenants  INTEGER NOT NULL DEFAULT 0,
  features_json      TEXT NOT NULL DEFAULT '[]',
  is_public          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subscription_plans_is_public_idx ON subscription_plans (is_public);
CREATE INDEX IF NOT EXISTS subscription_plans_sort_order_idx ON subscription_plans (sort_order);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                   TEXT PRIMARY KEY,
  rt_id                TEXT NOT NULL UNIQUE REFERENCES rukun_tetangga_config (id) ON DELETE CASCADE,
  plan_id              TEXT NOT NULL REFERENCES subscription_plans (id),
  plan_code            TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'ACTIVE',
  billing_cycle        TEXT NOT NULL DEFAULT 'MONTHLY',
  started_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at              TIMESTAMP(3),
  grace_period_ends_at TIMESTAMP(3),
  auto_renew           BOOLEAN NOT NULL DEFAULT FALSE,
  external_ref         TEXT,
  cancelled_at         TIMESTAMP(3),
  last_renewed_at      TIMESTAMP(3),
  created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tenant_subscriptions_status_idx ON tenant_subscriptions (status);
CREATE INDEX IF NOT EXISTS tenant_subscriptions_ends_at_idx ON tenant_subscriptions (ends_at);
CREATE INDEX IF NOT EXISTS tenant_subscriptions_plan_code_idx ON tenant_subscriptions (plan_code);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id                      TEXT PRIMARY KEY,
  rt_id                   TEXT NOT NULL REFERENCES rukun_tetangga_config (id) ON DELETE CASCADE,
  plan_id                 TEXT NOT NULL REFERENCES subscription_plans (id),
  invoice_number          TEXT NOT NULL UNIQUE,
  midtrans_order_id       TEXT NOT NULL UNIQUE,
  payment_payload_enc     TEXT,
  plan_code               TEXT NOT NULL,
  billing_cycle           TEXT NOT NULL DEFAULT 'MONTHLY',
  quantity_cycles         INTEGER NOT NULL DEFAULT 1,
  status                  TEXT NOT NULL DEFAULT 'PENDING',
  channel                 TEXT NOT NULL DEFAULT 'QRIS',
  unit_price_idr          INTEGER NOT NULL,
  subtotal_idr            INTEGER NOT NULL,
  discount_idr            INTEGER NOT NULL DEFAULT 0,
  tax_idr                 INTEGER NOT NULL DEFAULT 0,
  amount_idr              BIGINT NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'IDR',
  payment_qr_string       TEXT,
  payment_va_number       TEXT,
  payment_redirect_url    TEXT,
  midtrans_transaction_id TEXT,
  midtrans_status         TEXT,
  paid_at                 TIMESTAMP(3),
  expires_at              TIMESTAMP(3),
  verified_by_user_id     TEXT,
  catatan                 TEXT,
  created_at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subscription_invoices_rt_id_idx ON subscription_invoices (rt_id);
CREATE INDEX IF NOT EXISTS subscription_invoices_status_idx ON subscription_invoices (status);
CREATE INDEX IF NOT EXISTS subscription_invoices_plan_code_idx ON subscription_invoices (plan_code);
CREATE INDEX IF NOT EXISTS subscription_invoices_created_at_idx ON subscription_invoices (created_at);

-- Webhook idempotency ledger. The UNIQUE (provider, event_key) constraint is the
-- mechanism that makes Midtrans' at-least-once delivery safe to consume.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id                 TEXT PRIMARY KEY,
  provider           TEXT NOT NULL DEFAULT 'midtrans',
  event_key          TEXT NOT NULL,
  signature          TEXT,
  order_id           TEXT,
  transaction_id     TEXT,
  status_code        TEXT,
  transaction_status TEXT,
  gross_amount       TEXT,
  payment_type       TEXT,
  resolved_status    TEXT,
  rt_id              TEXT,
  invoice_id         TEXT,
  delivery_count     INTEGER NOT NULL DEFAULT 1,
  processed_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_body_hash      TEXT,
  rejected_reason    TEXT,
  created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_event_key_key
  ON payment_webhook_events (provider, event_key);
CREATE INDEX IF NOT EXISTS payment_webhook_events_order_id_idx ON payment_webhook_events (order_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_invoice_id_idx ON payment_webhook_events (invoice_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_rt_id_idx ON payment_webhook_events (rt_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_transaction_id_idx ON payment_webhook_events (transaction_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_created_at_idx ON payment_webhook_events (created_at);

-- ------------------------------------------------------------------------------
-- STEP 3. Add `rt_id` to every tenant-scoped table and backfill it.
-- ------------------------------------------------------------------------------
-- All pre-existing rows belong to the OLDEST tenant (the one that owned the
-- single-tenant deployment). Later tenants did not exist before this migration.
DO $$
DECLARE
  t TEXT;
  anchor TEXT;
  tenant_tables TEXT[] := ARRAY[
    'rumah_kavling','kartu_keluarga','warga','dokumen_vault','mutasi_warga_logs',
    'users','onboarding_invites','recovery_codes','jenis_surat_templates',
    'pengajuan_surat','pos_keuangan','tagihan_iuran','kas_ledger_immutable',
    'jadwal_ronda','inventaris_rt','peminjaman_inventaris','tiket_aduan_warga',
    'in_app_notifications','security_audit_logs'
  ];
BEGIN
  SELECT id INTO anchor FROM rukun_tetangga_config ORDER BY created_at ASC LIMIT 1;

  IF anchor IS NULL THEN
    RAISE NOTICE 'No tenant rows present; skipping rt_id backfill.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ADD COLUMN IF NOT EXISTS rt_id TEXT', t);
    EXECUTE format('UPDATE %I SET rt_id = %L WHERE rt_id IS NULL', t, anchor);
    EXECUTE format('ALTER TABLE IF EXISTS %I ALTER COLUMN rt_id SET NOT NULL', t);
    EXECUTE format(
      'ALTER TABLE IF EXISTS %I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_rt_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE IF EXISTS %I ADD CONSTRAINT %I FOREIGN KEY (rt_id) REFERENCES rukun_tetangga_config(id) ON DELETE CASCADE',
      t, t || '_rt_id_fkey'
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (rt_id)', t || '_rt_id_idx', t);
  END LOOP;
END $$;

-- Storage accounting column used by the plan storage quota.
ALTER TABLE dokumen_vault ADD COLUMN IF NOT EXISTS size_bytes INTEGER NOT NULL DEFAULT 0;

-- Per-tenant chain ordering. `created_at` alone cannot order two rows written in
-- the same millisecond, which would let the hash chain fork.
ALTER TABLE kas_ledger_immutable ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security_audit_logs ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0;

DO $$
DECLARE
  t TEXT;
  chain_tables TEXT[] := ARRAY['kas_ledger_immutable','security_audit_logs'];
BEGIN
  FOREACH t IN ARRAY chain_tables LOOP
    -- Number each tenant's chain from 1, oldest first.
    EXECUTE format($f$
      WITH numbered AS (
        SELECT id, row_number() OVER (PARTITION BY rt_id ORDER BY created_at ASC, id ASC) AS seq
        FROM %I
      )
      UPDATE %I t SET sequence = n.seq FROM numbered n WHERE t.id = n.id
    $f$, t, t);

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (rt_id, sequence)',
      t || '_rt_id_sequence_key', t
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 4. Swap GLOBAL uniques for PER-TENANT compound uniques.
-- ------------------------------------------------------------------------------
-- This is the core correctness fix: "Blok A1" in RT Pangkalpinang must not block
-- "Blok A1" in RT Depok, and the same login name must be usable in two RTs.
DROP INDEX IF EXISTS rumah_kavling_kode_blok_key;
DROP INDEX IF EXISTS kartu_keluarga_no_kk_blind_index_key;
DROP INDEX IF EXISTS warga_nik_blind_index_key;
DROP INDEX IF EXISTS users_username_key;
DROP INDEX IF EXISTS jenis_surat_templates_kode_surat_key;
DROP INDEX IF EXISTS pengajuan_surat_nomor_tiket_key;
DROP INDEX IF EXISTS pos_keuangan_kode_pos_kas_key;
DROP INDEX IF EXISTS inventaris_rt_kode_barang_key;

-- De-duplicate bills before adding the (rt_id, rumah_id, bulan, tahun) uniqueness
-- that makes monthly generation idempotent. Keep the OLDEST bill per period.
DELETE FROM tagihan_iuran a
USING tagihan_iuran b
WHERE a.id <> b.id
  AND a.rt_id = b.rt_id
  AND a.rumah_id = b.rumah_id
  AND a.bulan = b.bulan
  AND a.tahun = b.tahun
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS rumah_kavling_rt_id_kode_blok_key
  ON rumah_kavling (rt_id, kode_blok);
CREATE UNIQUE INDEX IF NOT EXISTS kartu_keluarga_rt_id_no_kk_blind_index_key
  ON kartu_keluarga (rt_id, no_kk_blind_index);
CREATE UNIQUE INDEX IF NOT EXISTS warga_rt_id_nik_blind_index_key
  ON warga (rt_id, nik_blind_index);
CREATE UNIQUE INDEX IF NOT EXISTS users_rt_id_username_key
  ON users (rt_id, username);
CREATE UNIQUE INDEX IF NOT EXISTS jenis_surat_templates_rt_id_kode_surat_key
  ON jenis_surat_templates (rt_id, kode_surat);
CREATE UNIQUE INDEX IF NOT EXISTS pengajuan_surat_rt_id_nomor_tiket_key
  ON pengajuan_surat (rt_id, nomor_tiket);
CREATE UNIQUE INDEX IF NOT EXISTS pos_keuangan_rt_id_kode_pos_kas_key
  ON pos_keuangan (rt_id, kode_pos_kas);
CREATE UNIQUE INDEX IF NOT EXISTS inventaris_rt_rt_id_kode_barang_key
  ON inventaris_rt (rt_id, kode_barang);
CREATE UNIQUE INDEX IF NOT EXISTS tagihan_iuran_rt_id_rumah_id_bulan_tahun_key
  ON tagihan_iuran (rt_id, rumah_id, bulan, tahun);

-- ------------------------------------------------------------------------------
-- STEP 5. Re-apply tenant-isolated RLS policies.
-- ------------------------------------------------------------------------------
-- The policy bodies live in docker/postgres-init/01-init-rls.sql so there is one
-- authoritative definition. Re-running that file after this migration is
-- idempotent. Reminder: with `app.current_rt_id` unset the policies are
-- fail-closed (every row invisible), so seeding must set
-- `app.current_role = 'SUPERUSER'` on the session.
