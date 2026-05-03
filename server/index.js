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

// Buffer para updates do Telegram que chegam antes do tgBot inicializar
global.pendingTelegramUpdates = [];
global.tgBot = null;


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
  
  const accessGate = createAccessGate({
    token: process.env.STUDIO_ACCESS_TOKEN || "local-dev-bypass"
  });

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

  // 1. Definição do Handler do Servidor
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
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
            if (accessGate.handleHttp(req, res)) return;

            const pathname = resolvePathname(req.url);
            if (pathname === '/api/tg-webhook') {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', () => {
                 try { 
                   const update = JSON.parse(body);
                   if (global.tgBot) {
                     global.tgBot.processUpdate(update);
                   } else {
                     global.pendingTelegramUpdates.push(update);
                   }
                 } catch(e) { console.error('[Webhook] Erro:', e.message); }
                 res.statusCode = 200; res.end('OK');
              });
              return;
            }

            if (!nextReady) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ status: "preparing", message: "IAmobil is starting up. Please wait..." }));
              return;
            }
            handle(req, res);
          } catch (err) {
            console.error("🔥 [Server] Critical Request Error (HTTPS):", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ 
              error: "Internal Server Error (HTTPS)",
              message: err.message,
              stack: err.stack
            }));
          }
        })
      : http.createServer((req, res) => {
          try {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
            if (accessGate.handleHttp(req, res)) return;

            const pathname = resolvePathname(req.url);
            if (pathname === '/api/tg-webhook') {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', () => {
                 try { 
                   const update = JSON.parse(body);
                   if (global.tgBot) {
                     global.tgBot.processUpdate(update);
                   } else {
                     global.pendingTelegramUpdates.push(update);
                   }
                 } catch(e) { console.error('[Webhook] Erro:', e.message); }
                 res.statusCode = 200; res.end('OK');
              });
              return;
            }
            if (pathname === "/api/simulator/status") {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(simulatorManager.getSimulatorStatus()));
              return;
            }

            if (!nextReady) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ status: "preparing", message: "IAmobil is starting up. Please wait..." }));
              return;
            }
            handle(req, res);
          } catch (err) {
            console.error("🔥 [Server] Critical Request Error (HTTP):", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ 
              error: "Internal Server Error (HTTP)",
              message: err.message,
              stack: err.stack
            }));
          }
        });

  // 2. ABRIR PORTA IMEDIATAMENTE (Vital para Render Health Check)
  const servers = hostnames.map(() => createServer());
  global.servers = servers;
  for (const server of servers) {
    server.on("upgrade", handleServerUpgrade);
  }

  const listenOnHost = (server, host) =>
    new Promise((resolve, reject) => {
      server.listen(port, host, () => resolve());
      server.once("error", reject);
    });

  const protocol = useHttps ? "https" : "http";
  const browserUrl = `${protocol}://0.0.0.0:${port}`;

  console.info(`📡 [Server] [${new Date().toLocaleTimeString()}] Abrindo porta ${port} imediatamente (Health Check)...`);
  try {
    await Promise.all(servers.map((server, index) => listenOnHost(server, hostnames[index])));
    console.info(`✅ [Server] [${new Date().toLocaleTimeString()}] Porta aberta com sucesso!`);
  } catch (err) {
    console.error("❌ [Server] Falha fatal ao abrir porta:", err.message);
    process.exit(1);
  }

  // 3. INICIAR MOTORES EM BACKGROUND (Não bloqueia o Health Check)
  (async () => {
    console.info(`🚀 [Server] [${new Date().toLocaleTimeString()}] Iniciando motores secundários...`);
    
    // Hermes Adapter
    try {
      if (process.env.SKIP_SUBPROCESS !== "true") {
        spawn("node", ["server/hermes-gateway-adapter.js"], {
          stdio: "inherit",
          env: { ...process.env, ADAPTER_IS_SUBPROCESS: "true" },
        }).on("error", (err) => console.error("❌ [Server] Erro Hermes:", err.message));
      }
    } catch (e) { console.error(e); }

    // Messaging Hub
    try {
      const ready = await waitForPort(18789, "127.0.0.1", 30000);
      require("./messaging_hub");
      console.info(`📡 [Server] [${new Date().toLocaleTimeString()}] Messaging Hub conectado.`);
    } catch (e) { console.error(e); }

    // Outros Motores
    try { radarEngine.start(); } catch (e) { console.error(e); }
    try { require("./autofix-engine"); } catch (e) { console.error(e); }
    try { require("./brain_engine").startAutonomousLearning(30 * 60 * 1000); } catch (e) { console.error(e); }
    try { require("./rag_engine").syncKnowledgeBase(); } catch (e) { console.error(e); }
  })();

  // 4. PREPARAR NEXT.JS EM PARALELO
  console.info(`⚙️ [Server] [${new Date().toLocaleTimeString()}] Preparando Next.js (Cold Start)...`);
  try {
    await app.prepare();
    handle = app.getRequestHandler();
    handleUpgrade = app.getUpgradeHandler();
    nextReady = true;
    console.info(`🎉 [Server] [${new Date().toLocaleTimeString()}] Sistema IAmobil Totalmente Pronto!`);
  } catch (err) {
    console.error("❌ [Server] Falha ao preparar Next.js:", err.message);
  }

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
