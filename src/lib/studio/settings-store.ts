import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const getAlgorithm = () => "aes-256-cbc";
const getKey = () => crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY || "local-iamobil-default-key").digest();

function encryptToken(text: string): string {
  if (!text || text.startsWith("enc:")) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(getAlgorithm(), getKey(), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return "enc:" + iv.toString("hex") + ":" + encrypted;
  } catch { return text; }
}

function decryptToken(hash: string): string {
  if (!hash || !hash.startsWith("enc:")) return hash;
  try {
    const parts = hash.split(":");
    if (parts.length !== 3) return hash;
    const iv = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(getAlgorithm(), getKey(), iv);
    let decrypted = decipher.update(parts[2], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch { return hash; }
}

import { resolveStateDir } from "@/lib/clawdbot/paths";
import {
  defaultStudioSettings,
  mergeStudioSettings,
  normalizeGatewayAdapterType,
  normalizeStudioSettings,
  type StudioGatewayAdapterType,
  type StudioGatewayProfile,
  type StudioGatewaySettings,
  type StudioSettings,
  type StudioSettingsPatch,
} from "@/lib/studio/settings";

// Studio settings are intentionally stored as a local JSON file for a single-user workflow.
// That includes gateway connection details, so treat the state directory as plaintext secret
// storage and document any changes to this threat model in README.md and SECURITY.md.
const SETTINGS_DIRNAME = "claw3d";
const SETTINGS_FILENAME = "settings.json";
const DEFAULT_LOCAL_GATEWAY_PORT = 18789;

export const resolveStudioSettingsPath = () =>
  path.join(resolveStateDir(), SETTINGS_DIRNAME, SETTINGS_FILENAME);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const buildGatewaySettings = (params: {
  adapterType: StudioGatewayAdapterType;
  url: string;
  token?: string;
  profiles?: Partial<Record<StudioGatewayAdapterType, StudioGatewayProfile>>;
}): StudioGatewaySettings => ({
  url: params.url,
  token: params.token ?? "",
  tokenConfigured: !!params.token,
  adapterType: params.adapterType,
  profiles: {
    ...(params.profiles ?? {}),
    [params.adapterType]: buildLocalProfile(params.url, params.token),
  } as Record<StudioGatewayAdapterType, StudioGatewayProfile>,
});

const buildLocalProfile = (url: string, token = ""): StudioGatewayProfile => ({ url, token, tokenConfigured: !!token });

const readOpenclawGatewayDefaults = (): StudioGatewaySettings | null => {
  try {
    const configPath = path.join(resolveStateDir(), "openclaw.json");
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf8");
    const json = JSON.parse(raw);
    const port = json.gateway?.port ?? DEFAULT_LOCAL_GATEWAY_PORT;
    const token = json.gateway?.auth?.token ?? "";
    const adapterType = normalizeGatewayAdapterType(json.gateway?.adapterType, "openclaw");
    
    return buildGatewaySettings({
      adapterType,
      url: `ws://localhost:${port}`,
      token: token,
    });
  } catch {
    return null;
  }
};

const normalizeAdapterType = (value: string | undefined): StudioGatewayAdapterType | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "hermes" || normalized === "demo" || normalized === "custom" || normalized === "openclaw") {
    return normalized as StudioGatewayAdapterType;
  }
  return null;
};

const readPortBasedGatewayProfile = (
  adapterType: Extract<StudioGatewayAdapterType, "hermes" | "demo">,
  envKey: "HERMES_ADAPTER_PORT" | "DEMO_ADAPTER_PORT"
): StudioGatewayProfile | null => {
  const rawPort = process.env[envKey]?.trim();
  if (!rawPort) return null;
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(port) || port <= 0) return null;
  return buildLocalProfile(`ws://localhost:${port}`);
};

