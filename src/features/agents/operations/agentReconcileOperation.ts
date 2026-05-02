import type { AgentState } from "@/features/agents/state/store";
import {
  buildReconcileTerminalPatch,
  resolveReconcileEligibility,
  resolveReconcileWaitOutcome,
} from "@/features/agents/operations/fleetLifecycleWorkflow";

type GatewayClientLike = {
  call: (method: string, params: unknown) => Promise<unknown>;
};

export type ReconcileCommand =
  | { kind: "clearRunTracking"; runId: string }
  | { kind: "dispatchUpdateAgent"; agentId: string; patch: Partial<AgentState> }
  | { kind: "requestHistoryRefresh"; agentId: string }
  | { kind: "reconcileAgents"; validAgentIds: string[] }
  | { kind: "logInfo"; message: string }
  | { kind: "logWarn"; message: string; error: unknown };

type ReconcileDispatchAction = {
  type: "updateAgent";
  agentId: string;
  patch: Partial<AgentState>;
};

export const executeAgentReconcileCommands = (params: {
  commands: ReconcileCommand[];
  dispatch: (action: ReconcileDispatchAction) => void;
  clearRunTracking: (runId: string) => void;
  requestHistoryRefresh: (agentId: string) => void;
  reconcileAgents: (validAgentIds: string[]) => void;
  logInfo: (message: string) => void;
  logWarn: (message: string, error: unknown) => void;
}) => {
  for (const command of params.commands) {
    if (command.kind === "clearRunTracking") {
      params.clearRunTracking(command.runId);
      continue;
    }
    if (command.kind === "dispatchUpdateAgent") {
      params.dispatch({
        type: "updateAgent",
        agentId: command.agentId,
        patch: command.patch,
      });
      continue;
    }
    if (command.kind === "requestHistoryRefresh") {
      params.requestHistoryRefresh(command.agentId);
      continue;
    }
    if (command.kind === "reconcileAgents") {
      if ("reconcileAgents" in params && typeof params.reconcileAgents === "function") {
        params.reconcileAgents(command.validAgentIds);
      }
      continue;
    }
    if (command.kind === "logInfo") {
      params.logInfo(command.message);
      continue;
    }
    if (command.kind === "logWarn") {
      params.logWarn(command.message, command.error);
    }
  }
};

export const runAgentReconcileOperation = async (params: {
  client: GatewayClientLike;
  agents: AgentState[];
  getLatestAgent: (agentId: string) => AgentState | null;
  claimRunId: (runId: string) => boolean;
  releaseRunId: (runId: string) => void;
  isDisconnectLikeError: (error: unknown) => boolean;
}): Promise<ReconcileCommand[]> => {
  const commands: ReconcileCommand[] = [];

  // Phase 1: Fleet Reconciliation (Ghost Agent Pruning)
  try {
    const listResult = (await params.client.call("agents.list", {})) as {
      agents: Array<{ id: string }>;
    };
    const validAgentIds = (listResult?.agents ?? []).map((a) => a.id);
    if (validAgentIds.length > 0) {
      commands.push({ kind: "reconcileAgents", validAgentIds });
    }
  } catch (err) {
    if (!params.isDisconnectLikeError(err)) {
      commands.push({
        kind: "logWarn",
        message: "Failed to fetch agents list for reconciliation.",
        error: err,
      });
    }
  }

  // Phase 2: Running Agent Reconciliation (Existing Logic)
  for (const agent of params.agents) {
    const eligibility = resolveReconcileEligibility({
      status: agent.status,
      sessionCreated: agent.sessionCreated,
      runId: agent.runId,
    });
    if (!eligibility.shouldCheck) continue;

    const runId = agent.runId?.trim() ?? "";
    if (!runId) continue;

    if (!params.claimRunId(runId)) continue;

    try {
      const result = (await params.client.call("agent.wait", {
        runId,
        timeoutMs: 1,
      })) as { status?: unknown };
      const outcome = resolveReconcileWaitOutcome(result?.status);
      if (!outcome) {
        continue;
      }

      const latest = params.getLatestAgent(agent.agentId);
      if (!latest || latest.runId !== runId || latest.status !== "running") {
        continue;
      }

      commands.push({ kind: "clearRunTracking", runId });
      commands.push({
        kind: "dispatchUpdateAgent",
        agentId: agent.agentId,
        patch: buildReconcileTerminalPatch({ outcome }),
      });
      commands.push({
        kind: "logInfo",
        message: `[agent-reconcile] ${agent.agentId} run ${runId} resolved as ${outcome}.`,
      });
      commands.push({
        kind: "requestHistoryRefresh",
        agentId: agent.agentId,
      });
    } catch (err) {
      if (!params.isDisconnectLikeError(err)) {
        commands.push({
          kind: "logWarn",
          message: "Failed to reconcile running agent.",
          error: err,
        });
      }
    } finally {
      params.releaseRunId(runId);
    }
  }

  return commands;
};
