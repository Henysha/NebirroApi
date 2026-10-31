# Merchant-centered first product

Extend this repository's NestJS modular monolith and React console. The first assisted pilot targets grain wholesalers and buyers in Ethiopia, with the specific trading cluster to be selected during pilot validation. Keep the broader African network vision, but validate one dense trading cluster first.

## Implemented slice

1. An operator registers supplier and buyer profiles.
2. A supplier offer lists a grain variety, available whole kilograms, and ETB price/kg.
3. The operator records an agreement after both parties agree. Stock is reserved atomically, and the price is snapshotted. Retrying with the same request key returns the same agreement; changed content is rejected.
4. Before delivery, the buyer may submit one inventory financing application linked to that purchase. Requested funding cannot exceed its total. The supplier relationship is available through the trade/offer. The merchant can then authorize one lender to review the application through the separate financing portal.
5. The operator records delivery evidence.
6. After checking an external payment record, the operator records the exact full ETB amount, provider, unique payment reference, and verification evidence.
7. The trade becomes completed. Append-only API attestations retain the acting partner API-key ID, evidence, and timestamps. This is operator-attested history, not an independent payment guarantee or credit score.

The application progresses `SUBMITTED → UNDER_REVIEW → APPROVED | DECLINED` through explicit reviewer actions. This records a pilot review decision, not a binding loan contract or a disbursement. Delivery and payment remain independent trade records; they do not prove repayment.

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
npm run test:e2e -w frontend -- merchant-network.spec.ts financing-portal.spec.ts
```

Database tests cover the full lifecycle, tenant isolation, fail-closed credentials, invalid state changes, duplicate references with rollback, atomic inventory reservation, financing limits and agreement retries. Browser tests mock HTTP and test screen wiring; they do not substitute for the PostgreSQL tests. CI runs the real database suite and the merchant browser tests.

## Next increments and launch gates

- Replace public legacy partner/key administration with authenticated operators and per-user roles. Legacy wallet and transfer routes remain demonstration infrastructure and are not used by this workflow.
- Harden existing wallet ownership and transfer idempotency/concurrency before connecting any money movement.
- Replace operator-issued pilot credentials with production identity onboarding, MFA/recovery and individual reviewer accounts. Add buyer/seller attestations, cancellation/disputes, paginated history and an evidence access policy.
- Add offer comparison, full financing terms and acceptance. Then design supplier-direct payout and repayment reconciliation with a licensed partner.
- Validate this workflow with grain suppliers and their repeat buyers before adding integrations, tokens, wallets, cross-border settlement or blockchain dependencies.


## Merchant access, sharing and manual review

In `/merchant-network`, open **Access & review** to record a supplier verification (or withdraw one), register a pilot lender, issue recipient access, and revoke issued credentials. Operators must check the recipient's identity and lender relationship before handing over a code through a secure channel. Adding a lender record does not verify licensing.

Open `/financing-portal` as a merchant or institution reviewer. The portal is separate from the developer console and uses a bearer credential only; it does not send operator or partner keys.

- Each code contains 256 random bits, is stored only as a SHA-256 hash on the server, and expires after 24 hours. Issuing a replacement immediately invalidates the previous code for that merchant or institution. The browser retains codes only in memory. Issuance responses are marked `no-store`.
- Merchant credentials can read only their own financing applications and grant/withdraw consent. The pilot operator still records marketplace agreements and initial applications on the merchant's behalf.
- Reviewer credentials are scoped to one institution. They can see only its explicitly shared applications within the same partner network. They cannot grant merchant consent or use operator endpoints.
- `application-v1` consent shares only the application and decision fields, merchant business name/market, supplier name/market/verification status, and linked purchase grain/quantity/total/state. It excludes payment references, raw delivery/payment evidence, unrelated history and credential data. This is an application-specific scope, not consent to a full credit report.
- Only one institution can receive consent per application at a time. Before a final decision, withdrawal resets `UNDER_REVIEW` to `SUBMITTED`, allowing a new institution to be selected. After a decision, withdrawal removes further reviewer access while preserving the decision and audit record; it does not undo data already viewed. Consent persists until withdrawal and is independent of the code's 24-hour lifetime.
- Beginning review and approving require a currently verified supplier and an undelivered (`AGREED`) trade. Decisions require an explanation. Approval amounts must be positive and no higher than both the application and purchase total. Declines cannot carry an approval amount. Final decisions cannot be overwritten.
- Consent, withdrawal and review decisions serialize on the application row. Review checks serialize with supplier verification and delivery. Credential validity is rechecked inside mutation transactions. Audit events include the credential ID/version and a monotonic sequence; ordering does not rely on transaction-start timestamps.
- Read responses return up to 200 newest applications; refresh the portal to retrieve current access and sharing state. Withdrawal blocks subsequent authorized reads and writes; it cannot erase previously returned data from another browser.

### Additional API

Operator endpoints below require both existing operator headers:

| Method | Path under `/api/merchant-network` | Purpose |
| --- | --- | --- |
| POST | `/merchants/:id/verification` | `verified`, `evidence`; append verification history |
| GET / POST | `/lenders` | List / register institution (`name`) |
| POST | `/merchants/:id/access` | Issue or rotate 24-hour merchant code |
| POST | `/lenders/:id/access` | Issue or rotate 24-hour reviewer code |
| GET | `/access` | Credential metadata only; no hashes or plaintext |
| POST | `/access/:id/revoke` | Revoke subject access |

The following require `Authorization: Bearer <pilot code>` only:

| Method | Path under `/api/pilot` | Purpose |
| --- | --- | --- |
| GET | `/workspace` | Role-scoped application view and merchant lender choices |
| POST | `/applications/:id/consent` | Merchant: `lenderId`, `confirmed: true`, `scope: application-v1` |
| POST | `/applications/:id/withdraw` | Merchant: block further lender access |
| POST | `/applications/:id/review` | Reviewer: begin manual assessment |
| POST | `/applications/:id/decision` | Reviewer: `decision`, `reason`, `approvedAmountMinor` for approval |

This is pilot credential authentication, not proof of a person's legal identity, production sign-in, or a substitute for institutional underwriting. Each institution currently has one active reviewer credential; individual reviewer identity, MFA, recovery, production audit retention and rate limiting remain launch gates.
