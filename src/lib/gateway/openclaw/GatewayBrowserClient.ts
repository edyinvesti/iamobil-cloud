// GatewayBrowserClient.ts
// Browser-side WebSocket client for the OpenClaw gateway protocol.

import { GatewayResponseError } from "@/lib/gateway/errors";
import type { EventFrame } from "@/lib/gateway/GatewayClient";

export type GatewayHelloOk = {
  sessionId?: string;
  protocol?: number;
  adapterType?: string;
};

type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
};

type GatewayFrame = GatewayResponseFrame | { type: "event"; event?: string; seq?: number; stateVersion?: unknown; payload?: unknown };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const CONNECT_TIMEOUT_MS = 13_000;
const REQUEST_TIMEOUT_MS = 25_000;
const GATEWAY_CLIENT_ID = "openclaw-control-ui";
const GATEWAY_ROLE = "operator";
const GATEWAY_SCOPES = ["operator.admin", "operator.approvals", "operator.pairing"];

const parseFrame = (raw: string): GatewayFrame | null => {
  try {
    return JSON.parse(raw) as GatewayFrame;
  } catch {
    return null;
  }
};

const asRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const base64UrlEncode = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");

const generateDeviceId = async (publicKey: Uint8Array): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", publicKey.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const generateKeypair = async () => {
  // Ed25519 key generation via the browser's SubtleCrypto where available,
  // otherwise fall back to a random opaque key (gateway will accept it for
  // non-device-authed flows).
  try {
    const key = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const pubRaw = await crypto.subtle.exportKey("raw", key.publicKey);
    const privRaw = await crypto.subtle.exportKey("pkcs8", key.privateKey);
    return { publicKey: new Uint8Array(pubRaw), privateKey: privRaw, cryptoKey: key.privateKey };
  } catch {
    // Fallback: random bytes (no real signing, gateway will reject device-auth flows)
    const priv = crypto.getRandomValues(new Uint8Array(32));
    const pub = crypto.getRandomValues(new Uint8Array(32));
    return { publicKey: pub, privateKey: null, cryptoKey: null, fallback: priv };
  }
};

const signPayload = async (payload: string, cryptoKey: CryptoKey | null): Promise<Uint8Array> => {
  if (!cryptoKey) return crypto.getRandomValues(new Uint8Array(64));
  const encoded = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign("Ed25519", cryptoKey, encoded);
  return new Uint8Array(sig);
};

const randomId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const clearGatewayBrowserSessionStorage = () => {
  try {
    localStorage.removeItem("openclaw:deviceId");
    localStorage.removeItem("openclaw:publicKey");
  } catch {
    // ignore
  }
};

