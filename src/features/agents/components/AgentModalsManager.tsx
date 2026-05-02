"use client";

import React from "react";
import { AgentCreateModal } from "@/features/agents/components/AgentCreateModal";
import { AgentAvatarCreatorModal } from "@/features/agents/components/AgentAvatarCreatorModal";
import type { AgentState } from "@/features/agents/state/store";
import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";

export type AgentModalsManagerProps = {
  createAgentModalOpen: boolean;
  suggestedCreateAgentName: string;
  createAgentBusy: boolean;
  createAgentModalError: string | null;
  onCloseCreateModal: () => void;
  onCreateAgentSubmit: (payload: AgentCreateModalSubmitPayload) => void;

  avatarCreatorAgent: AgentState | null;
  onCloseAvatarCreator: () => void;
  onAvatarSave: (agentId: string, profile: AgentAvatarProfile) => void;

  createAgentBlock: {
    agentName: string;
    phase: "queued" | "creating";
  } | null;
  restartingMutationBlock: {
    agentName: string;
    phase: string;
  } | null;
  createBlockStatusLine: string | null;
  restartingMutationModalTestId: string | null;
  restartingMutationAriaLabel: string | null;
  restartingMutationHeading: string | null;
  restartingMutationStatusLine: string | null;
};

export const AgentModalsManager: React.FC<AgentModalsManagerProps> = ({
  createAgentModalOpen,
  suggestedCreateAgentName,
  createAgentBusy,
  createAgentModalError,
  onCloseCreateModal,
  onCreateAgentSubmit,
  avatarCreatorAgent,
  onCloseAvatarCreator,
  onAvatarSave,
  createAgentBlock,
  restartingMutationBlock,
  createBlockStatusLine,
  restartingMutationModalTestId,
  restartingMutationAriaLabel,
  restartingMutationHeading,
  restartingMutationStatusLine,
}) => {
  return (
    <>
      {createAgentModalOpen ? (
        <AgentCreateModal
          open={createAgentModalOpen}
          suggestedName={suggestedCreateAgentName}
          busy={createAgentBusy}
          submitError={createAgentModalError}
          onClose={onCloseCreateModal}
          onSubmit={onCreateAgentSubmit}
        />
      ) : null}

      {avatarCreatorAgent ? (
        <AgentAvatarCreatorModal
          open
          agentId={avatarCreatorAgent.agentId}
          agentName={avatarCreatorAgent.name}
          initialProfile={avatarCreatorAgent.avatarProfile}
          onClose={onCloseAvatarCreator}
          onSave={(profile) => onAvatarSave(avatarCreatorAgent.agentId, profile)}
        />
      ) : null}

      {createAgentBlock && createAgentBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
          data-testid="agent-create-restart-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Creating agent"
        >
          <div className="ui-panel w-full max-w-md p-6">
            <div className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
              Agent create in progress
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {createAgentBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until creation finishes.
            </div>
            {createBlockStatusLine ? (
              <div className="ui-card mt-4 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-foreground">
                {createBlockStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {restartingMutationBlock && restartingMutationBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
          data-testid={restartingMutationModalTestId ?? undefined}
          role="dialog"
          aria-modal="true"
          aria-label={restartingMutationAriaLabel ?? undefined}
        >
          <div className="ui-panel w-full max-w-md p-6">
            <div className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
              {restartingMutationHeading}
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {restartingMutationBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until the gateway restarts.
            </div>
            {restartingMutationStatusLine ? (
              <div className="ui-card mt-4 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-foreground">
                {restartingMutationStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
