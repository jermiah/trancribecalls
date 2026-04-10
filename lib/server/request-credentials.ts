import { NextRequest } from "next/server";
import type { TranscriptionProvider } from "@/lib/types";

export interface ParsedCredentials {
  provider: TranscriptionProvider;
  deepgramApiKey?: string;
  azureApiKey?: string;
  azureRegion?: string;
}

export function parseCredentialsFromRequest(
  request: NextRequest,
  provider: TranscriptionProvider
): ParsedCredentials {
  if (provider === "deepgram") {
    const key = request.headers.get("x-deepgram-api-key")?.trim();
    return { provider, deepgramApiKey: key };
  }
  const key = request.headers.get("x-azure-speech-key")?.trim();
  const region = request.headers.get("x-azure-speech-region")?.trim();
  return { provider, azureApiKey: key, azureRegion: region };
}

export function assertDeepgramKey(c: ParsedCredentials): string {
  const k = c.deepgramApiKey;
  if (!k) throw new Error("Missing Deepgram API key.");
  return k;
}

export function assertAzureCreds(c: ParsedCredentials): { key: string; region: string } {
  const key = c.azureApiKey;
  const region = c.azureRegion?.toLowerCase();
  if (!key) throw new Error("Missing Azure Speech API key.");
  if (!region) throw new Error("Missing Azure Speech region.");
  return { key, region };
}
