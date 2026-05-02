"use client";

import React from "react";
import { ChevronDown, MessageSquare, Mic } from "lucide-react";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { HQSidebar } from "@/features/office/components/HQSidebar";
import { InboxPanel } from "@/features/office/components/panels/InboxPanel";
import { HistoryPanel } from "@/features/office/components/panels/HistoryPanel";
import { TaskBoardPanel } from "@/features/office/components/panels/TaskBoardPanel";
import { PlaybooksPanel } from "@/features/office/components/panels/PlaybooksPanel";
import { AnalyticsPanel } from "@/features/office/components/panels/AnalyticsPanel";
import { SkillsMarketplaceModal } from "@/features/office/components/panels/SkillsMarketplaceModal";
import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import {
  RemoteAgentChatPanel,
  type RemoteAgentChatMessage,
} from "@/features/office/components/RemoteAgentChatPanel";
import {
  AgentEditorModal,
  type AgentEditorSection,
} from "@/features/agents/components/AgentEditorModal";
import { AgentCreateWizardModal } from "@/features/agents/components/AgentCreateWizardModal";
import { CompanyBuilderModal } from "@/features/company-builder/components/CompanyBuilderModal";
import { KanbanDisabledPanel } from "@/features/office/components/panels/KanbanDisabledPanel";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type {
  OpenClawLogEntry,
  ChatRosterEntry,
  RemoteChatSessionState,
  VoiceSendPayload,
} from "../types";
import { PersonalityBuilderDraft } from "@/lib/agents/personalityBuilder";
import { AgentAvatarProfile } from "@/lib/avatars/profile";
import { HQSidebarTab } from "@/features/office/components/HQSidebar";
import type {
  StudioGatewayAdapterType,
  StudioGatewaySettings,
} from "@/lib/studio/settings";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