type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  authScopeKey?: string;
  clientName?: string;
  disableDeviceAuth?: boolean;
  onHello: (hello: GatewayHelloOk) => void;
  onEvent: (event: EventFrame) => void;
  onClose: (info: { code: number; reason: string }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

export class GatewayBrowserClient {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private stopped = false;
  private connectRequestIds = new Set<string>();
  private lastSeq = -1;
  private options: GatewayBrowserClientOptions;

  constructor(options: GatewayBrowserClientOptions) {
    this.options = options;
  }

  get connected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN && !this.stopped;
  }

  start() {
    if (this.stopped) return;
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      if (!raw) return;
      const frame = parseFrame(raw);
      if (!frame) return;

      if (frame.type === "event") {
        const evtFrame = frame as { type: "event"; event?: string; seq?: number; stateVersion?: unknown; payload?: unknown };

        // Handle connect challenge for device-auth flows
        if (evtFrame.event === "connect.challenge") {
          const payload = asRecord(evtFrame.payload) ? evtFrame.payload : null;
          const nonce = typeof payload?.nonce === "string" ? payload.nonce.trim() : "";
          if (nonce) {
            void this.sendConnectRequest(nonce);
          }
          return;
        }

        // Handle sequence gap detection
        if (typeof evtFrame.seq === "number") {
          const received = evtFrame.seq;
          if (this.lastSeq >= 0 && received !== this.lastSeq + 1) {
            this.options.onGap?.({ expected: this.lastSeq + 1, received });
          }
          this.lastSeq = received;
        }

        this.options.onEvent({
          type: "event",
          event: evtFrame.event ?? "",
          payload: evtFrame.payload,
          seq: evtFrame.seq,
          stateVersion: evtFrame.stateVersion as EventFrame["stateVersion"],
        });
        return;
      }

      const resFrame = frame as GatewayResponseFrame;
      if (this.connectRequestIds.has(resFrame.id)) {
        this.connectRequestIds.delete(resFrame.id);
        if (resFrame.ok) {
          this.options.onHello(resFrame.payload as GatewayHelloOk ?? {});
        } else if (asRecord(resFrame.error) && typeof resFrame.error.code === "string") {
          // Connect failed — close will trigger onClose
          socket.close(4008, `connect failed: ${resFrame.error.code} ${resFrame.error.message ?? ""}`);
        }
        return;
      }

      const pending = this.pending.get(resFrame.id);
      if (!pending) return;
      this.pending.delete(resFrame.id);
      if (resFrame.ok) {
        pending.resolve(resFrame.payload);
        return;
      }
      if (asRecord(resFrame.error) && typeof resFrame.error.code === "string") {
        pending.reject(new GatewayResponseError({
          code: resFrame.error.code,
          message: typeof resFrame.error.message === "string" ? resFrame.error.message : "Gateway request failed.",
          details: resFrame.error.details,
          retryable: typeof resFrame.error.retryable === "boolean" ? resFrame.error.retryable : undefined,
          retryAfterMs: typeof resFrame.error.retryAfterMs === "number" ? resFrame.error.retryAfterMs : undefined,
        }));
        return;
      }
      pending.reject(new Error("Gateway request failed."));
    });

    socket.addEventListener("open", () => {
      // Send initial connect request without nonce (non-device-auth flow)
      void this.sendConnectRequest(null);
    });

    socket.addEventListener("close", (event) => {
      if (this.socket === socket) this.socket = null;
      const reason = typeof event.reason === "string" ? event.reason : "";
      this.rejectAllPending(new Error(`Gateway client stopped`));
      this.options.onClose({ code: event.code, reason });
    });

    socket.addEventListener("error", () => {
      // The close event will fire afterwards
    });
  }

  stop() {
    this.stopped = true;
    this.rejectAllPending(new Error("Gateway client stopped."));
    if (this.socket) {
      try { this.socket.close(); } catch { /* ignore */ }
      this.socket = null;
    }
  }

  async request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (!this.connected) throw new Error("Gateway is not connected.");
    const id = randomId();
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timed out for ${method}.`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value as T); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      try {
        this.socket?.send(JSON.stringify({ type: "req", id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error("Failed to send gateway request."));
      }
    });
  }

  private async sendConnectRequest(nonce: string | null) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const { disableDeviceAuth, token, clientName } = this.options;
    const id = randomId();
    this.connectRequestIds.add(id);

    let deviceParams: Record<string, unknown> | null = null;

    if (!disableDeviceAuth) {
      try {
        const kp = await generateKeypair();
        const deviceId = await generateDeviceId(kp.publicKey);
        const pubKey = base64UrlEncode(kp.publicKey);
        const signedAtMs = Date.now();
        const version = nonce ? "v2" : "v1";
        const scopes = GATEWAY_SCOPES.join(",");
        const payloadParts = [version, deviceId, GATEWAY_CLIENT_ID, "webchat", GATEWAY_ROLE, scopes, String(signedAtMs), token ?? ""];
        if (nonce) payloadParts.push(nonce);
        const sig = await signPayload(payloadParts.join("|"), kp.cryptoKey ?? null);

        deviceParams = {
          id: deviceId,
          publicKey: pubKey,
          signature: base64UrlEncode(sig),
          signedAt: signedAtMs,
          ...(nonce ? { nonce } : {}),
        };
      } catch {
        // proceed without device auth
      }
    }

    const connectParams: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientName ?? GATEWAY_CLIENT_ID,
        version: "dev",
        platform: "browser",
        mode: nonce ? "webchat" : "control",
      },
      role: GATEWAY_ROLE,
      scopes: GATEWAY_SCOPES,
      caps: [],
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    if (deviceParams) connectParams.device = deviceParams;
    if (token) connectParams.auth = { token };

    this.socket.send(JSON.stringify({ type: "req", id, method: "connect", params: connectParams }));
  }

  private rejectAllPending(error: Error) {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const p of entries) p.reject(error);
  }
}
