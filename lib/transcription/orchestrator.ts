import { buildCredentialHeaders } from "@/lib/api/client-headers";
import type { FileJob, TranscriptionProvider } from "@/lib/types";

export interface TranscribeOneResult {
  transcript?: string;
  error?: string;
}

export async function transcribeRemoteFile(
  provider: TranscriptionProvider,
  blobUrl: string,
  filename: string,
  includeTimestamps: boolean,
  deepgramApiKey: string,
  azureApiKey: string,
  azureRegion: string
): Promise<TranscribeOneResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...buildCredentialHeaders(provider, deepgramApiKey, azureApiKey, azureRegion),
  };

  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider,
      blobUrl,
      filename,
      includeTimestamps,
    }),
  });

  const data = (await res.json()) as { transcript?: string; error?: string };

  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }

  return { transcript: data.transcript };
}

export function sortJobsAlphabetically(jobs: FileJob[]): FileJob[] {
  return [...jobs].sort((a, b) =>
    a.originalName.localeCompare(b.originalName, undefined, {
      sensitivity: "base",
    })
  );
}