export type OfficeOverlaysProps = {
  // Connectivity & Loading
  showGatewayLoadingOverlay: boolean;
  showGatewayConnectOverlay: boolean;
  status: GatewayStatus;
  gatewayUrl: string;
  token: string;
  tokenConfigured: boolean;
  selectedAdapterType: StudioGatewayAdapterType;
  activeAdapterType: StudioGatewayAdapterType;
  localGatewayDefaults: StudioGatewaySettings | null;
  gatewayError: string | null;
  didAttemptGatewayConnect: boolean;
  onGatewayUrlChange: (val: string) => void;
  onTokenChange: (val: string) => void;
  setTokenConfigured: (val: boolean) => void;
  onAdapterTypeChange: (val: StudioGatewayAdapterType) => void;
  onUseLocalDefaults: () => void;
  onConnect: () => any;
  onLaunchSimulator: () => any;

  // Fleet & Status
  agents: AgentState[];
  agentsLoaded: boolean;
  showEmptyFleetBanner: boolean;
  emptyFleetMessage: string;
  deleteAgentStatusLine: string | null;
  runningCount: number;
  unseenInboxCount: number;

  // Sidebar
  sidebarOpen: boolean;
  activeSidebarTab: HQSidebarTab;
  onToggleSidebar: () => void;
  onTabChange: (tab: HQSidebarTab) => void;
  onOpenMarketplace: () => void;
  onAddAgent: () => void;
  onOpenCompanyBuilder: () => void;

  // Marketplace
  marketplaceOpen: boolean;
  marketplace: any;
  onCloseMarketplace: () => void;
  onSelectAgent: (id: string) => void;
  onOpenAgentSettings: (id: string) => void;

  // Onboarding
  showOnboardingWizard: boolean;
  companyCreatedSignal: number;
  createdCompanyName: string | null;
  onCompleteOnboarding: () => void;
  onOpenOnboarding: () => void;

  // Console
  showOpenClawConsole: boolean;
  openClawConsoleCollapsed: boolean;
  openClawConsoleSearch: string;
  openClawConsoleCopyStatus: string;
  filteredOpenClawLogEntries: OpenClawLogEntry[];
  openClawLogEntries: OpenClawLogEntry[];
  openClawLiveStateMatchesSearch: boolean;
  openClawLiveStateText: string;
  onSetOpenClawConsoleCollapsed: (val: boolean) => void;
  onSetOpenClawConsoleSearch: (val: string) => void;
  onCopyOpenClawConsoleJson: () => void;
  onDownloadOpenClawConsoleJson: () => void;
  onClearOpenClawConsole: () => void;
  renderOpenClawHighlightedText: (text: string, search: string) => React.ReactNode;

  // Chat
  chatOpen: boolean;
  onToggleChat: () => void;
  chatRosterEntries: ChatRosterEntry[];
  selectedChatAgentId: string | null;
  focusedChatAgent: any;
  focusedRemoteChatTarget: any;
  focusedRemoteChatState: RemoteChatSessionState | null;
  chatController: any;
  gatewayModels: GatewayModelChoice[];
  remoteMessagingAvailable: boolean;
  remoteMessagingDisabledReason: string | null;
  onOpenAgentChat: (id: string) => void;
  onChatSend: (agentId: string, sessionKey: string, message: string) => Promise<void>;
  onVoiceSend: (payload: VoiceSendPayload) => Promise<void>;
  updateRemoteChatSession: (id: string, updater: (session: RemoteChatSessionState) => RemoteChatSessionState) => void;
  dispatch: any;

  // Voice
  mainVoiceState: string;
  mainVoiceError: string | null;
  mainVoiceSupported: boolean;

  // Debug
  debugEnabled: boolean;
  debugRows: any[];

  // Modals
  agentEditorAgent: AgentState | null;
  agentEditorInitialSection: string;
  onCloseAgentEditor: () => void;
  onAvatarSave: (id: string, profile: AgentAvatarProfile) => void;
  onRenameAgent: (id: string, name: string) => Promise<boolean>;
  onDeleteAgent: (id: string) => void;
  onNavigateAgent: (id: string, section: any) => void;

  createAgentWizardNonce: number;
  createAgentWizardOpen: boolean;
  createAgentBusy: boolean;
  createAgentModalError: string | null;
  createAgentStatusLine: string | null;
  onCloseCreateAgentWizard: (id: string | null) => void;
  onCreateAgentFromIdentity: (identity: any) => Promise<string | null>;
  onFinishCreateAgentAvatar: (params: { agentId: string; draft: PersonalityBuilderDraft; profile: AgentAvatarProfile; }) => Promise<void>;

  companyBuilderNonce: number;
  companyBuilderOpen: boolean;
  companyBuilderBusy: boolean;
  companyBuilderError: string | null;
  companyBuilderStatusLine: string | null;
  companyBuilderInput: any;
  lastCompanyPlan: any;
  plannerAgent: any;
  onCloseCompanyBuilder: () => void;
  onClearCompanyBuilder: () => void;
  onImproveCompanyBrief: (brief: string) => Promise<string>;
  onGenerateCompanyPlan: (brief: string) => Promise<any>;
  onCreateCompanyFromPlan: (params: { input: any; plan: any }) => Promise<void>;

  kanbanInstallPromptOpen: boolean;
  kanbanInstallProgress: any;
  onCloseKanbanInstall: () => void;
  onInstallKanban: () => void;

  // Panels
  taskBoard: any;
  standupController: any;
  client: any;
  settingsCoordinator: any;
  runLog: any;
};

