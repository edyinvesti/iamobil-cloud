module.exports = {
  apps: [
    {
      name: "iamobil-core",
      script: "server/index.js",
      args: "--dev",
      autorestart: true,
      watch: false,
      env: { NODE_ENV: "production" }
    },
    {
      name: "hermes-adapter",
      script: "server/hermes-gateway-adapter.js",
      autorestart: true,
      env: { NODE_ENV: "production" }
    },
    {
      name: "messaging-hub",
      script: "server/messaging_hub.js",
      autorestart: true,
      env: { NODE_ENV: "production" }
    },
    {
      name: "ia-sentinel",
      script: "watchdog_cron.js",
      autorestart: true,
      env: { NODE_ENV: "production" }
    }
  ]
};
