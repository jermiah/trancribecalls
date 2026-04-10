import type { TranscriptionProvider } from "@/lib/types";

/**
 * Builds headers for API calls that carry provider credentials.
 * Keys are never persisted; only attached per request from in-memory state.
 */
export function buildCredentialHeaders(
  provider: TranscriptionProvider,
  deepgramApiKey: string,
  azureApiKey: string,
  azureRegion: string
): HeadersInit {
  if (provider === "deepgram") {
    return { "X-Deepgram-Api-Key": deepgramApiKey.trim() };
  }
  return {
    "X-Azure-Speech-Key": azureApiKey.trim(),
    "X-Azure-Speech-Region": azureRegion.trim().toLowerCase(),
  };
}
