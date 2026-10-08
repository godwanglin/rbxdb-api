import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(root, '.env');
const credentialPath = resolve(root, '.env.web-admin');
if (!existsSync(envPath) || lstatSync(envPath).isSymbolicLink()) throw new Error('Configure private .env first; symlinks refused.');
if (existsSync(credentialPath) && lstatSync(credentialPath).isSymbolicLink()) throw new Error('Credential file must not be a symlink.');
let env = readFileSync(envPath, 'utf8');
if (/^WEB_ADMIN_PASSWORD_HASH="?scrypt:[a-f0-9]{32}:[a-f0-9]{128}/m.test(env) && !process.argv.includes('--rotate')) {
  console.log('Web admin already configured. Existing credentials unchanged.');
  process.exit(0);
}
const origin = process.env.WEB_SETUP_ORIGIN || 'https://rtdb-rbxsim01.weebinhub.biz.id';
const parsed = new URL(origin);
if (origin !== parsed.origin || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid WEB_SETUP_ORIGIN.');
const username = 'admin';
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const values = {
  WEB_ORIGIN: origin, WEB_ADMIN_USERNAME: username,
  WEB_ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
  WEB_SESSION_SECRET: randomBytes(32).toString('hex'),
  WEB_TRUST_PROXY: parsed.protocol === 'https:' ? '1' : '0',
};
for (const [key, value] of Object.entries(values)) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}
writeFileSync(credentialPath, `WEB_ADMIN_USERNAME="${username}"\nWEB_ADMIN_PASSWORD="${password}"\n`, { mode: 0o600 });
writeFileSync(envPath, env, { mode: 0o600 });
chmodSync(envPath, 0o600); chmodSync(credentialPath, 0o600);
console.log('Web admin configured. Credentials saved privately in .env.web-admin (never commit).');
