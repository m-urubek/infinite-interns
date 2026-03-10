import { useState, useEffect } from 'react';
import { Client } from '@langchain/langgraph-sdk';
import type { TreeNode } from '../types/graph';

const client = new Client({ apiUrl: 'http://localhost:2024' });

type RawNode = { id: string | number; name?: string };
type RawEdge = { source: string; target: string };

function parseToTree(nodes: RawNode[], _edges: RawEdge[]): TreeNode[] {
  // Filter out internal LangGraph bookkeeping nodes
  const filtered = nodes.filter((n) => {
    const id = String(n.id);
    return (
      !id.includes('__start__') &&
      !id.includes('__end__') &&
      !id.includes('__interrupt__')
    );
  });

  const nodeMap = new Map<string, TreeNode>();
  // Tracks insertion order so root ordering matches API topological order
  const insertionOrder: string[] = [];

  // Creates a node (or returns existing). Virtual parents are created with
  // the last segment of their key as the display title.
  function ensureNode(id: string, name?: string): TreeNode {
    if (nodeMap.has(id)) return nodeMap.get(id)!;
    const parts = id.split(':');
    const title = name ?? parts[parts.length - 1];
    const node: TreeNode = { key: id, title, children: [] };
    nodeMap.set(id, node);
    insertionOrder.push(id);
    return node;
  }

  // Process each real node. For nodes with ':' in their ID, ensure every
  // ancestor level exists as a virtual node and is attached to its own parent.
  for (const n of filtered) {
    const id = String(n.id);
    const parts = id.split(':');

    // Bottom-up ancestor creation (depth 1 = top-level root, depth n-1 = direct parent)
    for (let depth = 1; depth < parts.length; depth++) {
      const ancestorId = parts.slice(0, depth).join(':');
      const isNew = !nodeMap.has(ancestorId);
      const ancestor = ensureNode(ancestorId); // creates if missing

      // If we just created this ancestor and it has its own parent, attach it
      if (isNew && depth > 1) {
        const grandParentId = parts.slice(0, depth - 1).join(':');
        const grandParent = nodeMap.get(grandParentId);
        if (grandParent && !grandParent.children.find((c) => c.key === ancestorId)) {
          grandParent.children.push(ancestor);
        }
      }
    }

    // Create the real node itself
    const node = ensureNode(id, n.name);

    // Attach to its direct parent
    if (parts.length > 1) {
      const parentId = parts.slice(0, -1).join(':');
      const parent = nodeMap.get(parentId)!;
      if (parent && !parent.children.find((c) => c.key === id)) {
        parent.children.push(node);
      }
    }
  }

  // Root nodes = those without ':' in their key, in insertion order
  // (virtual parents are inserted before their first child, so order is preserved)
  return insertionOrder
    .filter((k) => !k.includes(':'))
    .map((k) => nodeMap.get(k)!);
}

export function useGraphStructure() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchGraph() {
      try {
        const graph = await client.assistants.getGraph('pipeline', { xray: true });
        if (cancelled) return;
        const tree = parseToTree(
          graph.nodes as RawNode[],
          graph.edges as RawEdge[]
        );
        setTreeData(tree);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGraph();
    return () => {
      cancelled = true;
    };
  }, []);

  return { treeData, loading, error };
}
