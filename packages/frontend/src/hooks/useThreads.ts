import { useState, useCallback, useEffect, useRef } from "react";
import { Client } from "@langchain/langgraph-sdk";
import type { Thread, ThreadStatus } from "@langchain/langgraph-sdk";

export type ThreadSummary = {
  threadId: string;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  assignment: string | null;
};

export function useThreads() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);

  if (!clientRef.current) {
    clientRef.current = new Client({ apiUrl: "http://localhost:2024" });
  }

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results: Thread[] = await clientRef.current!.threads.search({
        limit: 30,
        sortBy: "updated_at",
        sortOrder: "desc",
      });

      const summaries: ThreadSummary[] = results.map((t) => ({
        threadId: t.thread_id,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        assignment: extractAssignment(t.values),
      }));

      setThreads(summaries);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch threads";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  return {
    threads,
    isLoading,
    error,
    refresh: fetchThreads,
  };
}

function extractAssignment(values: unknown): string | null {
  if (values && typeof values === "object" && "assignment" in values) {
    const assignment = (values as Record<string, unknown>).assignment;
    if (typeof assignment === "string" && assignment.length > 0) {
      return assignment;
    }
  }
  return null;
}
