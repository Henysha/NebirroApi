# NebirroAPI

NebirroAPI is programmable financial infrastructure for trusted capital networks.

It is designed as a portfolio-grade, Stripe-style developer API that lets partners create
customers, issue wallets, fund accounts, move value, inspect immutable ledger entries, enforce
idempotency, and receive webhook events.

## Monorepo Structure

- `backend`: NestJS, TypeScript, Prisma, PostgreSQL, Swagger/OpenAPI, and Jest.
- `frontend`: React, TypeScript, Vite, React Router, Axios, and Tailwind CSS.
- `sdk`: TypeScript SDK for external developers integrating with NebirroAPI.
- `docker-compose.yml`: PostgreSQL, backend, and frontend services for local development.

## Core Domain

NebirroAPI models partners, API keys, customers, financial accounts, wallets, ledger entries,
transfers, capital programs, webhook endpoints, webhook events, and idempotency keys.

Balances are derived from append-only ledger entries. Funding creates a `CREDIT`, wallet-to-wallet
movement creates a source `DEBIT` and destination `CREDIT`, and transfer creation emits a webhook
event. Duplicate transfer requests using the same `Idempotency-Key` are designed to return the
original response instead of creating a duplicate transfer.

## API Surface

Health:

- `GET /api/health`

Partners:

- `POST /api/partners`
- `GET /api/partners`
- `GET /api/partners/{id}`

API Keys:

- `POST /api/partners/{partnerId}/api-keys`
- `GET /api/partners/{partnerId}/api-keys`

Partner-facing endpoints are protected with the `x-api-key` header:

- Customers: `/api/customers`
- Wallets: `/api/wallets`, `/api/wallets/{id}/fund`
- Capital Programs: `/api/capital-programs`
- Transfers: `/api/transfers`
- Webhooks: `/api/webhook-endpoints`, `/api/webhook-events`

Swagger documentation is available at `/api/docs` when the backend is running.

## Getting Started

Install dependencies:

```bash
npm install
cp .env.example .env
cp backend/.env.example backend/.env
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Run Prisma migrations:

```bash
npm run prisma:migrate -w backend
```

Start the backend:

```bash
npm run start:dev -w backend
```

Run backend unit tests:

```bash
npm test -w backend
```

Run backend API/integration tests against local Postgres:

```bash
docker compose up -d postgres
npm run test:integration -w backend
```

The integration runner applies the Prisma schema with `prisma db push`, generates the Prisma client,
boots the Nest application in memory, and cleans API test data between cases.

Run the portfolio demo flow against the local API:

```bash
docker compose up -d postgres backend
npm run demo:flow -w backend
```

The demo creates a partner, issues an API key, creates customers and wallets, funds a wallet,
executes an idempotent wallet-to-wallet transfer, prints ledger entries and balances, lists webhook
events, and confirms the duplicate transfer request is prevented.

Local services:

- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

## SDK Example

```ts
import { NebirroApiClient } from '@nebirro/sdk';

const onboarding = new NebirroApiClient({
  baseUrl: 'http://localhost:3000/api',
});

const partner = await onboarding.createPartner({
  name: 'Trusted Capital Operator',
  email: 'operator@example.com',
});

// Create an API key through POST /api/partners/:partnerId/api-keys, then use it once returned.
const client = new NebirroApiClient({
  apiKey: 'nb_test_...',
  baseUrl: 'http://localhost:3000/api',
});

const customer = await client.createCustomer({
  email: 'operator@example.com',
  name: 'Trusted Capital Operator',
});

const wallet = await client.createWallet({
  customerId: customer.id,
  name: 'Operating Wallet',
  currency: 'USD',
});

await client.fundWallet({
  walletId: wallet.id,
  amount: 10000,
  currency: 'USD',
  idempotencyKey: 'fund-wallet-001',
});

const balance = await client.getWalletBalance(wallet.id);
```

## Developer Commands

```bash
npm run prisma:generate -w backend
npm run build -w backend
npm run build -w sdk
npm test -w backend
```
