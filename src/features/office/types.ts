

export type OpenClawLogEntry = {
  id: string;
  timestamp: string;
  eventName: string;
  eventKind: string;
  summary: string;
  role?: string;
  messageText?: string;
  thinkingText?: string;
  payloadText?: string;
  payload?: unknown;
};

export type ChatRosterEntry = {
  id: string;
  name: string;
  kind: "local" | "remote";
  isRunning: boolean;
};

export type RemoteChatSessionState = {
  draft: string;
  sending: boolean;
  error: string | null;
  messages: Array<{
    id: string;
    role: "user" | "system";
    text: string;
    timestampMs: number;
  }>;
};

export const EMPTY_REMOTE_CHAT_SESSION: RemoteChatSessionState = {
  draft: "",
  sending: false,
  error: null,
  messages: [],
};

// Re-exporting common types for convenience in office components
export type { OfficeAgent } from "@/features/retro-office/core/types";
export type { VoiceSendPayload } from "@/hooks/useVoiceRecorder";
