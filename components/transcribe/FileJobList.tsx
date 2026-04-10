"use client";

import type { FileJob, FileJobStatus } from "@/lib/types";

const statusLabel: Record<FileJobStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  transcribing: "Transcribing",
  completed: "Completed",
  failed: "Failed",
};

const statusClass: Record<FileJobStatus, string> = {
  queued: "bg-zinc-700 text-zinc-200",
  uploading: "bg-amber-500/20 text-amber-200",
  transcribing: "bg-sky-500/20 text-sky-200",
  completed: "bg-emerald-500/20 text-emerald-200",
  failed: "bg-rose-500/20 text-rose-200",
};

interface Props {
  jobs: FileJob[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  expandedPreviewId: string | null;
  onTogglePreview: (id: string | null) => void;
  disabled?: boolean;
}

export function FileJobList({
  jobs,
  onRemove,
  onRetry,
  expandedPreviewId,
  onTogglePreview,
  disabled,
}: Props) {
  if (!jobs.length) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500">
        No files yet. Add call recordings to begin.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {jobs.map((job) => {
        const open = expandedPreviewId === job.id;
        return (
          <li
            key={job.id}
            className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-mono text-sm text-zinc-100"
                  title={job.originalName}
                >
                  {job.originalName}
                </p>
                {job.errorMessage ? (
                  <p className="mt-1 text-xs text-rose-300">{job.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[job.status]}`}
                >
                  {statusLabel[job.status]}
                </span>
                {job.status === "failed" ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRetry(job.id)}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50"
                  >
                    Retry
                  </button>
                ) : null}
                {job.transcript && job.status === "completed" ? (
                  <button
                    type="button"
                    onClick={() => onTogglePreview(open ? null : job.id)}
                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                  >
                    {open ? "Hide preview" : "Preview"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={disabled || job.status === "uploading" || job.status === "transcribing"}
                  onClick={() => onRemove(job.id)}
                  className="text-xs text-zinc-500 hover:text-rose-300 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
            {open && job.transcript ? (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">
                {job.transcript}
              </pre>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
