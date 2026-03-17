import { useMemo } from 'react';
import { useGraphStructure } from '../hooks/useGraphStructure';
import { useThreadProgress } from '../hooks/useThreadProgress';
import { PipelineTreeView } from './PipelineTreeView';
import { filterTreeByPreset } from '../data/pipeline-tree-definition';
import type { TreeNode } from '../types/graph';
import type { PipelinePhase } from '../hooks/usePipeline';
import type { Preset } from '../types/preset';

type PipelineTreeProps = {
  threadId: string | null;
  phase: PipelinePhase;
  presetTree?: TreeNode[] | null;
  preset?: Preset | null;
};

export function PipelineTree({ threadId, phase, presetTree, preset }: PipelineTreeProps) {
  const { treeData: liveTree, loading, error } = useGraphStructure();
  const { activeNodeKey } = useThreadProgress(threadId, phase);

  const useStaticTree = presetTree && phase === 'idle' && !threadId;

  const treeData = useMemo(() => {
    if (useStaticTree) {
      return presetTree;
    }
    if (preset) {
      return filterTreeByPreset(liveTree, preset);
    }
    return liveTree;
  }, [useStaticTree, presetTree, preset, liveTree]);

  if (!useStaticTree && loading) {
    return (
      <div className="px-4 py-6">
        <span className="font-mono text-[11px] text-white/20 animate-pulse">
          connecting...
        </span>
      </div>
    );
  }

  if (!useStaticTree && (error || liveTree.length === 0)) {
    return (
      <div className="px-4 py-6">
        <span className="font-mono text-[11px] text-white/15">—</span>
      </div>
    );
  }

  return (
    <PipelineTreeView
      treeData={treeData}
      activeNodeKey={activeNodeKey}
      allExpanded={phase === 'idle'}
    />
  );
}
