export type VoiceTranscriptionResult = {
  transcript: string;
  provider: string;
  model: string;
  decision: any;
  ignored: boolean;
};

export type VoiceTranscriptionOptions = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
};

export function normalizeVoiceMimeType(mimeType: string): string {
  if (mimeType.startsWith("audio/webm")) return "audio/webm";
  if (mimeType.startsWith("audio/mp4")) return "audio/mp4";
  if (mimeType.startsWith("audio/ogg")) return "audio/ogg";
  return "audio/webm";
}

export function inferVoiceFileExtension(fileName: string, mimeType?: string): string {
  if (fileName.toLowerCase().endsWith(".m4a")) return ".m4a";
  if (fileName.toLowerCase().endsWith(".ogg")) return ".ogg";
  if (fileName.toLowerCase().endsWith(".webm")) return ".webm";
  
  if (mimeType === "audio/ogg") return ".ogg";
  if (mimeType === "audio/mp4") return ".m4a";
  return ".webm";
}

export function sanitizeVoiceFileName(fileName: string, mimeType: string): string {
  let name = fileName.split(/[\\\/]/).pop() || "";
  name = name.trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\.]/g, "")
    .replace(/^\-+|\-+$/g, "");

  const ext = inferVoiceFileExtension(name, mimeType);
  const base = name.replace(/\.[^/.]+$/, "");
  
  return (base || "voice-note") + ext;
}

export function buildVoiceTranscriptionErrorMessage(decision: any): string {
  if (decision.outcome === "disabled") return "Transcription is disabled.";
  if (decision.outcome === "skipped") {
    const reason = decision.attachments?.[0]?.attempts?.[0]?.reason || "no explanation provided";
    return `Transcription skipped: ${reason}`;
  }
  return "An error occurred during transcription.";
}

export function shouldIgnoreVoiceTranscription(result: any): boolean {
  return !result.transcript;
}

export async function transcribeVoiceWithOpenClaw(
  options: VoiceTranscriptionOptions
): Promise<VoiceTranscriptionResult> {
  console.log("[stub] transcribeVoiceWithOpenClaw called for:", options.fileName);
  return {
    transcript: "(Áudio recebido, transcrição temporariamente indisponível.)",
    provider: "stub",
    model: "stub",
    decision: { outcome: "transcribed" },
    ignored: false,
  };
}
