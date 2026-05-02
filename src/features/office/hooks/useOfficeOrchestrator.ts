"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { OfficeAgent } from "@/features/retro-office/core/types";
import type { AgentState } from "@/features/agents/state/store";
import {
  createOfficeAnimationTriggerState,
  reconcileOfficeAnimationTriggerState,
  buildOfficeAnimationState,
  type OfficeAnimationTriggerState,
  type OfficeAnimationState,
} from "@/lib/office/eventTriggers";
import { buildOfficeDeskMonitor, type OfficeDeskMonitor } from "@/lib/office/deskMonitor";
import {
  buildOfficeSkillTriggerHoldMaps,
  isOfficeSkillTriggerMovementTarget,
  type OfficeSkillTriggerMovementTarget,
} from "@/lib/office/places";

const ITEMS = [
  "globe",
  "books",
  "coffee",
  "palette",
  "camera",
  "waveform",
  "shield",
  "fire",
  "plant",
  "laptop",
];

const getDeterministicItem = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ITEMS[Math.abs(hash) % ITEMS.length];
};

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

const mapAgentToOffice = (agent: AgentState): OfficeAgent => {
  if (agent.status === "error") {
    return {
      id: agent.agentId,
      name: agent.name || "Unknown",
      subtitle: agent.role ?? null,
      status: "error",
      color: stringToColor(agent.agentId),
      item: getDeterministicItem(agent.agentId),
      avatarProfile: agent.avatarProfile ?? null,
    };
  }
  const isWorking = agent.status === "running" || Boolean(agent.runId);
  return {
    id: agent.agentId,
    name: agent.name || "Unknown",
    subtitle: agent.role ?? null,
    status: isWorking ? "working" : "idle",
    color: stringToColor(agent.agentId),
    item: getDeterministicItem(agent.agentId),
    avatarProfile: agent.avatarProfile ?? null,
  };
};

const mapRemotePresenceAgentToOffice = (agent: {
  agentId: string;
  name: string;
  state: "idle" | "working" | "meeting" | "error";
}): OfficeAgent => {
  const stableId = `remote:${agent.agentId}`;
  const isWorking = agent.state === "working" || agent.state === "meeting";
  return {
    id: stableId,
    name: agent.name || "Unknown",
    status: agent.state === "error" ? "error" : isWorking ? "working" : "idle",
    color: stringToColor(stableId),
    item: getDeterministicItem(stableId),
    avatarProfile: null,
  };
};

export type UseOfficeOrchestratorParams = {
  agents: AgentState[];
  remoteAgents?: OfficeAgent[];
  marketplaceGymHoldByAgentId: Record<string, boolean>;
  danceUntilByAgentId: Record<string, number>;
  movementTargetByAgentId: Record<string, string | null>;
  nowMs: number;
};

