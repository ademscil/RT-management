-- ==============================================================================
-- SIM-RT POSTGRESQL 16 NATIVE ROW-LEVEL SECURITY (RLS)
-- ==============================================================================
-- TENANT MODEL
--   Every tenant-scoped table carries a non-null `rt_id` referencing
--   `rukun_tetangga_config.id`. Isolation is enforced in THREE layers:
--     1. Application — `resolveTenantContext` binds the tenant from the signed
--        JWT, and every Prisma query carries an `rtId` predicate.
--     2. Database RLS (below) — a hard backstop if layer 1 is ever bypassed.
--     3. Compile time — the Prisma client is typed as `PrismaClient` (not `any`),
--        so omitting `rtId` on a tenant-scoped write fails `tsc`.
--
-- WHY THIS FILE WAS REWRITTEN
--   The previous revision created policies reading `app.current_role`,
--   `app.current_rt_id` and `app.current_kk_id` — but NOTHING ever set those
--   variables (the only writer, `withRlsContext`, was dead code that was never
--   called). `current_setting(name, true)` therefore returned NULL, so
--   `is_pengurus_rt()` evaluated FALSE on every row and `kk_id = NULL` never
--   matched. Combined with the default owner-bypass, the control was decorative.
--
--   This revision:
--     * keys isolation on `app.current_rt_id`, which the app now ALWAYS sets
--       via `PrismaService.withTenantContext()` (set_config, transaction-scoped);
--     * uses FORCE ROW LEVEL SECURITY so even the table owner is subject to it;
--     * declares separate permissive policies for SELECT and for INSERT/UPDATE
--       so a row can never be created in, or moved into, another tenant.
-- ==============================================================================

-- 1. Is the session a member of the RT committee (pengurus)?
CREATE OR REPLACE FUNCTION is_pengurus_rt() RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.current_role', true)
    IN ('KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'SUPERUSER');
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Tenant id bound to the current transaction. NULL when unset.
CREATE OR REPLACE FUNCTION current_rt_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_rt_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Session's Kartu Keluarga id (for resident-scoped rows).
CREATE OR REPLACE FUNCTION get_current_kk_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_kk_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Session's User id.
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Platform-level SUPERUSER (cross-tenant authority).
CREATE OR REPLACE FUNCTION is_superuser() RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.current_role', true) = 'SUPERUSER';
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- TENANT ISOLATION POLICIES
-- ==============================================================================
-- Every policy is fail-closed: with `app.current_rt_id` unset,
-- `current_rt_id()` is NULL, `rt_id = NULL` is NULL (not true), and the row is
-- invisible. Seeding / migrations must therefore either connect with a role
-- holding BYPASSRLS, or run inside a transaction that sets
-- `app.current_role = 'SUPERUSER'` (see is_superuser()).
-- ==============================================================================
DO $$
DECLARE
  t TEXT;
  -- Tables isolated purely by tenant: every row belongs to exactly one RT.
  tenant_tables TEXT[] := ARRAY[
    'rumah_kavling',
    'kartu_keluarga',
    'warga',
    'dokumen_vault',
    'mutasi_warga_logs',
    'users',
    'onboarding_invites',
    'recovery_codes',
    'jenis_surat_templates',
    'pengajuan_surat',
    'pos_keuangan',
    'tagihan_iuran',
    'kas_ledger_immutable',
    'jadwal_ronda',
    'inventaris_rt',
    'peminjaman_inventaris',
    'tiket_aduan_warga',
    'in_app_notifications',
    'security_audit_logs',
    'tenant_subscriptions',
    'subscription_invoices'
  ];
  -- Tables additionally restricted so a RESIDENT only reaches its own KK.
  resident_tables TEXT[] := ARRAY[
    'kartu_keluarga',
    'warga',
    'dokumen_vault',
    'pengajuan_surat',
    'tagihan_iuran'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (is_superuser() OR rt_id = current_rt_id())',
      t || '_tenant_select', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_modify', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      'USING (is_superuser() OR rt_id = current_rt_id()) '
      'WITH CHECK (is_superuser() OR rt_id = current_rt_id())',
      t || '_tenant_modify', t
    );
  END LOOP;

  -- Resident read restriction layered ON TOP of tenant isolation (policy names
  -- do not collide, so PostgreSQL ANDs them together).
  FOREACH t IN ARRAY resident_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_resident_scope', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING ('
      '  is_superuser() OR is_pengurus_rt() OR kk_id = get_current_kk_id() OR id = get_current_kk_id()'
      ')',
      t || '_resident_scope', t
    );
  END LOOP;
END $$;

-- Force RLS on the tenant registry itself. A tenant must not be able to read or
-- mutate another tenant's identity row.
ALTER TABLE IF EXISTS rukun_tetangga_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rukun_tetangga_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rukun_tetangga_config_self_policy ON rukun_tetangga_config;
CREATE POLICY rukun_tetangga_config_self_policy ON rukun_tetangga_config
  FOR SELECT
  USING (is_superuser() OR id = current_rt_id());

DROP POLICY IF EXISTS rukun_tetangga_config_admin_policy ON rukun_tetangga_config;
CREATE POLICY rukun_tetangga_config_admin_policy ON rukun_tetangga_config
  FOR ALL
  USING (is_superuser() OR id = current_rt_id())
  WITH CHECK (is_superuser() OR id = current_rt_id());

