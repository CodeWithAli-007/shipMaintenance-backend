# Shipping Maintenance API

Node.js + Express + TypeScript + PostgreSQL (TypeORM) backend for the Shipping Maintenance Communication Module.

## Stack

- Node.js 20+
- Express
- TypeScript (ESM) + decorators
- PostgreSQL 16
- TypeORM 0.3
- Zod env validation

## Quick start

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install deps (from backend/)
npm install

# 3. Configure env
cp .env.example .env
# Set POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

# 4. Run TypeORM migrations
npm run migrate

# 5. Seed dev users
npm run seed

# 6. Start API
npm run dev
```

API: `http://localhost:5000` (or the `PORT` in `.env`)  
Health: `http://localhost:5000/api/health`

## Dev auth

`POST /api/auth/login` with email and password. The response token is the user id and is sent as `Authorization: Bearer <token>`.

Demo password for every seeded account: `password`

| Role       | Email                      | Name            |
|------------|----------------------------|-----------------|
| ADMIN      | klaus.braun@ship.local       | Klaus Braun      |
| BACKOFFICE | emma.weber@ship.local         | Emma Weber       |
| BACKOFFICE | lena.schneider@ship.local    | Lena Schneider   |
| TECHNICIAN | thomas.berger@ship.local     | Thomas Berger    |
| TECHNICIAN | johannes.mueller@ship.local  | Johannes Müller  |
| TECHNICIAN | peter.hoffmann@ship.local    | Peter Hoffmann   |
| TECHNICIAN | daniel.schmidt@ship.local    | Daniel Schmidt   |
| TECHNICIAN | lukas.fischer@ship.local     | Lukas Fischer    |
| TECHNICIAN | anna.koch@ship.local         | Anna Koch        |

Admin signs in to `/admin` and manages Backoffice/Technician accounts only.

The web app lives in `../frontend` (`npm install` then `npm run dev`). It proxies `/api` to port 4000.

## Scripts

| Script                   | Description                          |
|--------------------------|--------------------------------------|
| `npm run dev`            | Watch mode via `tsx`                 |
| `npm run build`          | Compile to `dist/`                   |
| `npm start`              | Run compiled server                  |
| `npm run migrate`        | Run TypeORM migrations               |
| `npm run migration:revert` | Revert last migration              |
| `npm run migration:generate -- src/migrations/Name` | Generate migration from entity diff |
| `npm run seed`           | Seed development users               |
| `npm run typecheck`      | TypeScript check only                |

## Layout

```
src/
  entities/        # TypeORM entities (schema models)
  migrations/      # TypeORM migrations
  data-source.ts   # TypeORM DataSource
  db/
    database.ts    # init / health helpers
    seed.ts
  config/
  middleware/
  routes/
  services/
  app.ts
  index.ts
```

## Entities

`User`, `Client`, `Vessel`, `Team`, `TeamMember`, `Project`, `ProjectAssignment`, `ProjectMember`, `Finding`, `FindingUpdate`, `MediaAsset`, `FindingAttachment`, `FindingComment`

Authorization boundary: active rows in `project_members`.

## Example repository usage

```ts
import { AppDataSource } from './data-source.js';
import { Client } from './entities/Client.js';

const clients = AppDataSource.getRepository(Client);
const all = await clients.find({ where: { status: EntityStatus.ACTIVE } });
```
