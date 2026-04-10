"use client";

import { useRef } from "react";

interface Props {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-900/30 px-4 py-8 text-center transition hover:border-sky-500/50 hover:bg-zinc-900/50 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <p className="text-sm font-medium text-zinc-200">
          Drop .mp3 / .mp4 files here
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Or click to select multiple files. Folder selection works in Chromium-based
          browsers (see README for limitations).
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".mp3,.mp4,audio/mpeg,audio/mp4,video/mp4"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) onFiles(list);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          Choose files
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => folderInputRef.current?.click()}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Choose folder
        </button>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) onFiles(list);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
