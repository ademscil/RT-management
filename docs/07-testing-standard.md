# 07 Testing Standard & Quality Assurance

Dokumen ini menjadi acuan baku pengujian sistem di monorepo SIM-RT.

---

## 1. Strategi Pengujian (Test Pyramid)

```
       ▲
      / \     E2E / Mobile APK Smoke Test
     /   \    (Capacitor Android build & flow testing)
    /-----\
   /       \   Integration Tests & API Contracts
  /         \  (Fastify inject, Route guard, Role RBAC)
 /-----------\
/             \ Unit & Crypto Tests (Vitest)
/---------------\ (AES-256-GCM, HMAC, Hash-Chain, Pagination)
```

---

## 2. Unit & Kriptografi Test Suite (`apps/backend-api/src/tests`)

Setiap perubahan pada logika enkripsi, blind indexing, atau audit logging wajib diverifikasi melalui test suite otomatis:

1. **`crypto.test.ts`**:
   - Memastikan enkripsi teks acak menghasilkan ciphertext yang dapat didekripsi kembali ke nilai asli.
   - Memastikan manipulasi 1 bit pada ciphertext menyebabkan dekripsi gagal (`Error: Unsupported state or unable to authenticate data`).
2. **`blind-index.test.ts`**:
   - Memastikan komputasi blind index bersifat deterministik: string input yang sama selalu menghasilkan indeks HMAC-SHA256 yang sama.
   - Memastikan masking NIK mempertahankan prefix wilayah 4 digit pertama dan 4 digit terakhir, menyamarkan 8 digit tengah.
3. **`hash-chain.test.ts`**:
   - Memverifikasi pembuatan rantai blok log audit.
   - Memastikan fungsi verifikasi rantai (`verifyChain()`) mendeteksi anomali jika entri sebelumnya dimodifikasi.
4. **`ed25519.test.ts`**:
   - Memastikan pasangan kunci Ed25519 dapat menandatangani hash payload e-surat dan tanda tangan tersebut valid saat diverifikasi dengan public key.
5. **`pagination.test.ts`**:
   - Memverifikasi kalkulasi `page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, `hasPrevPage`.

Perintah eksekusi:
```bash
npm test
```

---

## 3. Verifikasi Kompilasi & Build Monorepo

Sebelum kode di-commit ke Git:
```bash
npm run build
```
Seluruh 5 paket harus berstatus `SUCCESS`:
- `@simrt/shared-types:build`
- `@simrt/ui-kit:build`
- `backend-api:build`
- `admin-panel:build`
- `resident-mobile:build`

---

## 4. Android APK Verification Checklist

Untuk menguji binary mobile:
1. Sinkronisasi aset web ke folder native Android:
   ```bash
   pnpm --filter resident-mobile exec cap sync android
   ```
2. Kompilasi debug APK via Gradle Wrapper:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
   $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
   $env:ANDROID_HOME = "C:\Users\adam.cid00676\AppData\Local\Android\Sdk"
   .\apps\resident-mobile\android\gradlew.bat -p apps\resident-mobile\android assembleDebug
   ```
3. Verifikasi file output di `release-apk/simrt-warga-v1.0.0-debug.apk`.

