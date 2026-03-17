import { useState, useCallback } from 'react';
import { ParticlesBackground } from './components/ParticlesBackground';
import { PipelineDashboard } from './components/PipelineDashboard';
import { PipelineTree } from './components/PipelineTree';
import { PresetManagementPage } from './components/PresetManagementPage';
import { usePipeline } from './hooks/usePipeline';
import { usePresets } from './hooks/usePresets';
import { getStaticPresetTree } from './data/pipeline-tree-definition';

type CurrentPage = 'main' | 'presets';

export default function App() {
  const pipeline = usePipeline();
  const presetsHook = usePresets();
  const [currentPage, setCurrentPage] = useState<CurrentPage>('main');
  const [isExternalThread, setIsExternalThread] = useState(false);

  const presetTree = presetsHook.selectedPreset
    ? getStaticPresetTree(presetsHook.selectedPreset)
    : null;

  const handleAttachToThread = useCallback(
    async (threadId: string) => {
      pipeline.attachToThread(threadId);
      const presetId = await presetsHook.getThreadPreset(threadId);
      if (presetId) {
        setIsExternalThread(false);
        presetsHook.selectPreset(presetId);
      } else {
        setIsExternalThread(true);
      }
    },
    [pipeline, presetsHook],
  );

  const handleLaunchPipeline = useCallback(
    async (input: Parameters<typeof pipeline.launchPipeline>[0]) => {
      await pipeline.launchPipeline(input);
      // Save thread-preset association after launch
      // threadId gets set via onThreadId callback asynchronously,
      // so we use a small delay to ensure it's available
      const checkAndSave = () => {
        if (pipeline.threadId && presetsHook.selectedPresetId) {
          presetsHook.saveThreadPreset(pipeline.threadId, presetsHook.selectedPresetId);
        }
      };
      // Check immediately and after a short delay for async threadId assignment
      checkAndSave();
      setTimeout(checkAndSave, 1000);
    },
    [pipeline, presetsHook],
  );

  const handleReset = useCallback(() => {
    pipeline.reset();
    setIsExternalThread(false);
  }, [pipeline]);

  if (currentPage === 'presets') {
    return (
      <div className="h-screen flex relative overflow-hidden">
        <ParticlesBackground />
        <PresetManagementPage
          presetsHook={presetsHook}
          navigateToMain={() => setCurrentPage('main')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative">
      <ParticlesBackground />

      {/* Left sidebar — pipeline graph tree */}
      <aside
        className="pipeline-sidebar relative z-10 border-r border-white/[0.06] py-6 flex-shrink-0"
        style={{ width: 280, overflowX: 'auto' }}
      >
        <PipelineTree
          threadId={pipeline.threadId}
          phase={pipeline.phase}
          presetTree={presetTree}
          preset={presetsHook.selectedPreset}
        />
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
          launchPipeline={handleLaunchPipeline}
          submitAnswers={pipeline.submitAnswers}
          attachToThread={handleAttachToThread}
          reset={handleReset}
          selectedPreset={presetsHook.selectedPreset}
          navigateToPresets={() => setCurrentPage('presets')}
          isExternalThread={isExternalThread}
        />
      </main>
    </div>
  );
}
