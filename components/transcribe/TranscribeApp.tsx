"use client";

import { buildCredentialHeaders } from "@/lib/api/client-headers";
import { isAllowedAudioVideoFile } from "@/lib/constants";
import {
  buildCombinedDocxBlob,
  buildSingleFileDocxBlob,
  type TranscriptSection,
} from "@/lib/docx/build-documents";
import { sortJobsAlphabetically, transcribeRemoteFile } from "@/lib/transcription/orchestrator";
import { uploadFileToBlob } from "@/lib/upload/client-blob-upload";
import type { FileJob, TranscriptionProvider } from "@/lib/types";
import { validateCredentialsForProvider } from "@/lib/validation/credentials";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useCallback, useMemo, useState } from "react";
import { CredentialsForm } from "./CredentialsForm";
import { FileDropzone } from "./FileDropzone";
import { FileJobList } from "./FileJobList";
import { ProgressBar } from "./ProgressBar";
import { ProviderSelector } from "./ProviderSelector";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function displayNameForFile(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (rel && rel.trim().length > 0) return rel;
  return file.name;
}

export function TranscribeApp() {
  const [provider, setProvider] = useState<TranscriptionProvider>("deepgram");
  const [deepgramApiKey, setDeepgramApiKey] = useState("");
  const [azureApiKey, setAzureApiKey] = useState("");
  const [azureRegion, setAzureRegion] = useState("");

  const [connectionMessage, setConnectionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [ignoredTypes, setIgnoredTypes] = useState<string[]>([]);

  const [includeTimestamps, setIncludeTimestamps] = useState(false);
  const [oneDocPerFile, setOneDocPerFile] = useState(false);

  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const sortedJobs = useMemo(() => sortJobsAlphabetically(jobs), [jobs]);

  const doneCount = useMemo(
    () => jobs.filter((j) => j.status === "completed" || j.status === "failed").length,
    [jobs]
  );

  const canTranscribe =
    jobs.length > 0 &&
    !busy &&
    !jobs.some(
      (j) => j.status === "uploading" || j.status === "transcribing"
    ) &&
    jobs.some((j) => j.status === "queued" || j.status === "failed");

  const allJobsFinished =
    jobs.length > 0 &&
    jobs.every((j) => j.status === "completed" || j.status === "failed");

  const addFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    const ignored: string[] = [];
    const next: FileJob[] = [];

    for (const file of arr) {
      if (!isAllowedAudioVideoFile(file)) {
        ignored.push(file.name);
        continue;
      }
      next.push({
        id: newId(),
        originalName: displayNameForFile(file),
        file,
        status: "queued",
      });
    }

    if (ignored.length) {
      setIgnoredTypes(ignored);
    } else {
      setIgnoredTypes([]);
    }

    if (next.length) {
      setJobs((prev) => sortJobsAlphabetically([...prev, ...next]));
      setActionError(null);
      setActionSuccess(null);
    }
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const retryJob = useCallback((id: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status: "queued" as const, errorMessage: undefined, transcript: undefined, blobUrl: undefined }
          : j
      )
    );
    setActionError(null);
  }, []);

  const testConnection = async () => {
    setConnectionMessage(null);
    const v = validateCredentialsForProvider(
      provider,
      deepgramApiKey,
      azureApiKey,
      azureRegion
    );
    if (!v.ok) {
      setConnectionMessage({ type: "error", text: v.errors.join(" ") });
      return;
    }

    setTesting(true);
    try {
      const path =
        provider === "deepgram"
          ? "/api/test-connection/deepgram"
          : "/api/test-connection/azure";
      const res = await fetch(path, {
        method: "POST",
        headers: {
          ...buildCredentialHeaders(
            provider,
            deepgramApiKey,
            azureApiKey,
            azureRegion
          ),
        },
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setConnectionMessage({
          type: "success",
          text: "Connection successful. You can start transcription.",
        });
      } else {
        setConnectionMessage({
          type: "error",
          text: data.error || "Connection test failed.",
        });
      }
    } catch {
      setConnectionMessage({
        type: "error",
        text: "Network error while testing the connection.",
      });
    } finally {
      setTesting(false);
    }
  };

  const runTranscription = async () => {
    setActionError(null);
    setActionSuccess(null);

    const v = validateCredentialsForProvider(
      provider,
      deepgramApiKey,
      azureApiKey,
      azureRegion
    );
    if (!v.ok) {
      setActionError(v.errors.join(" "));
      return;
    }

    setBusy(true);
    const order = sortJobsAlphabetically(jobs);

    for (const job of order) {
      if (job.status !== "queued" && job.status !== "failed") continue;

      if (!job.file) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "failed",
                  errorMessage: "Original file is no longer available. Re-add the file.",
                }
              : j
          )
        );
        continue;
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "uploading" } : j))
      );

      let blobUrl: string;
      try {
        const up = await uploadFileToBlob(job.file);
        blobUrl = up.url;
      } catch (e) {
        let msg = e instanceof Error ? e.message : "Upload failed.";
        if (msg.includes("client token") || msg.includes("BLOB_READ_WRITE_TOKEN")) {
          msg =
            "Upload blocked: BLOB_READ_WRITE_TOKEN is not set in Vercel. " +
            "Go to Vercel → your project → Storage → Blob → link the store, then redeploy.";
        } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          msg = `Network error during upload. Check your connection and try again. (${msg})`;
        }
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: "failed", errorMessage: msg, blobUrl: undefined }
              : j
          )
        );
        continue;
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, blobUrl, status: "transcribing" } : j
        )
      );

      const result = await transcribeRemoteFile(
        provider,
        blobUrl,
        job.originalName,
        includeTimestamps,
        deepgramApiKey,
        azureApiKey,
        azureRegion
      );

      if (result.error) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "failed",
                  errorMessage: result.error,
                }
              : j
          )
        );
      } else {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "completed",
                  transcript: result.transcript ?? "",
                  errorMessage: undefined,
                }
              : j
          )
        );
      }
    }

    setBusy(false);
    setActionSuccess("Transcription finished. You can download the Word document(s).");
  };

  const buildSections = (): TranscriptSection[] => {
    return sortedJobs.map((j) => ({
      title: j.originalName,
      body: j.transcript ?? "",
      failed: j.status === "failed",
    }));
  };

  const downloadCombined = async () => {
    setActionError(null);
    try {
      const sections = buildSections();
      if (!sections.length) {
        setActionError("No files to export.");
        return;
      }
      const blob = await buildCombinedDocxBlob(sections);
      saveAs(blob, "all_call_transcripts.docx");
      setActionSuccess("Downloaded all_call_transcripts.docx");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not build document.");
    }
  };

  const downloadPerFileZip = async () => {
    setActionError(null);
    try {
      const sections = buildSections();
      if (!sections.length) {
        setActionError("No files to export.");
        return;
      }
      const zip = new JSZip();
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const safe =
          sec.title
            .replace(/[/\\]/g, "_")
            .replace(/[^\w.\-]+/g, "_")
            .slice(0, 80) || `call_${i + 1}`;
        const blob = await buildSingleFileDocxBlob(sec);
        zip.file(`${String(i + 1).padStart(2, "0")}_${safe}.docx`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      saveAs(out, "call_transcripts.zip");
      setActionSuccess("Downloaded call_transcripts.zip");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not build zip.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Call recording transcription
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Upload call recordings, validate your speech provider, transcribe with
          Deepgram or Azure, and export a polished Word document. Large files upload
          directly to blob storage so they never hit the small Vercel function body
          limit.
        </p>
      </header>

      <ProviderSelector value={provider} onChange={setProvider} disabled={busy} />

      <CredentialsForm
        provider={provider}
        deepgramApiKey={deepgramApiKey}
        azureApiKey={azureApiKey}
        azureRegion={azureRegion}
        onDeepgramChange={setDeepgramApiKey}
        onAzureKeyChange={setAzureApiKey}
        onAzureRegionChange={setAzureRegion}
        disabled={busy}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={testing || busy}
          onClick={() => void testConnection()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-500 disabled:opacity-50"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>

      {connectionMessage ? (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            connectionMessage.type === "success"
              ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-100"
              : "border-rose-700/60 bg-rose-950/40 text-rose-100"
          }`}
        >
          {connectionMessage.text}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/30 p-4">
        <h2 className="text-sm font-medium text-zinc-200">Files</h2>
        <FileDropzone onFiles={addFiles} disabled={busy} />
        {ignoredTypes.length ? (
          <p className="text-xs text-amber-200">
            Skipped unsupported types (only .mp3 and .mp4 are accepted):{" "}
            {ignoredTypes.slice(0, 8).join(", ")}
            {ignoredTypes.length > 8 ? "…" : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-4 border-t border-zinc-800 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              className="accent-sky-500"
              checked={includeTimestamps}
              onChange={(e) => setIncludeTimestamps(e.target.checked)}
              disabled={busy}
            />
            Include timestamps in transcripts
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              className="accent-sky-500"
              checked={oneDocPerFile}
              onChange={(e) => setOneDocPerFile(e.target.checked)}
              disabled={busy}
            />
            Offer one .docx per file (zip download)
          </label>
        </div>

        <ProgressBar
          completed={doneCount}
          total={jobs.length}
          label="Files finished (success or failed)"
        />

        <FileJobList
          jobs={sortedJobs}
          onRemove={removeJob}
          onRetry={retryJob}
          expandedPreviewId={expandedPreviewId}
          onTogglePreview={setExpandedPreviewId}
          disabled={busy}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canTranscribe}
          onClick={() => void runTranscription()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Working…" : "Transcribe and generate document"}
        </button>
        <button
          type="button"
          disabled={busy || !allJobsFinished}
          onClick={() => void downloadCombined()}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
        >
          Download combined Word doc
        </button>
        {oneDocPerFile ? (
          <button
            type="button"
            disabled={busy || !allJobsFinished}
            onClick={() => void downloadPerFileZip()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
          >
            Download zip (one doc per file)
          </button>
        ) : null}
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          {actionError}
        </div>
      ) : null}
      {actionSuccess ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100"
        >
          {actionSuccess}
        </div>
      ) : null}
    </div>
  );
}
