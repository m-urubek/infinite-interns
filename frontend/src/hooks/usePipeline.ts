import { useState, useCallback, useMemo, useRef } from 'react';
import { useStream } from '@langchain/langgraph-sdk/react';

export interface PipelineInput {
  assignment: string;
  projectDir: string;
  buildCommand: string | null;
  finalVerifierEnabled: boolean;
}

interface FinalVerifierOutput {
  success: boolean;
  problems: string[];
  suggestedFollowUpPrompt: string | null;
}

type PipelineValues = {
  assignment?: string;
  projectDir?: string;
  finalVerifierState?: {
    output: FinalVerifierOutput | null;
  };
  [key: string]: unknown;
};

export type PipelinePhase = 'idle' | 'running' | 'interrupted' | 'complete' | 'error';

export function usePipeline() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const hasSubmitted = useRef(false);

  const stream = useStream<PipelineValues, { InterruptType: string[] }>({
    assistantId: 'pipeline',
    apiUrl: 'http://localhost:2024',
    threadId: threadId,
    onThreadId: (id: string) => setThreadId(id),
  });

  // Derive phase from stream state — no manual tracking that can go stale
  const phase: PipelinePhase = useMemo(() => {
    if (!hasSubmitted.current) {
      return 'idle';
    }
    if (stream.error) {
      return 'error';
    }
    if (stream.interrupt?.value && Array.isArray(stream.interrupt.value)) {
      return 'interrupted';
    }
    if (stream.isLoading || stream.isThreadLoading) {
      return 'running';
    }
    // Not loading, no interrupt, no error — finished
    return 'complete';
  }, [stream.error, stream.interrupt, stream.isLoading, stream.isThreadLoading]);

  // Keep currentQuestions in sync with interrupt value
  const questions = useMemo(() => {
    if (phase === 'interrupted' && stream.interrupt?.value && Array.isArray(stream.interrupt.value)) {
      return stream.interrupt.value;
    }
    return currentQuestions;
  }, [phase, stream.interrupt, currentQuestions]);

  const launchPipeline = useCallback(async (input: PipelineInput) => {
    hasSubmitted.current = true;
    await stream.submit({
      assignment: input.assignment,
      projectDir: input.projectDir,
      buildCommand: input.buildCommand,
      finalVerifierEnabled: input.finalVerifierEnabled,
    });
  }, [stream]);

  const submitAnswers = useCallback(async (answers: string[]) => {
    setCurrentQuestions([]);
    await stream.submit(null, {
      command: { resume: answers },
    });
  }, [stream]);

  const attachToThread = useCallback((existingThreadId: string) => {
    hasSubmitted.current = true;
    setThreadId(existingThreadId);
  }, []);

  const reset = useCallback(() => {
    hasSubmitted.current = false;
    setThreadId(null);
    setCurrentQuestions([]);
  }, []);

  return {
    phase,
    values: stream.values,
    isLoading: stream.isLoading,
    error: stream.error,
    currentQuestions: questions,
    threadId,
    launchPipeline,
    submitAnswers,
    attachToThread,
    reset,
  };
}
