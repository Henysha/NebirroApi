# NebirroAPI

NebirroAPI is a Stripe-style programmable financial infrastructure platform for trusted capital networks.

It demonstrates how partners can onboard, issue API keys, create customers, open wallets, fund balances, move value, inspect immutable ledgers, enforce idempotency, receive webhook events, and integrate through a TypeScript SDK.

## Strategic Positioning

NebirroAPI is not a payments app. It is programmable financial infrastructure for trusted capital networks: a developer-first API layer for platforms that need reliable money movement, ledger-derived balances, partner-scoped access, idempotent requests, and event-driven integrations.

The project is built as a portfolio-grade full-stack system showing backend architecture, financial domain modeling, REST API design, dashboard UX, SDK design, Dockerized infrastructure, and automated testing.

## Problem Statement

Modern capital platforms need more than a simple payment endpoint. They need infrastructure that can:

- Onboard trusted partners and isolate their data.
- Issue secure API keys for programmatic access.
- Model customers, wallets, transfers, and capital programs.
- Derive wallet balances from an immutable ledger.
- Prevent duplicate money movement from retries.
- Emit webhook events for downstream systems.
- Provide developers with clear docs, SDKs, and operational visibility.

NebirroAPI solves this as a compact but realistic infrastructure platform.

## Core Features

- Partner onboarding and API key issuance.
- Hashed API key authentication with plaintext keys returned once at creation.
- Partner-scoped customers and wallets.
- Wallet funding through ledger `CREDIT` entries.
- Wallet-to-wallet transfers through source `DEBIT` and destination `CREDIT` entries.
- Ledger-derived wallet balances instead of stored mutable balances.
- Idempotency keys for duplicate-safe transfer creation.
- Webhook endpoint and webhook event resources.
- Capital program resource foundation.
- Swagger/OpenAPI documentation.
- TypeScript SDK package for external developers.
- React developer dashboard for API operations.
- Jest unit tests, backend API integration tests, demo script, and Playwright E2E tests.

## Tech Stack

- Backend: Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Swagger/OpenAPI, Jest.
- Frontend: React, TypeScript, Vite, React Router, Axios, Tailwind CSS, Playwright.
- SDK: TypeScript package exposing a `NebirroApiClient`.
- Infrastructure: Docker Compose with PostgreSQL, backend, and frontend services.
- Testing: Jest unit tests, Supertest/Nest integration tests, Playwright browser E2E tests.

## Architecture Overview

```text
nebirro-api/
├─ backend/    NestJS API, Prisma schema, services, controllers, tests, demo script
├─ frontend/   React developer dashboard and Playwright E2E tests
├─ sdk/        TypeScript SDK for external integrations
└─ docker-compose.yml
```

The backend follows a service-layer architecture. Controllers keep HTTP concerns thin, while services own business rules such as funding, transfer validation, ledger writes, webhook event creation, and idempotency behavior.

The frontend is a developer infrastructure dashboard. It uses an active API key to operate against partner-scoped backend resources and persists selected local UI state such as the active API key and selected partner.

## Backend API Overview

Swagger is available at `http://localhost:3000/api/docs` when the backend is running.

Health:

- `GET /api/health`

Partners:

- `POST /api/partners`
- `GET /api/partners`
- `GET /api/partners/:id`

API Keys:

- `POST /api/partners/:partnerId/api-keys`
- `GET /api/partners/:partnerId/api-keys`

Customers:

- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/:id`

Wallets:

- `POST /api/wallets`
- `GET /api/wallets`
- `GET /api/wallets/:id`
- `GET /api/wallets/:id/balance`
- `GET /api/wallets/:id/ledger`
- `POST /api/wallets/:id/fund`

Capital Programs:

- `POST /api/capital-programs`
- `GET /api/capital-programs`
- `GET /api/capital-programs/:id`

Transfers:

- `POST /api/transfers`
- `GET /api/transfers`
- `GET /api/transfers/:id`

Webhooks:

- `POST /api/webhook-endpoints`
- `GET /api/webhook-endpoints`
- `GET /api/webhook-events`
- `POST /api/webhook-events/:id/retry`

## Ledger Model

NebirroAPI treats the ledger as the source of truth.

- Every wallet starts with balance `0`.
- Wallet balances are derived from ledger entries.
- Funding a wallet creates a `CREDIT` ledger entry.
- A wallet-to-wallet transfer creates a `DEBIT` entry on the source wallet and a `CREDIT` entry on the destination wallet.
- Transfers fail if the source wallet has insufficient funds.
- Ledger entries are append-only through the public API. There are no update or delete ledger endpoints.

This mirrors real financial infrastructure patterns where balances should be explainable from immutable transaction history.

## API Key Authentication

Partner-facing endpoints are protected with an `x-api-key` header.

API keys are:

- Generated as plaintext once during creation.
- Stored hashed in the database.
- Listed only by masked prefix and metadata.
- Scoped to the owning partner.

Example:

```bash
curl http://localhost:3000/api/customers \
  -H "x-api-key: nb_test_..."
```

## Idempotency Behavior

Transfer creation supports the `Idempotency-Key` header.

When a transfer request is repeated with the same idempotency key and same request body:

- The original transfer response is returned.
- No duplicate transfer is created.
- No duplicate ledger entries are created.

If the same key is reused with a different transfer request body, the API rejects the request.

## Webhook Event System

Every transfer creates a `WebhookEvent`.

Webhook events allow partner systems to react to financial state changes such as wallet funding or transfer completion. The MVP stores events and exposes listing/retry endpoints. Delivery workers and signed outbound delivery are natural future extensions.

## TypeScript SDK Overview

The `sdk/` package exposes a `NebirroApiClient` for external developers.

Supported methods include:

- `createPartner`
- `createCustomer`
- `createWallet`
- `fundWallet`
- `createTransfer`
- `getWalletBalance`
- `getWalletLedger`
- `listWebhookEvents`

Example:

```ts
import { NebirroApiClient } from '@nebirro/sdk';

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

