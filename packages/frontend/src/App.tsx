import { ParticlesBackground } from './components/ParticlesBackground';
import { PipelineDashboard } from './components/PipelineDashboard';
import { PipelineTree } from './components/PipelineTree';
import { usePipeline } from './hooks/usePipeline';

export default function App() {
  const pipeline = usePipeline();

  return (
    <div className="min-h-screen flex relative">
      <ParticlesBackground />

      {/* Left sidebar — pipeline graph tree */}
      <aside
        className="pipeline-sidebar relative z-10 border-r border-white/[0.06] py-6 flex-shrink-0"
        style={{ width: 280, overflowX: 'auto' }}
      >
        <PipelineTree threadId={pipeline.threadId} phase={pipeline.phase} />
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 min-w-0 max-w-3xl mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <h1 className="gradient-text font-heading text-5xl font-bold mb-2">
            Infinite Interns
          </h1>
          <p className="text-white/50 font-heading text-lg">
            AI Pipeline Orchestrator
          </p>
        </header>
        <PipelineDashboard
          phase={pipeline.phase}
          values={pipeline.values as Record<string, unknown> | undefined}
          error={pipeline.error as Error | null | undefined}
          currentQuestions={pipeline.currentQuestions}
          threadId={pipeline.threadId}
          launchPipeline={pipeline.launchPipeline}
          submitAnswers={pipeline.submitAnswers}
          attachToThread={pipeline.attachToThread}
          reset={pipeline.reset}
        />
      </main>
    </div>
  );
}
