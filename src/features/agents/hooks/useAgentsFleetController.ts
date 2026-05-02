import { useState, useMemo, useCallback } from "react";
import type { AgentState, FocusFilter } from "@/features/agents/state/store";

export type SettingsRouteTab = "personality" | "automations" | "skills" | "system" | "advanced" | "capabilities";

export type InspectSidebarState = {
  agentId: string;
  tab: SettingsRouteTab;
};

export type UseAgentsFleetControllerParams = {
  agents: AgentState[];
};

export function useAgentsFleetController(params: { agents: AgentState[] }) {
  const { agents } = params;

  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [mobilePane, setMobilePane] = useState<"fleet" | "chat">("chat");
  const [avatarCreatorAgentId, setAvatarCreatorAgentId] = useState<string | null>(null);
  const [inspectSidebar, setInspectSidebar] = useState<InspectSidebarState | null>(null);
  const [personalityHasUnsavedChanges, setPersonalityHasUnsavedChanges] = useState(false);
  const [systemInitialSkillKey, setSystemInitialSkillKey] = useState<string | null>(null);

  const avatarCreatorAgent = useMemo(
    () => (avatarCreatorAgentId ? agents.find((a) => a.agentId === avatarCreatorAgentId) ?? null : null),
    [agents, avatarCreatorAgentId]
  );

  const inspectSidebarAgent = useMemo(
    () => (inspectSidebar?.agentId ? agents.find((a) => a.agentId === inspectSidebar.agentId) ?? null : null),
    [agents, inspectSidebar?.agentId]
  );

  const clearInspectSidebar = useCallback(() => setInspectSidebar(null), []);

  return {
    focusFilter,
    setFocusFilter,
    mobilePane,
    setMobilePane,
    avatarCreatorAgentId,
    setAvatarCreatorAgentId,
    avatarCreatorAgent,
    inspectSidebar,
    setInspectSidebar,
    inspectSidebarAgent,
    clearInspectSidebar,
    personalityHasUnsavedChanges,
    setPersonalityHasUnsavedChanges,
    systemInitialSkillKey,
    setSystemInitialSkillKey,
  };
}
