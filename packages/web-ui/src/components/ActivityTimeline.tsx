import { cn } from "../tokens.js";
import { formatDateTime } from "../lib/format.js";
import { StatusBadge } from "./StatusBadge.js";

export interface TimelineEntry {
  id: string;
  title: string;
  status?: string | undefined;
  description?: string | undefined;
  timestamp: string;
}

export function ActivityTimeline({
  entries,
  emptyMessage = "No activity recorded yet.",
  className,
}: {
  entries: TimelineEntry[];
  emptyMessage?: string | undefined;
  className?: string | undefined;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-[#64786E]">{emptyMessage}</p>;
  }

  return (
    <ol className={cn("relative space-y-4 border-l border-[#E2EBE6] pl-5", className)}>
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#235347] ring-1 ring-[#235347]/30"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#0D2621]">{entry.title}</span>
              {entry.status && <StatusBadge status={entry.status} />}
            </div>
            <time className="text-xs text-[#64786E]">{formatDateTime(entry.timestamp)}</time>
          </div>
          {entry.description && <p className="mt-1 text-xs text-[#52665F]">{entry.description}</p>}
        </li>
      ))}
    </ol>
  );
}
