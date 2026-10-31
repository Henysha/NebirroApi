# Merchant-centered first product

Extend this repository's NestJS modular monolith and React console. The first assisted pilot serves grain wholesalers and buyers around Ehil Berenda/Merkato, Addis Ababa. Keep the broader African network vision, but validate one dense trading cluster first.

## Implemented slice

1. An operator registers supplier and buyer profiles.
2. A supplier offer lists a grain variety, available whole kilograms, and ETB price/kg.
3. The operator records an agreement after both parties agree. Stock is reserved atomically, and the price is snapshotted. Retrying with the same request key returns the same agreement; changed content is rejected.
4. Before delivery, the buyer may submit one inventory financing application linked to that purchase. Requested funding cannot exceed its total. The supplier relationship is available through the trade/offer. No credit decision, payout, or lender sharing occurs.
5. The operator records delivery evidence.
6. After checking an external payment record, the operator records the exact full ETB amount, provider, unique payment reference, and verification evidence.
7. The trade becomes completed. Append-only API attestations retain the acting partner API-key ID, evidence, and timestamps. This is operator-attested history, not an independent payment guarantee or credit score.

The financing application's `SUBMITTED` status is an intake record only. Delivery and payment can be recorded independently of that application: this increment does not model a financed loan, claim lender approval, or infer repayment.

## Start the pilot locally

Use a local/test PostgreSQL database. Existing repository setup uses `prisma db push`, not a production migration history.

```sh
npm ci
npm run prisma:generate -w backend
# Start the repository's local PostgreSQL service:
docker compose up -d postgres
# Set DATABASE_URL as shown in .env.example.
npm run prisma:push -w backend
# Set a strong random MERCHANT_OPERATOR_KEY in the backend environment.
npm run dev -w backend
npm run dev -w frontend
```

For Docker backend development, set `MERCHANT_OPERATOR_KEY` in the root `.env` before starting the backend. Open `/merchant-network` in the frontend. Activate a partner API key in the existing console header and enter the operator credential in the workspace. It remains in component memory; it is not written to browser storage.

All `/api/merchant-network` endpoints require both `x-api-key` and `x-merchant-operator-key`. Missing operator configuration fails closed. The operator credential is a shared internal pilot gate, not individual merchant authentication or production RBAC. Partner identity is taken from the API key, never from request bodies. No records are shared between partner networks.

## API

| Method | Path under `/api/merchant-network` | Purpose |
| --- | --- | --- |
| GET | `/` | Up to 200 newest merchants, offers, trades and applications per category |
| POST | `/merchants` | `name`, `market`; country ET |
| POST | `/offers` | `merchantId`, `commodity`, `availableKg`, `pricePerKgMinor` |
| POST | `/trades` | `offerId`, `buyerId`, `quantityKg`, `requestKey` |
| POST | `/trades/:id/delivery` | `evidence`; AGREED → DELIVERED |
| POST | `/trades/:id/payment-verification` | `provider`, `reference`, `amountMinor`, `evidence`; DELIVERED → COMPLETED |
| POST | `/financing-requests` | `tradeId`, `amountMinor`, `purpose`; buyer derived from trade |

Money is integer ETB minor units (100 santim = 1 birr). Whole kg only in this pilot. Trade totals fit a PostgreSQL signed 32-bit integer. Provider codes and references use uppercase letters, numbers, hyphens and underscores. The UI normalizes case; the API rejects noncanonical references. A provider/reference pair can complete only one trade within a partner. This assumes a full payment per trade, not split payments.

No public edit/delete endpoints exist for agreements or evidence. Corrections, cancellation, stock release, disputes, partial delivery and partial payments require explicit workflows in a subsequent increment. Do not use this pilot with real credit or settlement obligations.

## Verification

```sh
npm test -w backend -- --runInBand
npm run build
# Only use a disposable database: existing integration tests delete records.
npm run test:integration -w backend
npm exec -w frontend -- playwright install chromium
npm run test:e2e -w frontend -- merchant-network.spec.ts
```

Database tests cover the full lifecycle, tenant isolation, fail-closed credentials, invalid state changes, duplicate references with rollback, atomic inventory reservation, financing limits and agreement retries. Browser tests mock HTTP and test screen wiring; they do not substitute for the PostgreSQL tests. CI runs the real database suite and the merchant browser tests.

## Next increments and launch gates

- Replace public legacy partner/key administration with authenticated operators and per-user roles. Legacy wallet and transfer routes remain demonstration infrastructure and are not used by this workflow.
- Harden existing wallet ownership and transfer idempotency/concurrency before connecting any money movement.
- Add individual merchant identities, buyer/seller consent and attestations, cancellation/disputes, paginated history and evidence access policy.
- Add supplier verification, lender-specific data-sharing consent, manual review, decision reasons and offer comparison. Then design supplier-direct payout and repayment reconciliation with a licensed partner.
- Validate this workflow with grain suppliers and their repeat buyers before adding integrations, tokens, wallets, cross-border settlement or blockchain dependencies.
