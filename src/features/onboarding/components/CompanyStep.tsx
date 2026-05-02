import { Building2, Sparkles, Users, Wand2 } from "lucide-react";

export type CompanyStepProps = {
  connected: boolean;
  agentCount: number;
  onOpenCompanyBuilder: () => void;
};

export const CompanyStep = ({
  connected,
  agentCount,
  onOpenCompanyBuilder,
}: CompanyStepProps) => {
  const canOpenBuilder = connected && agentCount > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Building2 className="h-5 w-5 text-amber-300" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Inicie sua empresa com IA</p>
            <p className="text-xs leading-5 text-white/60">
              Descreva o que sua empresa faz e a iAmobil pode transformar isso em uma estrutura completa
              com agentes especializados, arquivos de trabalho e instruções de cargo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "Refinar o briefing",
            description: "Use seu runtime conectado para aprimorar o prompt da empresa.",
          },
          {
            icon: Users,
            title: "Gerar a equipe",
            description: "Obtenha um organograma prático com cargos, responsabilidades e fluxos.",
          },
          {
            icon: Wand2,
            title: "Criar tudo",
            description: "Escreva arquivos de agentes e crie a equipe diretamente no runtime conectado.",
          },
        ].map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-3"
          >
            <Icon className="h-4 w-4 text-white/70" />
            <p className="mt-2 text-[11px] font-semibold text-white">{title}</p>
            <p className="mt-1 text-[10px] leading-4 text-white/45">{description}</p>
          </div>
        ))}
      </div>

      <div className="pt-4">
        {canOpenBuilder ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#1a1206] transition-colors hover:bg-amber-400"
              onClick={onOpenCompanyBuilder}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Abrir Construtor de Empresa
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/80">
            Conecte-se a um runtime e mantenha pelo menos um agente de planejamento disponível para gerar a
            empresa com IA.
          </div>
        )}
      </div>
    </div>
  );
};