## Frontend Dashboard Overview

The `frontend/` app is a clean developer infrastructure dashboard built with React, TypeScript, Vite, React Router, Axios, and Tailwind CSS.

Pages include:

- Dashboard summary cards for partners, customers, wallets, transfers, and webhook events.
- Partners page for listing and creating partners.
- API Keys page for issuing keys, viewing masked keys, and activating a key locally.
- Customers page for partner-scoped customer management.
- Wallets page for wallet creation, funding, balance inspection, and wallet ledger review.
- Transfers page for wallet-to-wallet movement with idempotency key support.
- Ledger page for consolidated `CREDIT` and `DEBIT` ledger entries.
- Webhook Events page for event listing and retry.
- Developer SDK page with TypeScript usage snippets.

The dashboard persists the active API key in localStorage and restores it on app load. Newly generated plaintext keys are not persisted unless the user explicitly sets them as the active API key.

## Automated Testing

NebirroAPI includes multiple testing layers.

Unit tests:

- Service-level tests for wallet funding, derived balances, transfers, insufficient funds, idempotency, webhook event creation, and API key authentication.

Integration tests:

- NestJS/Supertest API tests that boot the app, sync Prisma schema, clean test data, and exercise the full backend flow.

Demo flow script:

- Calls the running local API and prints a portfolio-friendly walkthrough of partner creation, API key issuance, customers, wallets, funding, transfer, ledger entries, webhooks, and idempotency.

Playwright E2E frontend test:

- Runs the React dashboard in a browser and automates the full programmable infrastructure flow through the UI.

## Running Locally

Install dependencies:

```bash
npm install
```

Copy environment examples:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

On Windows PowerShell:

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
```

## Run Backend With Docker

Start PostgreSQL and the backend:

```bash
docker compose up -d postgres backend
```

Apply Prisma migrations when developing locally:

```bash
npm run prisma:migrate -w backend
```

Useful backend URLs:

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`

## Run Frontend

Start the dashboard:

```bash
npm run dev -w frontend
```

Open:

- `http://localhost:5173`

## Run Tests

Backend unit tests:

```bash
npm test -w backend
```

Backend API integration tests:

```bash
docker compose up -d postgres
npm run test:integration -w backend
```

Frontend build:

```bash
npm run build -w frontend
```

SDK build:

```bash
npm run build -w sdk
```

## Run Demo Script

Start the API:

```bash
docker compose up -d postgres backend
```

Run the portfolio demo:

```bash
npm run demo:flow -w backend
```

The script demonstrates:

1. Partner creation.
2. API key creation.
3. Customer creation.
4. Wallet creation.
5. Wallet funding.
6. Wallet-to-wallet transfer.
7. Ledger debit/credit inspection.
8. Webhook event creation.
9. Idempotency preventing duplicate transfer creation.

## Run Playwright E2E Tests

Start the backend:

```bash
docker compose up -d postgres backend
```

Install Playwright Chromium if needed:

```bash
npm exec -w frontend -- playwright install chromium
```

Run browser E2E tests:

```bash
npm run test:e2e -w frontend
```

Headed and UI modes:

```bash
npm run test:e2e:headed -w frontend
npm run test:e2e:ui -w frontend
```

## Screenshots

Add screenshots under `docs/screenshots/` for portfolio presentation:

- `docs/screenshots/dashboard.png`
- `docs/screenshots/api-keys.png`
- `docs/screenshots/wallets.png`
- `docs/screenshots/ledger.png`
- `docs/screenshots/webhooks.png`
- `docs/screenshots/playwright-e2e.png`

Example Markdown:

```md
![NebirroAPI dashboard](docs/screenshots/dashboard.png)
![Wallet funding and balance](docs/screenshots/wallets.png)
![Ledger entries](docs/screenshots/ledger.png)
```

## Demo Flow

The core NebirroAPI flow:

1. A partner signs up.
2. The partner receives an API key.
3. The partner creates customers.
4. The partner creates wallets for those customers.
5. Wallet A is funded, creating a `CREDIT` ledger entry.
6. Value moves from Wallet A to Wallet B, creating a source `DEBIT` and destination `CREDIT`.
7. Balances are derived from ledger history.
8. A webhook event is created for the transfer.
9. Retrying the same transfer with the same idempotency key returns the original transfer and creates no duplicate ledger entries.

## Future Improvements

- Signed outbound webhook delivery with retries and exponential backoff.
- Role-based dashboard auth for operators.
- More complete capital program workflows.
- Multi-currency constraints and FX handling.
- Ledger reconciliation reports.
- Pagination and filtering for high-volume resources.
- Production-grade secret management and key rotation.
- CI pipeline with Dockerized integration and Playwright tests.
- Published SDK package with generated API types.

## Portfolio / Resume Bullet

Built NebirroAPI, a Stripe-style programmable financial infrastructure platform using NestJS, TypeScript, PostgreSQL, Prisma, Docker, API key authentication, ledger-derived balances, idempotent transfers, webhook events, a TypeScript SDK, a React/TypeScript developer dashboard, Jest integration testing, and Playwright browser E2E coverage.
