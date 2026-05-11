const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("child_process");
const next = require("next");
const { parse } = require("url");

// Carregamento de Ambiente
require('dotenv').config();
const cloudEnvPath = "/etc/secrets/.env";
if (fs.existsSync(cloudEnvPath)) {
  require('dotenv').config({ path: cloudEnvPath });
}

const { createAccessGate } = require("./access-gate");
const { createGatewayProxy } = require("./gateway-proxy");
const { assertPublicHostAllowed, resolveHosts } = require("./network-policy");
const simulatorManager = require("./simulator-manager");
const radarEngine = require("./radar_engine");

const resolvePort = () => {
  const p = Number(process.env.PORT || "3000");
  return Number.isFinite(p) && p > 0 ? p : 3000;
};

const resolvePathname = (url) => {
  const raw = typeof url === "string" ? url : "";
  const idx = raw.indexOf("?");
  return (idx === -1 ? raw : raw.slice(0, idx)) || "/";
};

async function waitForPort(port, host = "127.0.0.1", timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(port, host);
        socket.on("connect", () => { socket.end(); resolve(); });
        socket.on("error", reject);
      });
      return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return false;
}

async function main() {
  const dev = process.argv.includes("--dev");
  const useHttps = process.env.HTTPS === "true";
  const hostnames = resolveHosts(process.env);
  const port = resolvePort();
  const isRender = process.env.RENDER === "true" || (typeof window === "undefined" && process.env.HOSTNAME?.includes("onrender"));
  
  const studioToken = process.env.STUDIO_ACCESS_TOKEN || "local-dev-bypass";
  const accessGate = createAccessGate({ token: studioToken });

  const proxy = createGatewayProxy({
    loadUpstreamSettings: async () => ({
      url: process.env.CLAW3D_GATEWAY_URL || `ws://localhost:18789`,
      token: studioToken,
      adapterType: "hermes",
    }),
    log: (msg) => console.log(`[Gateway Proxy] ${msg}`),
    logError: (msg, err) => console.error(`[Gateway Proxy] ${msg}`, err),
    upstreamHandshakeTimeoutMs: 15000,
  });

  const app = next({ dev, hostname: "0.0.0.0", port });
  const handle = app.getRequestHandler();
  let nextReady = false;

  // --- Handlers Centrais ---

  const requestHandler = async (req, res) => {
    try {
      const pathname = resolvePathname(req.url).replace(/\/$/, "") || "/";
      console.log(`[Request] ${req.method} ${pathname}`);

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

      // 1. Diagnóstico Público (Prioridade Máxima)
      if (pathname === "/api/diagnostics" || pathname === "/api/health" || pathname === "/api/status") {
        const hermesStatus = await (async () => {
          return new Promise((resolve) => {
            const socket = net.createConnection(18789, "127.0.0.1");
            socket.on("connect", () => { socket.destroy(); resolve("online ✅"); });
            socket.on("error", (e) => { resolve(`offline ❌ (${e.message})`); });
            setTimeout(() => { socket.destroy(); resolve("timeout ⏳"); }, 1500);
          });
        })();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          app: "IAmobil Cloud",
          diagnostics: {
            gateway_internal: hermesStatus,
            port: 18789,
            proxy_target: "ws://localhost:18789"
          },
          system: {
            uptime: Math.floor(process.uptime()),
            node: process.version,
            platform: process.platform
          }
        }));
        return;
      }

      if (pathname === "/api/logs-gateway") {
        const logFile = path.join(__dirname, "../logs/adapter_debug.log");
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, "utf8").split("\n").slice(-200).join("\n");
          res.setHeader("Content-Type", "text/plain");
          res.end(content);
        } else {
          res.statusCode = 404; res.end("Log not found");
        }
        return;
      }

      // 2. Proteção de Acesso
      if (accessGate.handleHttp(req, res)) return;

      if (pathname === "/api/login-admin") {
        res.setHeader("Set-Cookie", `studio_access=${studioToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
        res.statusCode = 302; res.setHeader("Location", "/");
        res.end(); return;
      }

      // 3. Webhooks e Next.js
      if (!nextReady && pathname !== "/api/status") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "preparando", message: "Iniciando IAmobil..." }));
        return;
      }

      handle(req, res);
    } catch (err) {
      console.error("🔥 [Server Error]", err);
      res.statusCode = 500; res.end("Internal Server Error");
    }
  };

  const handleUpgrade = (req, socket, head) => {
    const pathname = resolvePathname(req.url);
    console.log(`[Upgrade] Intent: ${pathname} from ${req.headers.origin || 'unknown'}`);
    
    if (pathname === "/api/gateway/ws") {
      if (!accessGate.allowUpgrade(req)) {
        console.warn(`[Upgrade] Bloqueado gateway: Não autorizado`);
        socket.destroy(); return;
      }
      proxy.handleUpgrade(req, socket, head);
      return;
    }
    
    if (nextReady) {
      app.getUpgradeHandler()(req, socket, head);
    } else {
      socket.destroy();
    }
  };

  // --- Inicialização de Servidores ---

  const server = useHttps ? https.createServer({}, requestHandler) : http.createServer(requestHandler);
  server.on("upgrade", handleUpgrade);

  server.listen(port, "0.0.0.0", () => {
    console.info(`✅ [Server] IAmobil rodando em http://0.0.0.0:${port}`);
  });

  // --- Background Motors ---

  (async () => {
    const logFile = path.join(__dirname, "../logs/adapter_debug.log");
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    const spawnHermes = () => {
      console.info("🚀 [Subprocess] Iniciando Hermes...");
      const child = spawn("node", [path.join(__dirname, "hermes-gateway-adapter.js")], {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, ADAPTER_IS_SUBPROCESS: "true" }
      });
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      child.on("exit", (code) => {
        console.error(`❌ [Subprocess] Hermes caiu (code ${code}). Reiniciando em 5s...`);
        setTimeout(spawnHermes, 5000);
      });
    };

    spawnHermes();

    try {
      await waitForPort(18789);
      require("./messaging_hub");
      radarEngine.start();
      console.info("⚙️ [Motors] Todos os motores em background ativos.");
    } catch (e) {
      console.error("❌ [Motors] Falha ao sincronizar motores:", e.message);
    }
  })();

  // --- Build Next.js ---
  try {
    await app.prepare();
    nextReady = true;
    console.info("🎉 [Next.js] Dashboard Pronto!");
  } catch (err) {
    console.error("❌ [Next.js] Erro no Cold Start:", err);
  }
}

main().catch(console.error);
