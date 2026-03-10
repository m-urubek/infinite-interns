import { useThreads } from "../hooks/useThreads";
import type { ThreadSummary } from "../hooks/useThreads";
import { RefreshCw, Loader2, Plug, AlertCircle } from "lucide-react";

interface ThreadListProps {
  onAttach: (threadId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-white/20 text-white/70",
  busy: "bg-tertiary/30 text-tertiary",
  interrupted: "bg-amber-500/30 text-amber-300",
  error: "bg-red-500/30 text-red-300",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function ThreadRow({ thread, onAttach }: { thread: ThreadSummary; onAttach: (id: string) => void }) {
  const statusColor = STATUS_COLORS[thread.status] ?? STATUS_COLORS.idle;
  const label = thread.assignment ? truncate(thread.assignment, 80) : "No assignment";

  return (
    <div className="thread-row group flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5">
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${thread.assignment ? "text-white/80" : "text-white/40 italic"} truncate`}>{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] font-heading font-medium uppercase px-1.5 py-0.5 rounded-md ${statusColor}`}>
            {thread.status}
          </span>
          <span className="text-[11px] text-white/30 font-mono">{formatDate(thread.updatedAt)}</span>
        </div>
      </div>
      <button
        onClick={() => onAttach(thread.threadId)}
        className="thread-attach-btn shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-tertiary/20 text-tertiary/70 hover:text-tertiary"
        title="Attach to this thread"
      >
        <Plug className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ThreadList({ onAttach }: ThreadListProps) {
  const { threads, isLoading, error, refresh } = useThreads();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-heading text-sm text-white/60">Recent Threads</h3>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
          title="Refresh threads"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {isLoading && threads.length === 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        </div>
      )}

      {!isLoading && !error && threads.length === 0 && (
        <p className="text-xs text-white/30 text-center py-4">No threads found</p>
      )}

      {threads.length > 0 && (
        <div className="thread-list-scroll max-h-64 overflow-y-auto space-y-0.5">
          {threads.map((t) => (
            <ThreadRow key={t.threadId} thread={t} onAttach={onAttach} />
          ))}
        </div>
      )}
    </div>
  );
}
