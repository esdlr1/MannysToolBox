# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Manny's ToolBox is a Next.js 14 (App Router) construction industry platform with TypeScript, Prisma ORM, PostgreSQL, and NextAuth authentication. See `package.json` for available scripts.

### Services

| Service | Command | Notes |
|---------|---------|-------|
| Next.js dev server | `npm run dev` | Runs on port 3000 |
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | Must be running before dev server or Prisma commands |
| Prisma Studio | `npm run db:studio` | DB browser on port 5555 |

### Key commands

- **Lint**: `npm run lint` (pre-existing lint errors exist in the codebase)
- **Build**: `npm run build` (currently fails due to pre-existing unescaped entity lint errors; `next dev` works fine)
- **Dev**: `npm run dev`
- **DB schema push**: `npm run db:push`
- **Generate Prisma client**: `npm run db:generate`
- **Create super admin**: `npm run init:admin`

### Non-obvious caveats

- **Production build fails**: `npm run build` fails due to pre-existing `react/no-unescaped-entities` ESLint errors in several files. The dev server (`npm run dev`) is unaffected.
- **PostgreSQL must be started manually**: Run `sudo pg_ctlcluster 16 main start` before any Prisma or dev server commands.
- **ESLint config**: The `.eslintrc.json` file with `next/core-web-vitals` must exist for `npm run lint` to run non-interactively.
- **Super admin credentials** (dev only): Email `enmaeladio@gmail.com`, password `En220193` (from `scripts/init-super-admin.ts`).
- **AI features** (OpenAI) and **email** (Resend) require API keys in `.env` — they are optional for core functionality.
- **Environment file**: Copy `.env.example` to `.env` and configure `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` at minimum.
