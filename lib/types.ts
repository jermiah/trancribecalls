export type TranscriptionProvider = "deepgram" | "azure";

export type FileJobStatus =
  | "queued"
  | "uploading"
  | "transcribing"
  | "completed"
  | "failed";

export interface FileJob {
  id: string;
  /** Original filename exactly as provided by the user */
  originalName: string;
  /** Selected File object (browser); cleared after upload to avoid huge memory if desired */
  file?: File;
  blobUrl?: string;
  status: FileJobStatus;
  errorMessage?: string;
  transcript?: string;
}

export interface CredentialHeaders {
  deepgramApiKey?: string;
  azureApiKey?: string;
  azureRegion?: string;
}
