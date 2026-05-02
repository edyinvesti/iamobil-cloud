const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const next = require("next");

const { createAccessGate } = require("./access-gate");
const { createGatewayProxy } = require("./gateway-proxy");
const { assertPublicHostAllowed, resolveHosts } = require("./network-policy");
const { loadUpstreamGatewaySettings } = require("./studio-settings");
const simulatorManager = require("./simulator-manager");
const { spawn } = require("child_process");
const radarEngine = require("./radar_engine");

const resolvePort = () => {
  const raw = process.env.PORT?.trim() || "3000";
  const port = Number(raw);
  if (!Number.isFinite(port) || port <= 0) return 3000;
  return port;
};

const resolvePathname = (url) => {
  const raw = typeof url === "string" ? url : "";
  const idx = raw.indexOf("?");
  return (idx === -1 ? raw : raw.slice(0, idx)) || "/";
};

async function waitForPort(port, host = "127.0.0.1", timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(port, host);
        socket.on("connect", () => {
          socket.end();
          resolve();
        });
        socket.on("error", (err) => {
          reject(err);
        });
      });
      return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 100)); // Polling mais rápido (100ms)
    }
  }
  return false;
}


const CERT_DIR = require("node:path").join(__dirname, "..", ".certs");
const CERT_PATH = require("node:path").join(CERT_DIR, "localhost.crt");
const KEY_PATH = require("node:path").join(CERT_DIR, "localhost.key");

const generateHttpsCert = async () => {
  const fs = require("node:fs");

  // Re-use a saved cert so the browser only needs to trust it once.
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH, "utf8"),
      cert: fs.readFileSync(CERT_PATH, "utf8"),
    };
  }

  const selfsigned = require("selfsigned");
  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = await selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ],
      },
    ],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(CERT_PATH, pems.cert);
  fs.writeFileSync(KEY_PATH, pems.private);

  console.info(`\nCert saved to ${CERT_DIR}`);
  console.info("To make browsers trust it (macOS), run:");
  console.info(`  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CERT_PATH}"\n`);

  return { key: pems.private, cert: pems.cert };
};

