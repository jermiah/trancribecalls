"use client";

import type { TranscriptionProvider } from "@/lib/types";

interface Props {
  provider: TranscriptionProvider;
  deepgramApiKey: string;
  azureApiKey: string;
  azureRegion: string;
  onDeepgramChange: (v: string) => void;
  onAzureKeyChange: (v: string) => void;
  onAzureRegionChange: (v: string) => void;
  disabled?: boolean;
}

export function CredentialsForm({
  provider,
  deepgramApiKey,
  azureApiKey,
  azureRegion,
  onDeepgramChange,
  onAzureKeyChange,
  onAzureRegionChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-medium text-zinc-200">API credentials</h2>
      <p className="text-xs text-zinc-500">
        Keys stay in this browser tab only and are sent with each request. They are
        not stored on the server or written to logs.
      </p>

      {provider === "deepgram" ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-400">Deepgram API key</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={deepgramApiKey}
            onChange={(e) => onDeepgramChange(e.target.value)}
            placeholder="Your Deepgram API key"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/0 transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/30"
          />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-400">
              Azure Speech resource key
            </span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={azureApiKey}
              onChange={(e) => onAzureKeyChange(e.target.value)}
              placeholder="Ocp-Apim-Subscription-Key"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/0 transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/30"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-400">Region</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={azureRegion}
              onChange={(e) => onAzureRegionChange(e.target.value)}
              placeholder="e.g. eastus"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/0 transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/30"
            />
          </label>
        </div>
      )}
    </div>
  );
}
