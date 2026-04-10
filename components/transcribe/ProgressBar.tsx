"use client";

interface Props {
  completed: number;
  total: number;
  label?: string;
}

export function ProgressBar({ completed, total, label }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label ?? "Overall progress"}</span>
        <span>
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-600 to-emerald-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
