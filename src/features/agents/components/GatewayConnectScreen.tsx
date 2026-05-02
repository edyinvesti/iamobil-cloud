import { useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import type { StudioGatewayAdapterType, StudioGatewaySettings } from "@/lib/studio/settings";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";

type GatewayConnectScreenProps = {
  gatewayUrl: string;
  token: string;
  tokenConfigured: boolean;
  setTokenConfigured: (value: boolean) => void;
  selectedAdapterType: StudioGatewayAdapterType;
  activeAdapterType: StudioGatewayAdapterType;
  localGatewayDefaults: StudioGatewaySettings | null;
  status: GatewayStatus;
  error: string | null;
  showApprovalHint: boolean;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onAdapterTypeChange: (value: StudioGatewayAdapterType) => void;
  onUseLocalDefaults: () => void;
  onConnect: () => void;
  onLaunchSimulator: () => Promise<void>;
};

const resolveLocalGatewayPort = (gatewayUrl: string): number => {
  try {
    const parsed = new URL(gatewayUrl);
    const port = Number(parsed.port);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {}
  return 18789;
};

export const GatewayConnectScreen = ({
  gatewayUrl,
  token,
  tokenConfigured,
  selectedAdapterType,
  activeAdapterType,
  localGatewayDefaults,
  status,
  error,
  showApprovalHint,
  onGatewayUrlChange,
  onTokenChange,
  onAdapterTypeChange,
  onUseLocalDefaults,
  onConnect,
  onLaunchSimulator,
}: GatewayConnectScreenProps) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [showToken, setShowToken] = useState(false);
  const [isLaunchingSimulator, setIsLaunchingSimulator] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const tokenOptional =
    selectedAdapterType === "hermes" ||
    selectedAdapterType === "demo" ||
    selectedAdapterType === "custom";
  const isLocal = useMemo(() => isLocalGatewayUrl(gatewayUrl), [gatewayUrl]);
  const localPort = useMemo(() => resolveLocalGatewayPort(gatewayUrl), [gatewayUrl]);
  const localGatewayCommand = useMemo(
    () => `npx openclaw gateway run --bind loopback --port ${localPort} --verbose`,
    [localPort]
  );
  const localGatewayCommandPnpm = useMemo(
    () => `pnpm openclaw gateway run --bind loopback --port ${localPort} --verbose`,
    [localPort]
  );
  const localDemoCommand = useMemo(
    () => `npm run demo-gateway`,
    []
  );
  const useDemoPreset = () => {
    onAdapterTypeChange("demo");
  };
  const useHermesPreset = () => {
    onAdapterTypeChange("hermes");
  };
  const useOpenClawPreset = () => {
    onAdapterTypeChange("openclaw");
  };
  const useCustomPreset = () => {
    onAdapterTypeChange("custom");
  };
  const statusCopy = useMemo(() => {
    if (status === "connecting" && isLocal) {
      return `Gateway local detectado na porta ${localPort}. Conectando…`;
    }
    if (status === "connecting") {
      return "Conectando ao gateway remoto…";
    }
    if (isLocal) {
      return "Nenhum gateway local encontrado.";
    }
    return "Não conectado a um gateway.";
  }, [isLocal, localPort, status]);
  const connectDisabled = status === "connecting";
  const connectLabel = connectDisabled ? "Conectando…" : "Conectar";
  const statusDotClass =
    status === "connected"
      ? "ui-dot-status-connected"
      : status === "connecting"
        ? "ui-dot-status-connecting"
        : "ui-dot-status-disconnected";

  const copyLocalCommand = async () => {
    try {
      await navigator.clipboard.writeText(localGatewayCommand);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  const commandField = (
    <div className="space-y-1.5">
      <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-[var(--command-fg)]">
          {localGatewayCommand}
        </code>
        <button
          type="button"
          className="ui-btn-icon ui-command-copy h-7 w-7 shrink-0"
          onClick={copyLocalCommand}
          aria-label="Copy local gateway command"
          title="Copy command"
        >
          {copyStatus === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {copyStatus === "copied" ? (
        <p className="text-xs text-muted-foreground">Copiado!</p>
      ) : copyStatus === "failed" ? (
        <p className="ui-text-danger text-xs">Não foi possível copiar o comando.</p>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground">
          Em uma instalação via código-fonte, use <span className="font-mono text-foreground">{localGatewayCommandPnpm}</span>.
        </p>
      )}
    </div>
  );

  const remoteForm = (
    <div className="mt-2.5 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground/90">
        URL de Destino (Upstream)
        <input
          className="ui-input h-10 rounded-md px-4 font-sans text-sm text-foreground outline-none"
          type="text"
          value={gatewayUrl}
          onChange={(event) => onGatewayUrlChange(event.target.value)}
          placeholder="wss://seu-gateway.exemplo.com"
          spellCheck={false}
        />
      </label>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Using Tailscale?</p>
        <p>
          URL: <span className="font-mono">wss://&lt;your-tailnet-host&gt;</span>
        </p>
      </div>

      <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground/90">
        {tokenOptional ? "Token de acesso (opcional)" : "Token de acesso"}
        <div className="relative">
          <input
            className="ui-input h-10 w-full rounded-md px-4 pr-10 font-sans text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-muted-foreground"
            type={showToken ? "text" : "password"}
            value={tokenConfigured ? "********" : token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder={tokenConfigured ? "Token gerenciado pelo servidor" : (tokenOptional ? "token opcional" : "token do gateway")}
            spellCheck={false}
            disabled={tokenConfigured}
          />
          {!tokenConfigured && (
            <button
              type="button"
              className="ui-btn-icon absolute inset-y-0 right-1 my-auto h-8 w-8 border-transparent bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
              aria-label={showToken ? "Esconder token" : "Mostrar token"}
              onClick={() => setShowToken((prev) => !prev)}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4 transition-transform duration-150" />
              ) : (
                <Eye className="h-4 w-4 transition-transform duration-150" />
              )}
            </button>
          )}
        </div>
      </label>

      <button
        type="button"
        className="ui-btn-primary mt-1 h-11 w-full px-4 text-xs font-semibold tracking-[0.05em] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onConnect}
        disabled={connectDisabled || !gatewayUrl.trim()}
      >
        {connectLabel}
      </button>

      {status === "connecting" ? (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <RunningAvatarLoader size={16} trackWidth={32} inline />
          Connecting…
        </div>
      ) : null}
      {error ? <p className="ui-text-danger text-xs leading-snug">{error}</p> : null}
      {showApprovalHint && selectedAdapterType === "openclaw" ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
          <p className="leading-snug">
            Se a primeira tentativa de conexão não funcionou, vá até o computador do OpenClaw e aprove este
            dispositivo:
          </p>
          <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-md bg-[var(--command-bg)] px-2.5 py-2 font-mono text-[11px] text-[var(--command-fg)]">
            openclaw devices approve --latest
          </code>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col gap-5">
      <div className="ui-card px-4 py-2">
        <div className="flex items-center gap-2">
          {status === "connecting" ? (
            <RunningAvatarLoader size={18} trackWidth={36} inline />
          ) : (
            <span
              className={`h-2.5 w-2.5 ${statusDotClass}`}
            />
          )}
          <p className="text-sm font-semibold text-foreground">{statusCopy}</p>
        </div>
      </div>

      <div className="ui-card px-4 py-5 sm:px-6">
        <div>
          <p className="font-mono text-[10px] font-medium tracking-[0.06em] text-muted-foreground">
            Gateway Remoto (Recomendado)
          </p>
          <p className="mt-2 text-sm text-foreground/90">
            Escolha um backend e conecte-se à URL do gateway.
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Backend selecionado: {selectedAdapterType} | Backend ativo: {activeAdapterType}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada backend mantém sua própria URL e token salvos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useDemoPreset}
            >
              Demo backend
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useHermesPreset}
            >
              Backend Hermes
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useCustomPreset}
            >
              Backend Customizado
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useOpenClawPreset}
            >
              OpenClaw backend
            </button>
          </div>
        </div>
        {remoteForm}
      </div>

      <div className="ui-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
            Rodar localmente (opcional)
          </p>
          <p className="text-sm text-foreground/90">
            Inicie um processo de gateway local nesta máquina e conecte-se.
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {commandField}
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Apenas quer ver o escritório?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Rode <span className="font-mono text-foreground">{localDemoCommand}</span> para iniciar um gateway de demonstração ou clique no botão abaixo para iniciar o simulador integrado.
            </p>
            <button
              type="button"
              className="ui-btn-primary mt-2 h-9 w-full px-4 text-xs font-semibold tracking-[0.05em] disabled:opacity-50"
              onClick={async () => {
                setIsLaunchingSimulator(true);
                setLaunchError(null);
                try {
                  await onLaunchSimulator();
                  onAdapterTypeChange("demo");
                } catch (err) {
                  setLaunchError("Não foi possível iniciar o simulador.");
                } finally {
                  setIsLaunchingSimulator(false);
                }
              }}
              disabled={isLaunchingSimulator}
            >
              {isLaunchingSimulator ? "Iniciando Simulador..." : "Iniciar Simulador Interno"}
            </button>
            {launchError && <p className="mt-1 text-[10px] text-red-500">{launchError}</p>}
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Usando Hermes localmente?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Rode <span className="font-mono text-foreground">npm run hermes-adapter</span>, depois escolha
              <span className="font-mono text-foreground"> Backend Hermes</span>. A URL local padrão é
              <span className="font-mono text-foreground"> ws://localhost:18789</span>.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Using a custom runtime locally?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Choose <span className="font-mono text-foreground">Custom backend</span> and point the URL
              at your orchestrator or runtime boundary, for example
              <span className="font-mono text-foreground"> http://localhost:7770</span>. Direct custom
              runtime chat flows are not wired into Studio yet in this slice, but the provider seam and
              metadata scaffold are now in place.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Opening Claw3D from another machine?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Start Studio with <span className="font-mono text-foreground">HOST=0.0.0.0</span> (or a
              specific LAN/Tailscale host) and set
              <span className="font-mono text-foreground"> STUDIO_ACCESS_TOKEN</span> before exposing it
              beyond localhost. Gateway settings are stored on the Studio host, but OpenClaw device approval
              remains per browser/device.
            </p>
          </div>
          {localGatewayDefaults ? (
            <div className="ui-input rounded-md px-3 py-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Use token from <span className="font-mono">~/.openclaw/openclaw.json</span>.
                </p>
                <p className="font-mono text-[11px] text-foreground">
                  {localGatewayDefaults.url}
                </p>
                <button
                  type="button"
                  className="ui-btn-secondary h-9 w-full px-3 text-xs font-semibold tracking-[0.05em]"
                  onClick={onUseLocalDefaults}
                >
                  Usar padrões locais
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
