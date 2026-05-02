/**
 * Onboarding wizard types.
 *
 * The wizard is step-based and extensible: new steps can be added by
 * extending `OnboardingStepId` and registering a component in the
 * step registry.
 */

export type OnboardingStepId =
  | "welcome"
  | "prerequisites"
  | "connect"
  | "agents"
  | "company"
  | "complete";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  /** Whether the step can be skipped. */
  skippable: boolean;
};

export type OnboardingState = {
  currentStep: OnboardingStepId;
  completedSteps: Set<OnboardingStepId>;
  /** Whether the user has dismissed the wizard entirely. */
  dismissed: boolean;
  /** Gateway connection state passed from the parent. */
  gatewayConnected: boolean;
  /** Number of agents discovered after connection. */
  agentCount: number;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo à iAmobil",
    description: "Seu escritório de IA em 3D",
    skippable: false,
  },
  {
    id: "prerequisites",
    title: "Antes de Começar",
    description: "O que você vai precisar",
    skippable: true,
  },
  {
    id: "connect",
    title: "Conecte seu Gateway",
    description: "Vincule à sua instância de execução",
    skippable: false,
  },
  {
    id: "agents",
    title: "Seus Agentes",
    description: "Conheça sua equipe de IA",
    skippable: true,
  },
  {
    id: "company",
    title: "Construa sua Empresa",
    description: "Gere sua estrutura organizacional",
    skippable: true,
  },
  {
    id: "complete",
    title: "Tudo Pronto",
    description: "Comece a explorar",
    skippable: false,
  },
];

export const getStepIndex = (stepId: OnboardingStepId): number =>
  ONBOARDING_STEPS.findIndex((s) => s.id === stepId);

export const getNextStep = (
  currentId: OnboardingStepId,
): OnboardingStepId | null => {
  const idx = getStepIndex(currentId);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1].id;
};

export const getPrevStep = (
  currentId: OnboardingStepId,
): OnboardingStepId | null => {
  const idx = getStepIndex(currentId);
  if (idx <= 0) return null;
  return ONBOARDING_STEPS[idx - 1].id;
};
