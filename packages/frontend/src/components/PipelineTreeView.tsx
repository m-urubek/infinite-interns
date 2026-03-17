import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import type { TreeNode } from '../types/graph';

type PipelineTreeViewProps = {
  treeData: TreeNode[];
  activeNodeKey?: string | null;
  allExpanded?: boolean;
};

function getAncestorKeys(nodes: TreeNode[], targetKey: string, path: string[] = []): Set<string> {
  for (const node of nodes) {
    if (node.key === targetKey) {
      return new Set(path);
    }
    if (node.children.length > 0) {
      const found = getAncestorKeys(node.children, targetKey, [...path, node.key]);
      if (found.size > 0 || node.children.some((c) => c.key === targetKey)) {
        return new Set([...path, node.key, ...found]);
      }
    }
  }
  return new Set();
}

function getAllKeys(nodes: TreeNode[]): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    keys.add(node.key);
    if (node.children.length > 0) {
      for (const k of getAllKeys(node.children)) {
        keys.add(k);
      }
    }
  }
  return keys;
}

type RowProps = {
  node: TreeNode;
  depth: number;
  activeNodeKey: string | null;
  expandedKeys: Set<string>;
};

function TreeRow({ node, depth, activeNodeKey, expandedKeys }: RowProps) {
  const isActive = node.key === activeNodeKey;
  const isExpanded = expandedKeys.has(node.key);
  const hasChildren = node.children.length > 0;
  const paddingLeft = depth * 16 + 8;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-[5px] pr-4 cursor-default select-none ${
          isActive
            ? 'bg-white/[0.07] border-l-2 border-[#22d3d8]'
            : 'border-l-2 border-transparent'
        }`}
        style={{ paddingLeft }}
      >
        <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center text-white/25">
          {hasChildren &&
            (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
        </span>

        <span
          className={`flex-shrink-0 ${isActive ? 'text-[#22d3d8]' : 'text-white/30'}`}
        >
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen size={12} />
            ) : (
              <Folder size={12} />
            )
          ) : (
            <span className="w-3 h-3 flex items-center justify-center">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? 'bg-[#22d3d8]' : 'bg-white/20'
                }`}
              />
            </span>
          )}
        </span>

        <span
          className={`font-mono text-[11px] leading-tight whitespace-nowrap ${
            isActive ? 'text-[#22d3d8]' : 'text-white/55'
          }`}
        >
          {node.title}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l border-white/[0.08]"
            style={{ left: paddingLeft + 3 + 4 }}
          />
          {node.children.map((child) => (
            <TreeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              activeNodeKey={activeNodeKey}
              expandedKeys={expandedKeys}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PipelineTreeView({
  treeData,
  activeNodeKey = null,
  allExpanded = false,
}: PipelineTreeViewProps) {
  const expandedKeys = allExpanded
    ? getAllKeys(treeData)
    : activeNodeKey != null
      ? new Set([...getAncestorKeys(treeData, activeNodeKey), activeNodeKey])
      : new Set<string>();

  return (
    <div className="min-w-max py-2">
      {treeData.map((node) => (
        <TreeRow
          key={node.key}
          node={node}
          depth={0}
          activeNodeKey={activeNodeKey}
          expandedKeys={expandedKeys}
        />
      ))}
    </div>
  );
}
