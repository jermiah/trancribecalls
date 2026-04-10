import type { TranscriptionProvider } from "@/lib/types";

export interface CredentialValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateCredentialsForProvider(
  provider: TranscriptionProvider,
  deepgramApiKey: string,
  azureApiKey: string,
  azureRegion: string
): CredentialValidationResult {
  const errors: string[] = [];
  const dg = deepgramApiKey.trim();
  const azKey = azureApiKey.trim();
  const azRegion = azureRegion.trim().toLowerCase();

  if (provider === "deepgram") {
    if (!dg) errors.push("Deepgram API key is required.");
    else if (dg.length < 20) errors.push("Deepgram API key looks too short.");
  }

  if (provider === "azure") {
    if (!azKey) errors.push("Azure Speech API key is required.");
    else if (azKey.length < 20) errors.push("Azure API key looks too short.");
    if (!azRegion) errors.push("Azure region is required (e.g. eastus).");
    else if (!/^[a-z0-9]+$/i.test(azRegion))
      errors.push("Azure region should contain only letters and numbers.");
  }

  return { ok: errors.length === 0, errors };
}
