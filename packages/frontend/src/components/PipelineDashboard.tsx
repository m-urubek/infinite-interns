import { usePipeline } from '../hooks/usePipeline';
import { GlowContainer } from './GlowContainer';
import { PipelineForm } from './PipelineForm';
import { ClarificationPanel } from './ClarificationPanel';
import { ThreadList } from './ThreadList';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export function PipelineDashboard() {
  const {
    phase,
    values,
    error,
    currentQuestions,
    threadId,
    launchPipeline,
    submitAnswers,
    attachToThread,
    reset,
  } = usePipeline();

  if (phase === 'idle') {
    return (
      <div className="space-y-6">
        <GlowContainer className="p-8">
          <PipelineForm onSubmit={launchPipeline} />
        </GlowContainer>
        <GlowContainer className="p-6">
          <ThreadList onAttach={attachToThread} />
        </GlowContainer>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <GlowContainer animate className="p-8">
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-12 h-12 text-tertiary animate-spin-slow" />
          <h2 className="font-heading text-xl text-white/90">Pipeline Running...</h2>
          <p className="text-white/40 text-sm text-center max-w-md">
            Monitor detailed progress in LangGraph Studio.
          </p>
          {threadId && (
            <p className="text-white/25 text-xs font-mono">
              Thread: {threadId}
            </p>
          )}
        </div>
      </GlowContainer>
    );
  }

  if (phase === 'interrupted') {
    return (
      <GlowContainer className="p-8">
        <ClarificationPanel
          questions={currentQuestions}
          onSubmit={submitAnswers}
        />
      </GlowContainer>
    );
  }

  if (phase === 'complete') {
    const finalOutput = (values as Record<string, unknown>)?.finalVerifierState as
      | { output: { success: boolean; problems: string[]; suggestedFollowUpPrompt: string | null } | null }
      | undefined;
    const result = finalOutput?.output;

    return (
      <GlowContainer className="p-8">
        <div className="flex flex-col items-center gap-6 py-6">
          {result?.success !== false ? (
            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-14 h-14 text-amber-400" />
          )}

          <h2 className="font-heading text-2xl gradient-text">
            Pipeline Complete
          </h2>

          {result && !result.success && result.problems.length > 0 && (
            <div className="inner-card w-full space-y-2">
              <h3 className="font-heading text-sm text-white/70 mb-2">Issues Found</h3>
              <ul className="space-y-1">
                {result.problems.map((problem, i) => (
                  <li key={i} className="text-white/80 text-sm flex gap-2">
                    <span className="text-primary shrink-0">-</span>
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result?.suggestedFollowUpPrompt && (
            <div className="inner-card w-full">
              <h3 className="font-heading text-sm text-white/70 mb-2">Suggested Follow-up</h3>
              <p className="text-white/80 text-sm">{result.suggestedFollowUpPrompt}</p>
            </div>
          )}

          {!result && (
            <p className="text-white/50 text-sm">
              Pipeline finished. No final verifier output available.
            </p>
          )}

          <button onClick={reset} className="glow-button px-8 py-3 mt-4">
            New Run
          </button>
        </div>
      </GlowContainer>
    );
  }

  // Error phase
  return (
    <GlowContainer className="p-8">
      <div className="flex flex-col items-center gap-4 py-8">
        <XCircle className="w-14 h-14 text-red-400" />
        <h2 className="font-heading text-xl text-white/90">Pipeline Error</h2>
        <div className="inner-card w-full">
          <p className="text-white/70 text-sm font-mono break-all">
            {error instanceof Error ? error.message : String(error ?? 'Unknown error')}
          </p>
        </div>
        <button onClick={reset} className="glow-button px-8 py-3 mt-4">
          Try Again
        </button>
      </div>
    </GlowContainer>
  );
}
