import { useState, useEffect, useRef } from 'react';
import { Client } from '@langchain/langgraph-sdk';
import type { PipelinePhase } from './usePipeline';

const client = new Client({ apiUrl: 'http://localhost:2024' });

const POLL_INTERVAL_MS = 1500;

// Minimal shape we need from a task (real type has more fields)
type TaskLike = {
  name: string;
  state?: {
    tasks?: TaskLike[];
    next?: string[];
  };
};

// Recursively walks the task tree (subgraphs enabled) to find the deepest
// currently-running or next-to-run node. Builds the full key by joining
// ancestor names with ':' — matching the keys produced by useGraphStructure.
function findDeepestKey(tasks: TaskLike[], next: string[], prefix?: string): string | null {
  if (tasks.length > 0) {
    const task = tasks[tasks.length - 1];
    const key = prefix ? `${prefix}:${task.name}` : task.name;

    const nestedTasks = task.state?.tasks ?? [];
    const nestedNext = task.state?.next ?? [];

    if (nestedTasks.length > 0 || nestedNext.length > 0) {
      const deeper = findDeepestKey(nestedTasks, nestedNext, key);
      if (deeper != null) return deeper;
    }

    return key;
  }

  if (next.length > 0) {
    return prefix ? `${prefix}:${next[0]}` : next[0];
  }

  return null;
}

export function useThreadProgress(threadId: string | null, phase: PipelinePhase) {
  const [activeNodeKey, setActiveNodeKey] = useState<string | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  // Reset when there is no thread
  useEffect(() => {
    if (!threadId) {
      setActiveNodeKey(null);
      lastKeyRef.current = null;
    }
  }, [threadId]);

  // Reset when phase goes idle (new run started)
  useEffect(() => {
    if (phase === 'idle') {
      setActiveNodeKey(null);
      lastKeyRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (!threadId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchState() {
      try {
        // subgraphs: true gives us nested task states so we can find the
        // deepest currently-executing node rather than just the top-level one
        const state = await client.threads.getState(threadId!, undefined, { subgraphs: true });
        if (cancelled) return;

        const tasks = (state.tasks as TaskLike[]) ?? [];
        const next = (state.next as string[]) ?? [];

        const key = findDeepestKey(tasks, next) ?? lastKeyRef.current;

        lastKeyRef.current = key;
        setActiveNodeKey(key);
      } catch {
        // Ignore — keep last known active key
      }
    }

    // Immediate fetch on threadId change (handles attaching to existing thread)
    fetchState();

    // Poll only while pipeline is actively running
    if (phase === 'running') {
      intervalId = setInterval(fetchState, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [threadId, phase]);

  return { activeNodeKey };
}
