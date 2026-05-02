/**
 * PrerequisitesStep — Tells users what they need before connecting.
 */
import { CheckCircle2, ExternalLink } from "lucide-react";

const prerequisites = [
  {
    label: "iAmobil instalado",
    detail: "Instale via npm, pnpm ou a partir do código-fonte",
    link: "https://docs.openclaw.ai",
    linkLabel: "Documentação de instalação",
  },
  {
    label: "Gateway em execução",
    detail: "Inicie com: openclaw gateway start",
    command: "openclaw gateway start",
  },
  {
    label: "URL e Token do Gateway",
    detail: "Encontrado em ~/.openclaw/openclaw.json ou na sua configuração remota",
  },
  {
    label: "Node.js 20+",
    detail: "Necessário para rodar a iAmobil localmente",
    link: "https://nodejs.org",
    linkLabel: "Baixar Node.js",
  },
] as const;

export const PrerequisitesStep = () => (
  <div className="space-y-2.5">
    <p className="text-[13px] leading-5 text-white/70">
      Certifique-se de ter tudo pronto antes de conectar. Se você já tem a
      iAmobil rodando, pode pular este passo.
    </p>

    <div className="space-y-1.5">
      {prerequisites.map(({ label, detail, ...rest }) => (
        <div
          key={label}
          className="flex gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
        >
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white">{label}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-white/55">{detail}</p>
            {"command" in rest ? (
              <code className="mt-1 block rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                {rest.command}
              </code>
            ) : null}
            {"link" in rest && rest.link ? (
              <a
                href={rest.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[10px] leading-4 text-amber-300 hover:text-amber-200"
              >
                {rest.linkLabel ?? "Saiba mais"}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>

    <p className="text-[10px] leading-4 text-white/40">
      Precisa de ajuda? Confira{" "}
      <a
        href="https://docs.openclaw.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-300/70 hover:text-amber-200"
      >
        docs.openclaw.ai
      </a>{" "}
      ou{" "}
      <a
        href="https://discord.com/invite/clawd"
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-300/70 hover:text-amber-200"
      >
        entre no Discord
      </a>
      .
    </p>
  </div>
);
