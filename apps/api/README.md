# API App

NestJS backend API for the Electronics Inventory Management System.

Planned stack:

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- JWT or Cognito authentication

## Prisma

Copy `.env.example` to `.env` and update `DATABASE_URL`, then run:

```bash
npm --workspace apps/api run prisma:generate
npm --workspace apps/api run prisma:migrate:dev
npm --workspace apps/api run db:seed
```

Seed users:

```text
admin@stockflow.local / Admin@123
manager@stockflow.local / Manager@123
```