async function main() {
  const dev = process.argv.includes("--dev");
  const useHttps = process.argv.includes("--https") || process.env.HTTPS === "true";
  const hostnames = Array.from(new Set(resolveHosts(process.env)));
  const hostname = hostnames[0] ?? "127.0.0.1";
  const port = resolvePort();
  for (const host of hostnames) {
    assertPublicHostAllowed({
      host,
      studioAccessToken: process.env.STUDIO_ACCESS_TOKEN,
    });
  }

  const app = next({
    dev,
    hostname,
    port,
    ...(dev ? { webpack: true } : null),
  });
  let handle = null;
  let handleUpgrade = null;

  const accessGate = createAccessGate({
    token: process.env.STUDIO_ACCESS_TOKEN,
  });

  const proxy = createGatewayProxy({
    loadUpstreamSettings: async () => {
      const settings = loadUpstreamGatewaySettings(process.env);
      return { url: settings.url, token: settings.token, adapterType: settings.adapterType };
    },
    log: (message) => console.info(message),
    logError: (message, error) => console.error(message, error),
    allowWs: (req) => {
      if (resolvePathname(req.url) !== "/api/gateway/ws") return false;
      return true;
    },
    verifyClient: (info) => accessGate.allowUpgrade(info.req),
  });

  // 1. Iniciar Hermes Gateway Adapter IMEDIATAMENTE (Paralelo ao Next.js prepare)
  try {
    if (process.env.SKIP_SUBPROCESS !== "true") {
      console.log("🚀 [Server] Iniciando Hermes Gateway Adapter em background...");
      const adapterProcess = spawn("node", ["server/hermes-gateway-adapter.js"], {
        stdio: "inherit",
        env: { ...process.env, ADAPTER_IS_SUBPROCESS: "true" },
      });
      adapterProcess.on("error", (err) => {
        console.error("❌ [Server] Falha ao iniciar Hermes Adapter:", err.message);
      });
    }
  } catch (err) {
    console.error("⚠️ [Server] Erro ao disparar subprocesso do Hermes:", err.message);
  }

  console.log(`🌍 [Server] Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 [Server] Turso Configurado: ${!!process.env.TURSO_DB_URL}`);
  console.log(`🤖 [Server] Hermes Key Configurada: ${!!process.env.HERMES_API_KEY}`);

  // 2. Orquestrar Hub de Mensageria e Motores em background
  (async () => {
    try {
      console.info("⏳ [Server] Aguardando Hermes Gateway na porta 18789...");
      const ready = await waitForPort(18789, "127.0.0.1", 20000); // 20s de paciência
      if (ready) {
        console.info("📡 [Server] Hermes pronto! Conectando Messaging Hub...");
        require("./messaging_hub");
      } else {
        console.warn("⚠️ [Server] Timeout Hermes ou porta ocupada. Verificando ambiente...");
        require("./messaging_hub");
      }
    } catch (err) {
      console.error("⚠️ [Server] Falha na orquestração de background:", err.message);
    }
  })();

  // Iniciar Motores Secundários (Radar e Autofix) sem bloquear
  try { radarEngine.start(); } catch (e) { console.error(e); }
  try { require("./autofix-engine"); } catch (e) { console.error(e); }
  try { require("./brain_engine").startAutonomousLearning(30 * 60 * 1000); } catch (e) { console.error(e); }
  try { require("./rag_engine").syncKnowledgeBase(); } catch (e) { console.error(e); }


  const handleServerUpgrade = (req, socket, head) => {
    if (resolvePathname(req.url) === "/api/gateway/ws") {
      proxy.handleUpgrade(req, socket, head);
      return;
    }
    if (handleUpgrade) {
      handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  };

  const httpsCert = useHttps ? await generateHttpsCert() : null;

  let nextReady = false;

  const createServer = () =>
    useHttps
      ? https.createServer(httpsCert, (req, res) => {
          try {
            // CORS Support for the Website
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

            if (accessGate.handleHttp(req, res)) return;

            if (!nextReady) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Next.js is preparing. Please wait..." }));
              return;
            }
            handle(req, res);
          } catch (err) {
            console.error("🔥 [Server] Critical Request Error (HTTPS):", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal Server Error (Custom Handler)" }));
          }
        })
      : http.createServer((req, res) => {
          try {
            // CORS Support for the Website
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

            if (accessGate.handleHttp(req, res)) return;

            const pathname = resolvePathname(req.url);
            if (pathname === "/api/simulator/status") {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(simulatorManager.getSimulatorStatus()));
              return;
            }
            if (pathname === "/api/simulator/launch" && req.method === "POST") {
              const result = simulatorManager.startSimulator();
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));
              return;
            }

            if (!nextReady) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Next.js is preparing. Please wait..." }));
              return;
            }
            handle(req, res);
          } catch (err) {
            console.error("🔥 [Server] Critical Request Error (HTTP):", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal Server Error (Custom Handler)" }));
          }
        });

  const servers = hostnames.map(() => createServer());
  global.servers = servers;

  const attachUpgradeHandlers = (server) => {
    server.on("upgrade", handleServerUpgrade);
    server.on("newListener", (eventName, listener) => {
      if (eventName !== "upgrade") return;
      if (listener === handleServerUpgrade) return;
      process.nextTick(() => {
        server.removeListener("upgrade", listener);
      });
    });
  };

  for (const server of servers) {
    attachUpgradeHandlers(server);
  }

  const listenOnHost = (server, host) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off("error", onError);
        reject(err);
      };
      server.once("error", onError);
      server.listen(port, host, () => {
        server.off("error", onError);
        resolve();
      });
    });

  const closeServer = (server) =>
    new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
    });

  const hostForBrowser = hostnames.some((value) => value === "127.0.0.1" || value === "::1")
    ? "localhost"
    : hostname === "0.0.0.0" || hostname === "::"
      ? "localhost"
      : hostname;

  const protocol = useHttps ? "https" : "http";
  const browserUrl = `${protocol}://${hostForBrowser}:${port}`;

  console.info(`📡 [Server] Iniciando escuta em ${browserUrl}...`);
  try {
    await Promise.all(servers.map((server, index) => listenOnHost(server, hostnames[index])));
    console.info(`✅ [Server] HTTP Server escutando.`);
  } catch (err) {
    await Promise.all(servers.map((server) => closeServer(server)));
    throw err;
  }

  console.info("⚙️ [Server] Preparando Next.js em paralelo...");
  await app.prepare();
  handle = app.getRequestHandler();
  handleUpgrade = app.getUpgradeHandler();
  nextReady = true;
  console.info("🎉 [Server] Sistema IAmobil Totalmente Pronto!");
  if (useHttps) {
    console.info("HTTPS mode: self-signed cert in use. You may need to accept a browser security warning once.");
    console.info(`Spotify redirect URI: ${browserUrl}/office`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

// Graceful shutdown handling
const shutdown = async () => {
  console.info("\nShutting down gracefully...");
  // Release port 3000 and close servers
  if (global.servers) {
    await Promise.all(global.servers.map(s => new Promise(resolve => s.close(resolve))));
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
