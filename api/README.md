# NestJS Backend (DEPRECATED / UNUSED)

> **Status: This directory is currently unused.**
> All API logic lives in Next.js API Routes (`src/app/api/`).

This was an initial scaffold for a separate NestJS backend.
The decision was made to consolidate all server-side logic
into the Next.js monolith for simplicity during the MVP phase.

## What to do

- **Option A (recommended for MVP):** Delete this directory entirely.
  All business logic, auth, and service layers are fully implemented
  in `src/lib/services/` and `src/app/api/`.

- **Option B (future):** If the project outgrows Next.js API Routes
  and needs a dedicated backend (e.g., for background jobs, WebSocket,
  or heavy compute), this NestJS scaffold can be revived.

## If reviving

1. Move business services from `src/lib/services/` to NestJS modules
2. Integrate SuperTokens session verification in NestJS middleware
3. Share Prisma schema between Next.js and NestJS
4. Set up proper NestJS modules per domain (CRM, Settings, etc.)
