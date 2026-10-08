module.exports = {
  apps: [{
    name: 'rbxdb-api',
    cwd: __dirname,
    script: './node_modules/next/dist/bin/next',
    interpreter: process.execPath,
    args: 'start --hostname 127.0.0.1 --port 3876',
    env: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  }],
};