const buildEnvGatewayDefaults = (): StudioGatewaySettings | null => {
  const envUrl = process.env.CLAW3D_GATEWAY_URL?.trim();
  const envToken = process.env.CLAW3D_GATEWAY_TOKEN?.trim() ?? "";
  const envAdapterType =
    normalizeAdapterType(process.env.CLAW3D_GATEWAY_ADAPTER_TYPE) ?? "openclaw";

  const hermesProfile = readPortBasedGatewayProfile("hermes", "HERMES_ADAPTER_PORT");
  const demoProfile = readPortBasedGatewayProfile("demo", "DEMO_ADAPTER_PORT");

  const profiles: Partial<Record<StudioGatewayAdapterType, StudioGatewayProfile>> = {};
  if (hermesProfile) profiles.hermes = hermesProfile;
  if (demoProfile) profiles.demo = demoProfile;

  if (envUrl) {
    return buildGatewaySettings({
      adapterType: envAdapterType,
      url: envUrl,
      token: envToken,
      profiles,
    });
  }

  const fallbackProfile = profiles.hermes ?? profiles.demo ?? null;
  if (!fallbackProfile) return null;
  const fallbackAdapterType = profiles.hermes ? "hermes" : "demo";
  return buildGatewaySettings({
    adapterType: fallbackAdapterType,
    url: fallbackProfile.url,
    token: fallbackProfile.token,
    profiles,
  });
};

const mergeGatewayProfiles = (
  base: StudioGatewaySettings,
  extra: StudioGatewaySettings | null
): StudioGatewaySettings => {
  if (!extra?.profiles) {
    return base;
  }
  const mergedProfiles: Partial<Record<StudioGatewayAdapterType, StudioGatewayProfile>> = {
    ...(base.profiles ?? {}),
  };
  for (const [adapterType, profile] of Object.entries(extra.profiles) as Array<
    [StudioGatewayAdapterType, StudioGatewayProfile | undefined]
  >) {
    if (!profile || mergedProfiles[adapterType]) {
      continue;
    }
    mergedProfiles[adapterType] = profile;
  }
  return {
    ...base,
    profiles: mergedProfiles,
  };
};

const isCloudEnvironment = () => Boolean(process.env.RENDER || process.env.NODE_ENV === "production");

export const loadLocalGatewayDefaults = (): StudioGatewaySettings | null => {
  if (isCloudEnvironment()) {
    // In cloud, we don't probe local files; return a standard cloud default profile
    return buildGatewaySettings({
      adapterType: "hermes",
      url: process.env.NEXT_PUBLIC_GATEWAY_URL || "",
      profiles: {
        hermes: buildLocalProfile(process.env.NEXT_PUBLIC_GATEWAY_URL || "")
      }
    });
  }
  const fromFile = readOpenclawGatewayDefaults();
  const fromEnv = buildEnvGatewayDefaults();
  if (fromFile) {
    return mergeGatewayProfiles(fromFile, fromEnv);
  }
  return fromEnv;
};

export const loadStudioSettings = (): StudioSettings => {
  if (isCloudEnvironment()) {
    const defaults = defaultStudioSettings();
    const gateway = loadLocalGatewayDefaults();
    return gateway ? { ...defaults, gateway } : defaults;
  }
  const settingsPath = resolveStudioSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    const defaults = defaultStudioSettings();
    const gateway = loadLocalGatewayDefaults();
    return gateway ? { ...defaults, gateway } : defaults;
  }
  const raw = fs.readFileSync(settingsPath, "utf8");
  const parsed = JSON.parse(raw) as any;
  if (parsed?.gateway?.token) {
    parsed.gateway.token = decryptToken(parsed.gateway.token);
  }
  const settings = normalizeStudioSettings(parsed);
  if (!settings.gateway?.token) {
    const gateway = loadLocalGatewayDefaults();
    if (gateway) {
      return {
        ...settings,
        gateway: settings.gateway?.url?.trim()
          ? {
              url: (settings.gateway as StudioGatewaySettings).url.trim(),
              token: gateway.token,
              tokenConfigured: !!gateway.token,
              adapterType: (settings.gateway as StudioGatewaySettings).adapterType,
            }
          : gateway,
      };
    }
  }
  return settings;
};

export const saveStudioSettings = (next: StudioSettings) => {
  const settingsPath = resolveStudioSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const toSave = JSON.parse(JSON.stringify(next));
  if (toSave.gateway?.token) {
    toSave.gateway.token = encryptToken(toSave.gateway.token);
  }
  
  fs.writeFileSync(settingsPath, JSON.stringify(toSave, null, 2), "utf8");
};

export const applyStudioSettingsPatch = (patch: StudioSettingsPatch): StudioSettings => {
  const current = loadStudioSettings();
  const next = mergeStudioSettings(current, patch);
  saveStudioSettings(next);
  return next;
};
