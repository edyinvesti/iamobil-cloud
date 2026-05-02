/**
 * AgentsStep — Shows discovered agents after gateway connection.
 */
import { Bot, Users, WifiOff } from "lucide-react";

export type AgentsStepProps = {
  agentCount: number;
  connected: boolean;
};

export const AgentsStep = ({ agentCount, connected }: AgentsStepProps) => {
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <WifiOff className="h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">
          Conecte-se ao seu gateway primeiro para descobrir agentes.
        </p>
      </div>
    );
  }

  if (agentCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Bot className="h-6 w-6 text-white/40" />
          </div>
          <p className="text-sm font-medium text-white">Nenhum agente encontrado</p>
          <p className="max-w-xs text-center text-xs text-white/55">
            Seu gateway está conectado, mas nenhum agente configurado ainda.
            Você pode criar agentes na barra lateral da frota da iAmobil após
            completar este assistente.
          </p>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-medium text-white/80">Quick start:</p>
          <ol className="mt-2 space-y-1.5 text-[11px] text-white/55">
            <li>1. Clique no botão + na barra lateral</li>
            <li>2. Escolha um nome e modelo para seu agente</li>
            <li>3. Configure habilidades e personalidade</li>
            <li>4. Veja seu agente aparecer na mesa dele!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <Users className="h-5 w-5 text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-white">
            {agentCount} agente{agentCount !== 1 ? "s" : ""} descoberto{agentCount !== 1 ? "s" : ""}
          </p>
          <p className="text-[11px] text-white/55">
            Sua equipe de IA está pronta e esperando no escritório.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/70">
          What you can do with agents:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Chat", desc: "Envie mensagens e receba respostas" },
            { label: "Aprovar", desc: "Revise e aprove comandos de execução" },
            { label: "Configurar", desc: "Edite arquivos de cérebro e ajustes" },
            { label: "Monitorar", desc: "Acompanhe a atividade em tempo real" },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[11px] font-semibold text-white">{label}</p>
              <p className="text-[10px] text-white/45">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
