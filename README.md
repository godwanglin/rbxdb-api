# Riwayat Pembelian Robux

## Implemented

Next.js App Router API, TypeScript, Prisma/MySQL, Roblox receipt audit bridge, and Roblox Admin Purchases.

- POST /api/v1/purchases: signed, verified receipt snapshots only, one row per purchaseId.
- GET /api/v1/purchases: signed history query.
- GET /api/v1/purchases/:purchaseId: signed detail.
- GET /api/health: database availability, no credential output.
- No web UI or API command for compensation.
- Admin Gift & Resync retries the existing receipt-backed Shop.received/claim path. It cannot grant twice or use generic gifts for unmapped products.

## Setup

Requirements: Node.js 22.12+ (tested on 24.21), MySQL, HTTPS deployment.

From this directory:

```powershell
npm ci
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
# Set DATABASE_URL and the shared server HMAC secret in .env.
npm run prisma:generate
npm run prisma:validate
npm run prisma:push
npm run typecheck
npm test
npm run build
npm start
```

The local .env already contains the supplied database configuration and generated HMAC secret. It is ignored by Git. Never print it, commit it, or copy it to client/browser code.

Production target: https://rtdb-rbxsim01.weebinhub.biz.id. Production listener: `127.0.0.1:3876`.

The target was not active during implementation; local build and real MySQL were tested. Deployment, TLS, and a real paid production receipt remain separate validation steps.

### VPS deployment

Clone `https://github.com/godwanglin/rbxdb-api.git` into its own application directory. Run `bash deploy.sh` from that checkout with Node.js 22.12+, npm, PM2, curl, and flock installed. Missing `.env` is created privately from `.env.example`; deployment then stops until private database/HMAC values are configured. Existing `.env` is never overwritten or executed as shell code.

The script installs locked dependencies, validates Prisma, builds, typechecks, runs unit tests, and starts/restarts only PM2 `rbxdb-api` through `ecosystem.config.cjs` on `127.0.0.1:3876`. `aidev-gateway` is never touched. For initial database setup only, use `DB_PUSH=1 bash deploy.sh`; destructive schema changes are not automatically accepted. Integration/contract tests must be run separately against a test database, not during production deployment.

Update the checkout with `git pull --ff-only` before subsequent deployments. Configure HTTPS reverse proxy for the production hostname to `http://127.0.0.1:3876`. `pm2 save` persists the application list after a healthy start; configure `pm2 startup` separately for server reboot recovery. Build failure stops deployment before the PM2 restart; in-place deployments do not provide zero-downtime rollback.

Roblox server configuration:

- ServerScriptService.MarketServer.Shop.PurchaseHistoryConfig owns BaseUrl, KeyId, Timeout (8 seconds).
- ServerStorage.MarketPurchaseHistorySecret is a StringValue with the same value as RBX_API_SECRET.
- It is configured in live Studio, excluded from source/Rojo mapping, and must remain server-only.
- HTTP requests are enabled in the current place.
- Creator Hub GetSecret returns an opaque value; it cannot be read by the Luau SHA256 signer. The HMAC secret is therefore server deployment configuration, not a replicated module or literal script.
- Publish the place with its server-only configuration when deploying. Protect access to the place and database credentials.

## Authentication

All purchases routes require these headers:

| Header | Value |
| --- | --- |
| x-rbx-key-id | RBX_API_KEY_ID (default roblox) |
| x-rbx-timestamp | Unix seconds |
| x-rbx-nonce | New UUID without braces for each HTTP attempt |
| x-rbx-signature | Lowercase HMAC-SHA256 hex |

Sign UTF-8 bytes of these six lines with RBX_API_SECRET as an ASCII string:

```text
v1
METHOD
exact pathname plus query string
timestamp
nonce
SHA256(raw request body) in lowercase hex
```

There is no final newline. GET uses an empty body. The nonce is persisted to reject replay across API workers; timestamp skew is bounded to at most 300 seconds. A delivery retry must use a fresh nonce/signature and the same purchaseId.

HMAC authenticates the trusted Roblox server; the API does not independently contact Roblox to re-verify payment. Only ProcessReceipt initiates audit records, never PromptProductPurchaseFinished.

## Data and response

Payment status is VERIFIED only. Grant statuses: APPLIED, PENDING, FAILED, UNKNOWN_PRODUCT.

Identifiers are serialized as decimal strings in responses to preserve numeric precision. Dates are UTC ISO strings.

```json
{"status":"success","data":{},"error":null,"meta":{"requestId":"..."}}
```

```json
{"status":"error","data":null,"error":{"code":"VALIDATION_ERROR","message":"..."},"meta":{"requestId":"..."}}
```

Payloads include buyer, product/item, CurrencySpent as robux, store/beneficiary, grant result/attempts/errors, receipt/process/completion dates, universe/place/job.

Upsert runs in a short serializable transaction with bounded conflict retries. PurchaseId/userId/productId/robux identity is immutable. APPLIED is terminal; older pending attempts cannot replace newer state. No timeline table exists.

PurchaseNonce and ApiRateBucket are technical guards only. Expired guard records are pruned during authenticated traffic.

## Query

GET query parameters:

- days: 1, 7, 14, 30 (or from/to ISO datetime; do not combine).
- page: 1..10000; pageSize: 1..100, default 15.
- search: @username, DisplayName, UserId, item ID/name, max 120 characters.
- user, item: optional specific search filters.
- category: exact category.
- grantStatus: APPLIED/PENDING/FAILED/UNKNOWN_PRODUCT.

Filters combine with AND; search matches the listed fields with OR. Response data: items, total, page, pageSize. Offset pagination is intentionally bounded.

POST body limit: 128 KiB UTF-8, 10-second read deadline. JSON content-type required. Per API worker unauthenticated work is bounded to 1200 requests/minute; the authenticated key has a shared database-backed 600 requests/minute limit. 429 includes Retry-After. Use a reverse proxy request/connection limit for deployment.

## Roblox delivery and compensation

Receipt grant decisions remain independent from the API. The existing receipt journal/inbox owns grant durability and ShopAppliedGrants owns idempotency.

- Completed grants and meaningful pending/failed transitions queue snapshot asynchronously.
- ShopHistoryOutbox_v1 stores pending snapshots with revisions.
- ShopHistoryDue_v1 indexes due retries, bounded 20 rows per sweep.
- Backoff with jitter is bounded to 30 minutes, plus a 60-second HTTP circuit after failure.
- Slow bounded journal/outbox fallback repairs a crash before the due index is written.
- Prompt cancellation does not POST history.
- Unknown product produces an audit snapshot and returns NotProcessedYet, retaining Roblox retry semantics.
- Receipt recovery can apply pending claims on rejoin without external API availability.

Gift & Resync uses the existing permission and confirmation flow: single-use token, 120-second expiry, permission recheck after journal reads, verified persisted receipt and product mapping check. Unsupported products and already-applied purchases are disabled. A pending target remains pending until the correct store/recipient is available; this is not a generic force-grant.

## Evidence

See TEST_RESULTS.md for performed tests and remaining deployment limits.
