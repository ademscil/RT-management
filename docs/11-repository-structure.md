# 11 Repository Structure & Monorepo Map

Dokumen ini memetakan seluruh direktori dan file penting di monorepo SIM-RT.

---

## 1. Peta Direktori Monorepo

```
d:\aplikasi\manajemen rt\
├── apps/
│   ├── admin-panel/             # Web SPA untuk Pengurus RT (React 19 + Vite)
│   │   ├── src/
│   │   │   ├── components/      # Layout (sidebar, header), AppLogo, dll.
│   │   │   ├── context/         # AuthContext, API client session
│   │   │   ├── pages/           # Dashboard, Kependudukan, Keuangan, Surat, Audit, Onboarding, Login
│   │   │   ├── services/        # ApiClient (GET, POST, PUT, DELETE)
│   │   │   └── App.tsx          # Root routing & tab navigation
│   │   └── package.json
│   │
│   ├── backend-api/             # Fastify REST Server & Business Engine
│   │   ├── prisma/              # Prisma schema & database migrations
│   │   ├── src/
│   │   │   ├── domain/          # Entities & Domain Models
│   │   │   ├── infrastructure/  # Crypto adapters (AES-GCM, HMAC, Ed25519, HashChain)
│   │   │   ├── presentation/    # Fastify routes (auth, kependudukan, keuangan, surat, audit)
│   │   │   └── tests/           # Vitest crypto & logic test suite
│   │   └── package.json
│   │
│   └── resident-mobile/         # Mobile App Warga (React 19 + Vite + Capacitor 6)
│       ├── android/             # Native Android project (Gradle, AndroidManifest)
│       ├── src/
│       │   ├── components/      # BottomNavigation, Scanner modals, Emergency drawer
│       │   ├── pages/           # Beranda, Keluarga, Surat, Iuran, Notifikasi, Aktivasi, Login
│       │   └── App.tsx          # Mobile view router & offline handler
│       └── capacitor.config.ts
│
├── packages/
│   ├── shared-types/            # Common TypeScript contracts, DTOs, Enums
│   │   └── src/index.ts
│   │
│   └── ui-kit/                  # Reusable enterprise UI library & design tokens
│       ├── src/
│       │   ├── components/      # Button, Badge, Card, PiiRevealModal, ForensicViewer, etc.
│       │   ├── notifications/   # Toast notification provider
│       │   └── styles.css       # Tailwind base, enterprise tokens, safe-area insets
│       └── package.json
│
├── docs/                        # Dokumentasi Baku Sistem (Numbered Documentation Suite)
│   ├── 00-project-context.md
│   ├── 01-full-project-audit.md
│   ├── 02-secure-programming-checklist-compliance.md
│   ├── 03-data-classification.md
│   ├── 07-testing-standard.md
│   ├── 09-project-memory.md
│   ├── 11-repository-structure.md
│   ├── 12-coding-standard.md
│   ├── 14-qa-standard.md
│   ├── 15-kependudukan-and-kavling-flow.md
│   ├── 16-keuangan-and-iuran-flow.md
│   ├── 17-surat-pelayanan-flow.md
│   └── 22-go-live-audit.md
│
├── release-apk/                 # Output binary APK Android terverifikasi
│   └── simrt-warga-v1.0.0-debug.apk
├── package.json                 # Monorepo root package.json
├── pnpm-workspace.yaml          # PNPM workspace definition
└── turbo.json                   # Turborepo task pipeline configuration
```
