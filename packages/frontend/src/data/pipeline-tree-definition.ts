import type { TreeNode } from '../types/graph';
import type { Preset } from '../types/preset';

type TreeDefinitionEntry = {
  key: string;
  title: string;
  toggleKey?: keyof Preset;
  clarificationLinked?: boolean;
};

const PIPELINE_TREE_DEFINITION: TreeDefinitionEntry[] = [
  { key: 'prdGeneratorGraph', title: 'PRD Generator' },
  { key: 'prdAnalyzerGraph', title: 'PRD Analyzer', clarificationLinked: true },
  { key: 'answerClarificationsNode', title: 'Clarifications', clarificationLinked: true },
  { key: 'plannerGraph', title: 'Planner', toggleKey: 'microplanner' },
  { key: 'controllerNode', title: 'Controller' },
  { key: 'implementerGraph', title: 'Implementer' },
  { key: 'builderNode', title: 'Builder', toggleKey: 'builder' },
  { key: 'verifierGraph', title: 'Micro Verifier', toggleKey: 'microVerifier' },
  { key: 'finalVerifierGraph', title: 'Final Verifier', toggleKey: 'finalVerifier' },
];

const TOGGLE_KEY_BY_NODE: Record<string, keyof Preset> = {
  plannerGraph: 'microplanner',
  builderNode: 'builder',
  verifierGraph: 'microVerifier',
  finalVerifierGraph: 'finalVerifier',
};

const CLARIFICATION_LINKED_KEYS = new Set([
  'prdAnalyzerGraph',
  'answerClarificationsNode',
]);

function isNodeDisabled(nodeKey: string, preset: Preset): boolean {
  // Extract the top-level key from nested LangGraph keys like "verifierGraph:setup"
  const topLevelKey = nodeKey.split(':')[0];

  // Clarification-linked nodes: hidden only if BOTH clarification types are off
  if (CLARIFICATION_LINKED_KEYS.has(topLevelKey)) {
    return !preset.businessClarifications && !preset.technicalClarifications;
  }

  // Check direct toggle mapping
  const toggleKey = TOGGLE_KEY_BY_NODE[topLevelKey];
  if (toggleKey) {
    return !preset[toggleKey];
  }

  return false;
}

export function filterTreeByPreset(tree: TreeNode[], preset: Preset): TreeNode[] {
  return tree
    .filter((node) => !isNodeDisabled(node.key, preset))
    .map((node) => {
      if (node.children.length === 0) {
        return node;
      }
      const filteredChildren = filterTreeByPreset(node.children, preset);
      return { ...node, children: filteredChildren };
    });
}

export function getStaticPresetTree(preset: Preset): TreeNode[] {
  return PIPELINE_TREE_DEFINITION
    .filter((entry) => {
      if (entry.clarificationLinked) {
        return preset.businessClarifications || preset.technicalClarifications;
      }
      if (entry.toggleKey) {
        return !!preset[entry.toggleKey];
      }
      return true;
    })
    .map((entry) => ({
      key: entry.key,
      title: entry.title,
      children: [],
    }));
}
