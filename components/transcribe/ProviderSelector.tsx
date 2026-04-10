"use client";

import type { TranscriptionProvider } from "@/lib/types";

const options: { id: TranscriptionProvider; label: string; hint: string }[] = [
  {
    id: "deepgram",
    label: "Deepgram",
    hint: "Pre-recorded API, tuned for phone / call audio (nova-2-phonecall).",
  },
  {
    id: "azure",
    label: "Azure Speech Services",
    hint: "Continuous recognition via Speech SDK on the server (MP3 / MP4).",
  },
];

interface Props {
  value: TranscriptionProvider;
  onChange: (p: TranscriptionProvider) => void;
  disabled?: boolean;
}

export function ProviderSelector({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-zinc-200">
        Transcription provider
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer flex-col rounded-xl border px-4 py-3 transition ${
                active
                  ? "border-sky-500/80 bg-sky-500/10 ring-1 ring-sky-500/40"
                  : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="provider"
                  className="h-4 w-4 accent-sky-500"
                  checked={active}
                  onChange={() => onChange(opt.id)}
                />
                <span className="font-semibold text-zinc-100">{opt.label}</span>
              </div>
              <p className="mt-1 pl-6 text-xs leading-relaxed text-zinc-400">
                {opt.hint}
              </p>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
