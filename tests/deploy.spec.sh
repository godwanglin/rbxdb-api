#!/usr/bin/env bash
set -Eeuo pipefail

# Isolated fixtures: no real PM2 process or database writes.
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/app" "$fixture/bin"
cp "$root/deploy.sh" "$root/.env.example" "$root/ecosystem.config.cjs" "$fixture/app/"
export DEPLOY_TEST_LOG="$fixture/commands.log"
unset DATABASE_URL RBX_API_SECRET DB_PUSH

cat >"$fixture/bin/npm" <<'MOCK'
#!/usr/bin/env bash
echo "npm $*" >>"$DEPLOY_TEST_LOG"
[[ "${FAIL_BUILD:-0}" != 1 || "$*" != 'run build' ]]
MOCK
cat >"$fixture/bin/pm2" <<'MOCK'
#!/usr/bin/env bash
echo "pm2 $*" >>"$DEPLOY_TEST_LOG"
MOCK
cat >"$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
echo "curl $*" >>"$DEPLOY_TEST_LOG"
MOCK
chmod +x "$fixture/bin/"*
export PATH="$fixture/bin:$PATH"

if bash "$fixture/app/deploy.sh" >"$fixture/output" 2>&1; then
  echo 'missing .env must stop deployment' >&2; exit 1
fi
[[ -f "$fixture/app/.env" && ! -e "$DEPLOY_TEST_LOG" ]]
[[ "$(stat -c %a "$fixture/app/.env")" == 600 ]]
if bash "$fixture/app/deploy.sh" >"$fixture/output" 2>&1; then
  echo 'placeholder .env must stop deployment' >&2; exit 1
fi
[[ ! -e "$DEPLOY_TEST_LOG" ]]

cat >"$fixture/app/.env" <<'ENV'
DATABASE_URL="mysql://fixture:fixture@127.0.0.1:3306/test"
RBX_API_SECRET="only-test-fixture-not-a-real-secret-00000000"
ENV
if FAIL_BUILD=1 bash "$fixture/app/deploy.sh" >"$fixture/output" 2>&1; then
  echo 'failed build must stop deployment' >&2; exit 1
fi
! grep -q '^pm2 ' "$DEPLOY_TEST_LOG"

: >"$DEPLOY_TEST_LOG"
bash "$fixture/app/deploy.sh" >"$fixture/output" 2>&1
grep -qx 'pm2 startOrRestart ecosystem.config.cjs --only rbxdb-api --update-env' "$DEPLOY_TEST_LOG"
grep -qx 'npm test -- tests/unit' "$DEPLOY_TEST_LOG"
! grep -q 'prisma:push\|aidev-gateway\|npm test$' "$DEPLOY_TEST_LOG"
grep -q 'http://127.0.0.1:3876/api/health' "$DEPLOY_TEST_LOG"
grep -qx 'pm2 save' "$DEPLOY_TEST_LOG"
! grep -q 'only-test-fixture-not-a-real-secret' "$fixture/output"

: >"$DEPLOY_TEST_LOG"
DB_PUSH=1 bash "$fixture/app/deploy.sh" >"$fixture/output" 2>&1
grep -qx 'npm run prisma:push' "$DEPLOY_TEST_LOG"
node - "$fixture/app/ecosystem.config.cjs" <<'NODE'
const assert = require('node:assert/strict');
const config = require(process.argv[2]);
assert.equal(config.apps.length, 1);
assert.equal(config.apps[0].name, 'rbxdb-api');
assert.equal(config.apps[0].args, 'start --hostname 127.0.0.1 --port 3876');
assert.equal(config.apps[0].env.NODE_ENV, 'production');
NODE
echo 'deploy checks passed: env guards, permissions, build failure, isolated PM2, port 3876, optional db push'
