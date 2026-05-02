/**
 * WelcomeStep — First onboarding screen introducing Claw3D.
 */
import { Building2, Eye, MessageSquare, Users } from "lucide-react";

const features = [
  {
    icon: Eye,
    title: "Observe agentes",
    description: "Veja seus agentes de IA em tempo real em um escritório 3D compartilhado",
  },
  {
    icon: Users,
    title: "Gerencie sua frota",
    description: "Crie, configure e monitore agentes em um só lugar",
  },
  {
    icon: MessageSquare,
    title: "Chat e aprovação",
    description: "Fale com agentes, aprove comandos e revise o trabalho deles",
  },
  {
    icon: Building2,
    title: "Construa seu escritório",
    description: "Personalize salas, mesas e todo o layout do escritório",
  },
] as const;

export const WelcomeStep = () => (
  <div className="space-y-5">
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-white/80">
        A <span className="font-medium text-white">iAmobil</span> transforma sua automação de IA em um <span className="font-medium text-white">local de trabalho visual</span> — um escritório onde seus agentes de IA colaboram, programam, testam e executam tarefas em um ambiente 3D compartilhado.
      </p>
      <p className="text-sm text-white/60">
        Este assistente ajudará você a se conectar ao seu gateway de execução e começar em cerca de dois minutos.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {features.map(({ icon: Icon, title, description }) => (
        <div
          key={title}
          className="rounded-lg border border-white/8 bg-white/[0.03] px-3.5 py-3"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="text-xs font-semibold text-white">{title}</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-white/55">
            {description}
          </p>
        </div>
      ))}
    </div>
  </div>
);
