#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Run from an existing checkout. Never reads secrets into command arguments.
# Single-server deploy; use release directories when zero-downtime rollback is needed.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
APP_NAME=rbxdb-api
PORT=3876

die() { printf 'deploy: %s\n' "$*" >&2; exit 1; }
for command in node npm pm2 curl flock; do
  command -v "$command" >/dev/null || die "$command is required"
done
exec 9>.deploy.lock
flock -n 9 || die 'another deployment is running'

node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||(major===22&&minor<12)) process.exit(1)' \
  || die 'Node.js 22.12+ is required'
[[ ! -L .env ]] || die '.env must not be a symlink'
if [[ ! -f .env ]]; then
  cp -- .env.example .env
  die 'created private .env from template; configure database and matching Roblox HMAC secret, then rerun'
fi
chmod 600 .env

# Validate without sourcing .env as executable shell code or printing values.
node --env-file=.env - <<'NODE'
const fail = (message) => { console.error(`deploy: ${message}; check private .env`); process.exit(1); };
try {
  const url = new URL(process.env.DATABASE_URL);
  const secret = process.env.RBX_API_SECRET ?? '';
  if (url.protocol !== 'mysql:' || !url.hostname || !url.username || !url.password
      || url.pathname.length < 2 || url.username === 'username' || url.password === 'password'
      || secret.length < 32 || secret.includes('replace-with')) fail('invalid DATABASE_URL or RBX_API_SECRET');
  const origin = new URL(process.env.WEB_ORIGIN ?? '');
  const hash = process.env.WEB_ADMIN_PASSWORD_HASH ?? '';
  const session = process.env.WEB_SESSION_SECRET ?? '';
  if (origin.protocol !== 'https:' || origin.origin !== process.env.WEB_ORIGIN
      || !process.env.WEB_ADMIN_USERNAME || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)
      || session.length < 32 || session.includes('replace-with')) fail('invalid web admin configuration');
} catch { fail('invalid environment configuration'); }
NODE

export NEXT_TELEMETRY_DISABLED=1
npm ci --include=dev
npm run prisma:generate
npm run prisma:validate
# First deploy only: DB_PUSH=1 bash deploy.sh. Never uses --accept-data-loss.
if [[ "${DB_PUSH:-0}" == 1 ]]; then
  npm run prisma:push
fi
npm run build
npm run typecheck
# Full integration/contract suite writes fixtures: run separately on a test DB.
npm test -- tests/unit

# Pin this one app's executable and args; do not touch aidev-gateway or other apps.
pm2 startOrRestart ecosystem.config.cjs --only "$APP_NAME" --update-env

healthy=0
for _ in {1..30}; do
  if curl --fail --silent --max-time 5 "http://127.0.0.1:$PORT/api/health" >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done
[[ "$healthy" == 1 ]] || die "health check failed; inspect pm2 logs $APP_NAME locally"
pm2 save >/dev/null
if [[ "$(id -u)" == 0 ]] && command -v systemctl >/dev/null && [[ -d /run/systemd/system ]]; then
  if ! systemctl is-enabled "pm2-$(id -un).service" >/dev/null 2>&1; then
    pm2 startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null
  fi
else
  printf 'deploy: configure PM2 startup once with an administrator for reboot recovery\n'
fi
printf 'deploy: %s healthy at http://127.0.0.1:%s; configure HTTPS reverse proxy separately\n' "$APP_NAME" "$PORT"