export function useOfficeOrchestrator({
  agents,
  remoteAgents = [],
  marketplaceGymHoldByAgentId,
  danceUntilByAgentId,
  movementTargetByAgentId,
  nowMs,
}: UseOfficeOrchestratorParams) {
  const [officeTriggerState, setOfficeTriggerState] = useState<OfficeAnimationTriggerState>(() =>
    createOfficeAnimationTriggerState(),
  );

  const deskMonitorCacheRef = useRef<Map<string, { agent: AgentState; monitor: OfficeDeskMonitor }>>(
    new Map(),
  );

  const officeAnimationState = useMemo<OfficeAnimationState>(() => {
    const base = buildOfficeAnimationState({
      state: officeTriggerState,
      agents,
      marketplaceGymHoldByAgentId,
      nowMs,
    });
    const filteredMovementTargets: Record<string, OfficeSkillTriggerMovementTarget> = {};
    for (const [agentId, target] of Object.entries(movementTargetByAgentId)) {
      if (isOfficeSkillTriggerMovementTarget(target)) {
        filteredMovementTargets[agentId] = target;
      }
    }
    const skillTriggerHoldMaps = buildOfficeSkillTriggerHoldMaps(filteredMovementTargets);

    return {
      ...base,
      danceUntilByAgentId,
      deskHoldByAgentId: {
        ...base.deskHoldByAgentId,
        ...skillTriggerHoldMaps.deskHoldByAgentId,
      },
      githubHoldByAgentId: {
        ...base.githubHoldByAgentId,
        ...skillTriggerHoldMaps.githubHoldByAgentId,
      },
      gymHoldByAgentId: {
        ...base.gymHoldByAgentId,
        ...skillTriggerHoldMaps.gymHoldByAgentId,
      },
      jukeboxHoldByAgentId: {
        ...base.jukeboxHoldByAgentId,
        ...skillTriggerHoldMaps.jukeboxHoldByAgentId,
      },
      qaHoldByAgentId: {
        ...base.qaHoldByAgentId,
        ...skillTriggerHoldMaps.qaHoldByAgentId,
      },
      skillGymHoldByAgentId: {
        ...base.skillGymHoldByAgentId,
        ...skillTriggerHoldMaps.skillGymHoldByAgentId,
      },
    };
  }, [
    officeTriggerState,
    agents,
    marketplaceGymHoldByAgentId,
    nowMs,
    danceUntilByAgentId,
    movementTargetByAgentId,
  ]);

  const allVisibleAgents = useMemo(() => {
    const {
      deskHoldByAgentId,
      githubHoldByAgentId,
      gymHoldByAgentId,
      jukeboxHoldByAgentId,
      phoneBoothHoldByAgentId,
      smsBoothHoldByAgentId,
      qaHoldByAgentId,
    } = officeAnimationState;

    const local = agents.map((agent) => {
      const isWorking =
        agent.status === "running" ||
        Boolean(agent.runId) ||
        deskHoldByAgentId[agent.agentId] ||
        githubHoldByAgentId[agent.agentId] ||
        gymHoldByAgentId[agent.agentId] ||
        jukeboxHoldByAgentId[agent.agentId] ||
        phoneBoothHoldByAgentId[agent.agentId] ||
        smsBoothHoldByAgentId[agent.agentId] ||
        qaHoldByAgentId[agent.agentId] ||
        (danceUntilByAgentId[agent.agentId] ?? 0) > nowMs;

      const officeAgent = mapAgentToOffice(agent);
      return {
        ...officeAgent,
        status: agent.status === "error" ? "error" : isWorking ? "working" : "idle",
      } as OfficeAgent;
    });

    return [...local, ...remoteAgents];
  }, [agents, remoteAgents, officeAnimationState, danceUntilByAgentId, nowMs]);

  const monitorByAgentId = useMemo(() => {
    const nextCache = new Map<string, { agent: AgentState; monitor: OfficeDeskMonitor }>();
    const nextMonitorByAgentId: Record<string, OfficeDeskMonitor> = {};

    for (const agent of agents) {
      const existing = deskMonitorCacheRef.current.get(agent.agentId);
      if (existing && existing.agent === agent) {
        nextCache.set(agent.agentId, existing);
        nextMonitorByAgentId[agent.agentId] = existing.monitor;
        continue;
      }
      const monitor = buildOfficeDeskMonitor(agent);
      nextCache.set(agent.agentId, { agent, monitor });
      nextMonitorByAgentId[agent.agentId] = monitor;
    }

    deskMonitorCacheRef.current = nextCache;
    return nextMonitorByAgentId;
  }, [agents]);

  const reconcileTriggers = useCallback((agents: AgentState[]) => {
    setOfficeTriggerState((current) =>
      reconcileOfficeAnimationTriggerState({ state: current, agents }),
    );
  }, []);

  return {
    allVisibleAgents,
    monitorByAgentId,
    officeTriggerState,
    officeAnimationState,
    setOfficeTriggerState,
    reconcileTriggers,
  };
}
