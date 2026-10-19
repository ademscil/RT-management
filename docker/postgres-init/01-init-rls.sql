-- ==============================================================================
-- SIM-RT POSTGRESQL 16 NATIVE ROW-LEVEL SECURITY (RLS) & AUDIT POLICIES
-- ==============================================================================

-- 1. Function helper to check if current actor is Pengurus RT
CREATE OR REPLACE FUNCTION is_pengurus_rt() RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.current_role', true) IN ('KETUA_RT', 'SEKRETARIS', 'BENDAHARA');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function helper to get current session's KK ID
CREATE OR REPLACE FUNCTION get_current_kk_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_kk_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function helper to get current session's User ID
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row-Level Security on sensitive tables
ALTER TABLE IF EXISTS kartu_keluarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS warga ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dokumen_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pengajuan_surat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tagihan_iuran ENABLE ROW LEVEL SECURITY;

-- KARTU KELUARGA POLICIES
DROP POLICY IF EXISTS kk_isolation_policy ON kartu_keluarga;
CREATE POLICY kk_isolation_policy ON kartu_keluarga
  FOR ALL
  USING (
    is_pengurus_rt() OR id = get_current_kk_id()
  );

-- WARGA POLICIES
DROP POLICY IF EXISTS warga_isolation_policy ON warga;
CREATE POLICY warga_isolation_policy ON warga
  FOR ALL
  USING (
    is_pengurus_rt() OR kk_id = get_current_kk_id()
  );

-- DOKUMEN VAULT POLICIES
DROP POLICY IF EXISTS dokumen_vault_isolation_policy ON dokumen_vault;
CREATE POLICY dokumen_vault_isolation_policy ON dokumen_vault
  FOR ALL
  USING (
    is_pengurus_rt() OR kk_id = get_current_kk_id()
  );

-- PENGAJUAN SURAT POLICIES
DROP POLICY IF EXISTS pengajuan_surat_isolation_policy ON pengajuan_surat;
CREATE POLICY pengajuan_surat_isolation_policy ON pengajuan_surat
  FOR ALL
  USING (
    is_pengurus_rt() OR kk_id = get_current_kk_id()
  );

-- TAGIHAN IURAN POLICIES
DROP POLICY IF EXISTS tagihan_iuran_isolation_policy ON tagihan_iuran;
CREATE POLICY tagihan_iuran_isolation_policy ON tagihan_iuran
  FOR ALL
  USING (
    is_pengurus_rt() OR kk_id = get_current_kk_id()
  );

