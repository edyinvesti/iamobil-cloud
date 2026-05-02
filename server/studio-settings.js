const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const LEGACY_STATE_DIRNAMES = [".clawdbot", ".moltbot", ".openclaw"];

const resolveUserPath = (input) => {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
};

const resolveDefaultHomeDir = () => {
  const home = os.homedir();
  if (home) {
    try {
      if (fs.existsSync(home)) return home;
    } catch {}
  }
  return os.tmpdir();
};

const resolveStateDir = (env = process.env) => {
  const override =
    env.OPENCLAW_STATE_DIR?.trim() ||
    env.MOLTBOT_STATE_DIR?.trim() ||
    env.CLAWDBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);

  const home = resolveDefaultHomeDir();
  for (const dir of LEGACY_STATE_DIRNAMES) {
    try {
      const fullDir = path.join(home, dir);
      if (fs.existsSync(fullDir)) return fullDir;
    } catch {}
  }
  return path.join(home, ".hermes");
};

const resolveStudioSettingsPath = (env = process.env) => {
  return path.join(resolveStateDir(env), "claw3d", "settings.json");
};

const readJsonFile = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const DEFAULT_GATEWAY_URL = "ws://localhost:18789";

const isRecord = (value) => Boolean(value && typeof value === "object");

const loadUpstreamGatewaySettings = (env = process.env) => {
  const settingsPath = resolveStudioSettingsPath(env);
  const parsed = readJsonFile(settingsPath);
  const gateway = parsed && typeof parsed === "object" ? parsed.gateway : null;
  const url = typeof gateway?.url === "string" ? gateway.url.trim() : "";
  const token = typeof gateway?.token === "string" ? gateway.token.trim() : "";
  const adapterType =
    typeof gateway?.adapterType === "string" && gateway.adapterType.trim()
      ? gateway.adapterType.trim()
      : "hermes";
  return {
    url: url || DEFAULT_GATEWAY_URL,
    token,
    adapterType,
    settingsPath,
  };
};

module.exports = {
  resolveStateDir,
  resolveStudioSettingsPath,
  loadUpstreamGatewaySettings,
};