export const OfficeOverlays: React.FC<OfficeOverlaysProps> = (props) => {
  const {
    showGatewayLoadingOverlay,
    showGatewayConnectOverlay,
    status,
    gatewayUrl,
    token,
    tokenConfigured,
    selectedAdapterType,
    activeAdapterType,
    localGatewayDefaults,
    gatewayError,
    didAttemptGatewayConnect,
    onGatewayUrlChange,
    onTokenChange,
    setTokenConfigured,
    onAdapterTypeChange,
    onUseLocalDefaults,
    onConnect,
    onLaunchSimulator,

    agents,
    agentsLoaded,
    showEmptyFleetBanner,
    emptyFleetMessage,
    deleteAgentStatusLine,
    runningCount,
    unseenInboxCount,

    sidebarOpen,
    activeSidebarTab,
    onToggleSidebar,
    onTabChange,
    onOpenMarketplace,
    onAddAgent,
    onOpenCompanyBuilder,

    marketplaceOpen,
    marketplace,
    onCloseMarketplace,
    onSelectAgent,
    onOpenAgentSettings,

    showOnboardingWizard,
    companyCreatedSignal,
    createdCompanyName,
    onCompleteOnboarding,
    onOpenOnboarding,

    showOpenClawConsole,
    openClawConsoleCollapsed,
    openClawConsoleSearch,
    openClawConsoleCopyStatus,
    filteredOpenClawLogEntries,
    openClawLogEntries,
    openClawLiveStateMatchesSearch,
    openClawLiveStateText,
    onSetOpenClawConsoleCollapsed,
    onSetOpenClawConsoleSearch,
    onCopyOpenClawConsoleJson,
    onDownloadOpenClawConsoleJson,
    onClearOpenClawConsole,
    renderOpenClawHighlightedText,

    chatOpen,
    onToggleChat,
    chatRosterEntries,
    selectedChatAgentId,
    focusedChatAgent,
    focusedRemoteChatTarget,
    focusedRemoteChatState,
    chatController,
    gatewayModels,
    remoteMessagingAvailable,
    remoteMessagingDisabledReason,
    onOpenAgentChat,
    onChatSend,
    onVoiceSend,
    updateRemoteChatSession,
    dispatch,

    mainVoiceState,
    mainVoiceError,
    mainVoiceSupported,

    debugEnabled,
    debugRows,

    agentEditorAgent,
    agentEditorInitialSection,
    onCloseAgentEditor,
    onAvatarSave,
    onRenameAgent,
    onDeleteAgent,
    onNavigateAgent,

    createAgentWizardNonce,
    createAgentWizardOpen,
    createAgentBusy,
    createAgentModalError,
    createAgentStatusLine,
    onCloseCreateAgentWizard,
    onCreateAgentFromIdentity,
    onFinishCreateAgentAvatar,

    companyBuilderNonce,
    companyBuilderOpen,
    companyBuilderBusy,
    companyBuilderError,
    companyBuilderStatusLine,
    companyBuilderInput,
    lastCompanyPlan,
    plannerAgent,
    onCloseCompanyBuilder,
    onClearCompanyBuilder,
    onImproveCompanyBrief,
    onGenerateCompanyPlan,
    onCreateCompanyFromPlan,
    kanbanInstallPromptOpen,
    kanbanInstallProgress,
    onCloseKanbanInstall,
    onInstallKanban,

    taskBoard,
    standupController,
    client,
    settingsCoordinator,
    runLog,
  } = props;

  return (
    <>
      {showGatewayLoadingOverlay ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#120a05]/76"
          aria-label="Connecting to runtime"
          role="status"
        >
          <div className="rounded-xl border border-amber-700/45 bg-[#1a1008] px-8 py-6 shadow-2xl">
            <RunningAvatarLoader
              size={28}
              trackWidth={76}
              label="Connecting to your runtime..."
              labelClassName="text-amber-100/80"
            />
          </div>
        </div>
      ) : null}

      {showGatewayConnectOverlay ? (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-start justify-center bg-[#120a05]/76 px-4 py-10">
          <div className="w-full max-w-[860px] rounded-2xl border border-amber-900/55 bg-[#120a05]/98 p-3 shadow-2xl">
              <GatewayConnectScreen
                gatewayUrl={gatewayUrl}
                token={token}
                tokenConfigured={tokenConfigured}
                selectedAdapterType={selectedAdapterType}
                activeAdapterType={activeAdapterType}
                localGatewayDefaults={localGatewayDefaults}
                status={status}
                error={gatewayError}
                showApprovalHint={didAttemptGatewayConnect}
                onGatewayUrlChange={onGatewayUrlChange}
                onTokenChange={onTokenChange}
                setTokenConfigured={setTokenConfigured}
                onAdapterTypeChange={onAdapterTypeChange}
                onUseLocalDefaults={onUseLocalDefaults}
                onConnect={onConnect}
                onLaunchSimulator={onLaunchSimulator}
              />
          </div>
        </div>
      ) : null}

      {showEmptyFleetBanner ? (
        <div className="pointer-events-none fixed left-1/2 top-16 z-40 w-full max-w-xl -translate-x-1/2 px-4">
          <div className="pointer-events-auto rounded-lg border border-amber-400/35 bg-black/80 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/80">
                  Office fleet status
                </p>
                <p className="mt-1 text-sm text-amber-50">{emptyFleetMessage}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="ui-btn-secondary px-3 py-2 text-xs font-semibold tracking-[0.05em] text-foreground"
                  onClick={() => {
                    onAddAgent();
                  }}
                >
                  Add Agent
                </button>
                <button
                  type="button"
                  className="ui-btn-secondary px-3 py-2 text-xs font-semibold tracking-[0.05em] text-foreground"
                  onClick={() => {
                    onOpenCompanyBuilder();
                  }}
                >
                  Build Company
                </button>
                <button
                  type="button"
                  className="ui-btn-secondary px-3 py-2 text-xs font-semibold tracking-[0.05em] text-foreground"
                  onClick={() => {
                    void onTabChange("analytics");
                  }}
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteAgentStatusLine ? (
        <div className="pointer-events-none fixed left-1/2 top-5 z-40 -translate-x-1/2 px-4">
          <div className="pointer-events-auto rounded-lg border border-red-400/30 bg-black/85 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-red-200/75">
              Alteração de frota
            </div>
            <div className="mt-1 text-sm text-red-50">{deleteAgentStatusLine}</div>
          </div>
        </div>
      ) : null}

      {!debugEnabled ? (
        <HQSidebar
          open={sidebarOpen}
          activeTab={activeSidebarTab}
          inboxCount={unseenInboxCount}
          onToggle={onToggleSidebar}
          onTabChange={onTabChange}
          onOpenMarketplace={onOpenMarketplace}
          onAddAgent={onAddAgent}
          onOpenCompanyBuilder={onOpenCompanyBuilder}
          inboxPanel={
            <InboxPanel
              agents={agents}
              onSelectAgent={(agentId) => {
                onOpenAgentChat(agentId);
                onTabChange("inbox");
              }}
            />
          }
          historyPanel={
            <HistoryPanel
              runs={runLog}
              agents={agents}
              onSelectAgent={(agentId) => {
                onOpenAgentChat(agentId);
                onTabChange("history");
              }}
            />
          }
          kanbanPanel={
            <TaskBoardPanel
              agents={agents}
              cardsByStatus={taskBoard.cardsByStatus}
              selectedCard={taskBoard.selectedCard}
              activeRuns={taskBoard.activeRuns}
              cronJobs={taskBoard.cronJobs}
              cronLoading={taskBoard.cronLoading}
              cronError={
                taskBoard.sharedTasksError ?? taskBoard.gatewayTasksError ?? taskBoard.cronError
              }
              taskCaptureDebug={showOpenClawConsole ? taskBoard.taskCaptureDebug : undefined}
              onCreateCard={() => {
                taskBoard.createManualCard();
                onTabChange("kanban");
              }}
              onMoveCard={taskBoard.moveCard}
              onSelectCard={taskBoard.selectCard}
              onUpdateCard={taskBoard.updateCard}
              onDeleteCard={taskBoard.removeCard}
              onRefreshCronJobs={() => {
                void taskBoard.refreshSharedTasks();
                void taskBoard.refreshRemoteTasks();
                void taskBoard.refreshCronJobs();
              }}
            />
          }
          playbooksPanel={
            <PlaybooksPanel
              client={client}
              status={status}
              cronEnabled={true} // Hardcoded for now or pass from props
              agents={agents}
              standup={standupController}
            />
          }
          analyticsPanel={
            <AnalyticsPanel
              client={client}
              status={status}
              approvalsEnabled={true} // Hardcoded for now
              agents={agents}
              runLog={runLog}
              gatewayUrl={gatewayUrl}
              settingsCoordinator={settingsCoordinator}
              onSelectAgent={(agentId) => {
                onOpenAgentChat(agentId);
                onTabChange("analytics");
              }}
            />
          }
        />
      ) : null}

      <SkillsMarketplaceModal
        open={marketplaceOpen}
        marketplace={marketplace}
        onClose={onCloseMarketplace}
        onSelectAgent={(agentId) => {
          onOpenAgentChat(agentId);
          onCloseMarketplace();
        }}
        onOpenAgentSettings={(agentId) => {
          onOpenAgentChat(agentId);
          onCloseMarketplace();
        }}
      />

      {showOnboardingWizard ? (
        <OnboardingWizard
          key={companyCreatedSignal > 0 ? `onboarding-company-created-${companyCreatedSignal}` : "onboarding-default"}
          gatewayConnected={status === "connected"}
          agentCount={agents.length}
          gatewayUrl={gatewayUrl}
          token={token}
          onGatewayUrlChange={onGatewayUrlChange}
          onTokenChange={onTokenChange}
          onConnect={() => {
            void onConnect();
          }}
          onComplete={onCompleteOnboarding}
          onOpenCompanyBuilder={onOpenCompanyBuilder}
          initialStep={companyCreatedSignal > 0 ? "complete" : "welcome"}
          initialCompletedSteps={
            companyCreatedSignal > 0
              ? ["welcome", "prerequisites", "connect", "agents", "company", "complete"]
              : undefined
          }
          createdCompanyName={createdCompanyName}
          companyCreated={companyCreatedSignal > 0}
          connectionError={gatewayError}
          connecting={status === "connecting"}
        />
      ) : null}

      {showOpenClawConsole ? (
        <section className="pointer-events-auto fixed bottom-3 left-3 z-30 flex w-[520px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded border border-cyan-500/25 bg-black/78 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-cyan-500/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">
            <span>Console de Eventos iAmobil</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-100/45">
                agents {agents.length} | events{" "}
                {filteredOpenClawLogEntries.length}/{openClawLogEntries.length}
              </span>
              <button
                type="button"
                onClick={onCopyOpenClawConsoleJson}
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                {openClawConsoleCopyStatus === "copied"
                  ? "Copied"
                  : openClawConsoleCopyStatus === "error"
                    ? "Copy Failed"
                    : "Copy JSON"}
              </button>
              <button
                type="button"
                onClick={onDownloadOpenClawConsoleJson}
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={onClearOpenClawConsole}
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() =>
                  onSetOpenClawConsoleCollapsed(!openClawConsoleCollapsed)
                }
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                {openClawConsoleCollapsed ? "Expand" : "Minimize"}
              </button>
            </div>
          </div>
          {!openClawConsoleCollapsed ? (
            <div className="flex h-[320px] flex-col gap-3 overflow-y-auto bg-[#02090b]/96 px-3 py-2 font-mono text-[10px] leading-4">
              <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={openClawConsoleSearch}
                    onChange={(event) =>
                      onSetOpenClawConsoleSearch(event.target.value)
                    }
                    placeholder="Search logs, payloads, thinking, user text."
                    className="min-w-0 flex-1 rounded border border-cyan-500/20 bg-black/35 px-2 py-1 text-[10px] normal-case tracking-normal text-cyan-50 placeholder:text-cyan-100/30 focus:border-cyan-400/40 focus:outline-none"
                  />
                  {openClawConsoleSearch ? (
                    <button
                      type="button"
                      onClick={() => onSetOpenClawConsoleSearch("")}
                      className="rounded border border-cyan-500/20 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
              {openClawLiveStateMatchesSearch ? (
                <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2">
                  <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-cyan-300/70">
                    Live OpenClaw State
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-cyan-100/80">
                    {renderOpenClawHighlightedText(
                      openClawLiveStateText,
                      openClawConsoleSearch,
                    )}
                  </pre>
                </div>
              ) : (
                <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2 text-cyan-100/45">
                  Live OpenClaw state does not match the current search.
                </div>
              )}
              <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-300/70">
                Raw OpenClaw Gateway Events
              </div>
              {filteredOpenClawLogEntries.length === 0 ? (
                <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2 text-cyan-100/45">
                  {openClawLogEntries.length === 0
                    ? "No OpenClaw gateway events received yet."
                    : "No OpenClaw events match the current search."}
                </div>
              ) : (
                filteredOpenClawLogEntries.map((entry) => {
                  const isUserMessage = entry.role === "user";
                  return (
                    <div
                      key={entry.id}
                      className={`rounded border p-2 ${
                        isUserMessage
                          ? "border-amber-400/30 bg-amber-950/12"
                          : "border-cyan-500/12 bg-cyan-950/8"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className={`text-[9px] uppercase tracking-[0.16em] ${
                            isUserMessage
                              ? "text-amber-300/85"
                              : "text-cyan-300/75"
                          }`}
                        >
                          {renderOpenClawHighlightedText(
                            `[${entry.timestamp}] ${entry.eventName} / ${entry.eventKind}`,
                            openClawConsoleSearch,
                          )}
                        </div>
                        {entry.role ? (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${
                              isUserMessage
                                ? "bg-amber-400/15 text-amber-200"
                                : "bg-cyan-400/10 text-cyan-200/80"
                            }`}
                          >
                            {entry.role}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-cyan-100/55">
                        {renderOpenClawHighlightedText(
                          entry.summary,
                          openClawConsoleSearch,
                        )}
                      </div>
                      {entry.messageText ? (
                        <div className="mt-2 rounded border border-amber-400/20 bg-amber-950/25 px-2 py-1 text-amber-100">
                          <div className="text-[9px] uppercase tracking-[0.16em] text-amber-300/75">
                            User / Message Text
                          </div>
                          <div className="mt-1 whitespace-pre-wrap break-words">
                            {renderOpenClawHighlightedText(
                              entry.messageText,
                              openClawConsoleSearch,
                            )}
                          </div>
                        </div>
                      ) : null}
                      {entry.thinkingText ? (
                        <div className="mt-2 rounded border border-fuchsia-400/15 bg-fuchsia-950/15 px-2 py-1 text-fuchsia-100/90">
                          <div className="text-[9px] uppercase tracking-[0.16em] text-fuchsia-300/70">
                            Thinking
                          </div>
                          <div className="mt-1 whitespace-pre-wrap break-words">
                            {renderOpenClawHighlightedText(
                              entry.thinkingText,
                              openClawConsoleSearch,
                            )}
                          </div>
                        </div>
                      ) : null}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[9px] uppercase tracking-[0.16em] text-cyan-300/55">
                          Raw Payload
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap break-words text-cyan-100/45">
                          {renderOpenClawHighlightedText(
                            entry.payloadText || "",
                            openClawConsoleSearch,
                          )}
                        </pre>
                      </details>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <div
        className={`fixed bottom-3 z-30 flex flex-col items-end gap-2 ${sidebarOpen ? "right-84" : "right-3"} ${
          debugEnabled ? "hidden" : ""
        }`}
      >
        {chatOpen && (
          <div
            className="flex overflow-hidden rounded border border-white/10 bg-[#0e0a04] shadow-2xl"
            style={{ width: 560, height: 520 }}
          >
            <div className="flex w-44 shrink-0 flex-col border-r border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white/60">
                  Agentes
                </span>
                <span className="font-mono text-[10px] text-white/40">
                  {chatRosterEntries.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatRosterEntries.length === 0 ? (
                  <div className="px-3 py-4 font-mono text-[11px] text-white/30">
                    Sem agentes.
                  </div>
                ) : (
                  chatRosterEntries.map((agent) => {
                    const isSelected = agent.id === selectedChatAgentId;
                    const isRunning = agent.isRunning;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => onOpenAgentChat(agent.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-white/10 text-white"
                            : "text-white/50 hover:bg-white/5 hover:text-white/80"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${isRunning ? "bg-emerald-400" : "bg-white/20"}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                          {agent.name}
                        </span>
                        {agent.kind === "remote" ? (
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-300/60">
                            Remoto
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {focusedChatAgent ? (
                <AgentChatPanel
                  agent={focusedChatAgent}
                  isSelected={false}
                  canSend={status === "connected"}
                  models={gatewayModels}
                  stopBusy={
                    chatController.stopBusyAgentId === focusedChatAgent.agentId
                  }
                  onLoadMoreHistory={() => {}}
                  onOpenSettings={() =>
                    onNavigateAgent(focusedChatAgent.agentId, "IDENTITY.md")
                  }
                  onNewSession={() =>
                    chatController.handleNewSession(focusedChatAgent.agentId)
                  }
                  onModelChange={(value) =>
                    dispatch({
                      type: "updateAgent",
                      agentId: focusedChatAgent.agentId,
                      patch: { model: value ?? undefined },
                    })
                  }
                  onThinkingChange={(value) =>
                    dispatch({
                      type: "updateAgent",
                      agentId: focusedChatAgent.agentId,
                      patch: { thinkingLevel: value ?? undefined },
                    })
                  }
                  onDraftChange={(value) =>
                    chatController.handleDraftChange(
                      focusedChatAgent.agentId,
                      value,
                    )
                  }
                  onSend={(message) => {
                    void onChatSend(
                      focusedChatAgent.agentId,
                      focusedChatAgent.sessionKey,
                      message,
                    );
                  }}
                  onRemoveQueuedMessage={(index) =>
                    chatController.removeQueuedMessage(
                      focusedChatAgent.agentId,
                      index,
                    )
                  }
                  onStopRun={() => {
                    void chatController.handleStopRun(
                      focusedChatAgent.agentId,
                      focusedChatAgent.sessionKey,
                    );
                  }}
                  onAvatarShuffle={() =>
                    onNavigateAgent(focusedChatAgent.agentId, "avatar")
                  }
                  onVoiceSend={onVoiceSend}
                />
              ) : focusedRemoteChatTarget && focusedRemoteChatState ? (
                <RemoteAgentChatPanel
                  agentName={focusedRemoteChatTarget.name}
                  canSend={remoteMessagingAvailable}
                  sending={focusedRemoteChatState.sending}
                  draft={focusedRemoteChatState.draft}
                  error={focusedRemoteChatState.error}
                  messages={focusedRemoteChatState.messages as any}
                  disabledReason={remoteMessagingDisabledReason}
                  onDraftChange={(value) => {
                    updateRemoteChatSession(focusedRemoteChatTarget.id, (session: any) => ({
                      ...session,
                      draft: value,
                      error: null,
                    }));
                  }}
                  onSend={(message) => {
                    void onChatSend(focusedRemoteChatTarget.id, "", message);
                  }}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center font-mono text-[12px] text-white/30">
                  Selecione um agente para conversar.
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleChat}
          className="flex items-center gap-1.5 rounded border border-amber-700/50 bg-[#0e0a04]/90 px-3 py-1.5 font-mono text-[11px] font-medium tracking-wider text-amber-500/80 shadow-lg backdrop-blur transition-colors hover:border-amber-600/70 hover:text-amber-400"
        >
          {chatOpen ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>ESCONDER CHAT</span>
            </>
          ) : (
            <>
              <MessageSquare className="h-3.5 w-3.5" />
              <span>CHAT</span>
              {runningCount > 0 ? (
                <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-400">
                  {runningCount}
                </span>
              ) : null}
            </>
          )}
        </button>
      </div>

      {mainVoiceState !== "idle" || mainVoiceError ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div
            className={`flex min-w-[220px] items-center gap-3 rounded-full border px-4 py-3 font-mono text-[12px] shadow-2xl backdrop-blur ${
              mainVoiceError
                ? "border-red-500/45 bg-red-950/75 text-red-100"
                : "border-cyan-400/35 bg-black/70 text-white"
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                mainVoiceState === "recording"
                  ? "bg-red-500/25 text-red-200"
                  : mainVoiceState === "transcribing"
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "bg-white/10 text-white"
              }`}
            >
              <Mic className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                Main agent
              </span>
              <span className="text-[12px] font-medium text-white">
                {mainVoiceError
                  ? mainVoiceError
                  : mainVoiceState === "recording"
                    ? "Ouvindo. Solte a tecla Option para enviar."
                    : mainVoiceState === "transcribing"
                      ? "Transcrevendo sua nota de voz."
                      : "Atalho de voz pronto."}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {debugEnabled ? (
        <section className="fixed bottom-3 right-3 z-50 max-h-[45vh] w-[560px] overflow-auto rounded border border-slate-700 bg-black/90 p-3 font-mono text-[11px] text-slate-100">
          <div className="mb-2 font-semibold text-cyan-300">office debug</div>
          <div className="space-y-2">
            {debugRows.map((row) => (
              <div key={row.agentId} className="rounded border border-slate-800 p-2">
                <div className="text-cyan-200">
                  {row.name} ({row.agentId})
                </div>
                <div>{row.storeStatus} | {row.inferenceSource}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {agentEditorAgent ? (
        <AgentEditorModal
          key={`${agentEditorAgent.agentId}:${agentEditorInitialSection}`}
          open
          client={client}
          agents={agents}
          agent={agentEditorAgent}
          initialSection={agentEditorInitialSection as any}
          onClose={onCloseAgentEditor}
          onAvatarSave={onAvatarSave}
          onRename={onRenameAgent}
          onDelete={onDeleteAgent}
          onNavigateAgent={onNavigateAgent}
        />
      ) : null}

      <AgentCreateWizardModal
        key={`create-agent-${createAgentWizardNonce}`}
        open={createAgentWizardOpen}
        suggestedName={`Agent ${agents.length + 1}`}
        busy={createAgentBusy}
        submitError={createAgentModalError}
        statusLine={createAgentStatusLine}
        onClose={onCloseCreateAgentWizard}
        onCreateAgent={onCreateAgentFromIdentity}
        onFinishWizard={onFinishCreateAgentAvatar}
      />

      <CompanyBuilderModal
        key={`company-builder-${companyBuilderNonce}`}
        open={companyBuilderOpen}
        connected={status === "connected"}
        agentCount={agents.length}
        plannerAgentName={plannerAgent?.name ?? null}
        busy={companyBuilderBusy}
        error={companyBuilderError}
        statusLine={companyBuilderStatusLine}
        initialInput={companyBuilderInput}
        initialPlan={lastCompanyPlan}
        onClose={onCloseCompanyBuilder}
        onClear={onClearCompanyBuilder}
        onImproveBrief={onImproveCompanyBrief}
        onGeneratePlan={onGenerateCompanyPlan}
        onCreateCompany={onCreateCompanyFromPlan}
      />

      {kanbanInstallPromptOpen ? (
        <KanbanDisabledPanel
          onClose={onCloseKanbanInstall}
          onInstall={onInstallKanban}
          installing={kanbanInstallProgress.active}
          progressPercent={kanbanInstallProgress.percent}
          progressMessage={kanbanInstallProgress.message}
          errorMessage={kanbanInstallProgress.error}
        />
      ) : null}
    </>
  );
};
