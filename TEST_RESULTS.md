# Purchase History — Verification Results

## Completed implementation

- Next.js App Router API with Prisma/MySQL and consistent response envelopes.
- Signed receipt snapshot upsert, filtered list, transaction detail, and database health endpoints.
- Roblox server receipt audit bridge, durable retry outbox, and purchase-backed Admin Gift & Resync.
- One history row per PurchaseId. Canceled prompts do not create history.
- Production target configured: https://rtdb-rbxsim01.weebinhub.biz.id.
- Protected Next.js/Tailwind web dashboard; no external gifting command or Roblox DataStore write endpoint.

## Performed checks

| Check | Result | Scope |
| --- | --- | --- |
| API + web test suite | 69/69 passed, 10 files | Unit, integration against MySQL, route contracts |
| TypeScript | Passed | `npm run typecheck` |
| Next.js production build | Passed | `npm run build` |
| Prisma | Passed | Validate, generate, and requested `db push` to the supplied database |
| Dependency audit | 0 reported vulnerabilities | Installed dependency audit at implementation time |
| Production build HTTP health | HTTP 200, database available | Local running Next.js production build |
| Luau-to-Next.js handshake | POST 200, APPLIED; replay 401 | Actual Luau snapshot/signature against the local production build |
| Roblox isolated bridge checks | 30 passed | `PurchaseHistoryBridge.spec.luau` |
| Roblox isolated receipt checks | 18 passed | `ShopServerHistory.spec.luau` |
| Roblox isolated Admin checks | 15 passed | `AdminPurchases.spec.luau` |
| Roblox isolated ledger checks | 13 passed | `DataPurchaseLedger.spec.luau` |
| Admin UI fixture | Passed | Table, detail, and dropdown construction/lifecycle |
| Live Studio syntax | 17/17 passed | Changed purchase/Admin modules and scripts |
| Live/mirror source comparison | 17/17 matched | Normalized line endings and trailing whitespace |
| Active Rojo mappings | All referenced paths exist | Current `default.project.json` |
| Secret configuration | Present, server-only; `.env` ignored | Values were not printed in verification output |

The final API test rerun passed all 57 tests. The final live compile and source comparison also passed. The 76 Roblox assertions use isolated fixtures with **zero production DataStore writes and zero HTTP requests**. The separate signed HTTP handshake used a synthetic transaction.

## Covered behavior

- HMAC valid/invalid/expired/future/replayed signatures and body tampering.
- Validation, all grant statuses, filters, pagination, literal injection/search inputs, and stable error responses.
- Duplicate PurchaseId, concurrent requests, immutable payment identity, stale snapshots, and terminal APPLIED status.
- APPLIED enrichment preserves confirmed destination and never lowers grant attempts.
- Body size/read deadline guards, request limits, health success/failure, and request IDs.
- Receipt success, pending beneficiary/store, grant failure, unknown product, and canceled prompt exclusion.
- API outage cannot change the Roblox grant decision.
- Repeated recovery diagnostics do not repeatedly increase attempts.
- Admin permission checks, expiring single-use confirmation, persisted receipt validation, and purchase idempotency.
- Unsupported or already applied purchases cannot be granted through a generic gift path.

## Cleanup

Synthetic purchase rows and signature nonce fixtures were removed by exact unique test identifiers. Guard rate buckets expire through the configured cleanup. Temporary handshake files were removed and local Next.js servers were stopped. Studio remains in Edit mode.

## Remaining deployment validation

The production domain was not active during this work. The following are **not yet verified**:

1. Production hosting, DNS/TLS, reverse proxy request limits, and endpoint reachability from a published Roblox server.
2. A real paid production Robux receipt and its subsequent appearance in Purchases.
3. Full Play-mode Admin flow and mobile viewport regression.

Deploy the API using the private environment configuration. Publish the Roblox place with its server-only `MarketPurchaseHistorySecret` configuration and HTTP enabled. Then verify an actual receipt, a pending grant/recovery, and Admin Gift & Resync in the published environment.

Passing tests describe the checks above; they do not establish that all production failure cases have been exercised.

## Existing backup verifier limitation

`MarketSystemSim/verify_backup.py` still reads an older snapshot manifest that references the removed legacy NavigationGraph. Its global result is not a current purchase feature check. The active Rojo references were separately verified and all exist; the obsolete navigation module was not recreated.
