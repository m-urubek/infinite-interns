import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { PipelineTreeView } from './PipelineTreeView';
import { PresetEditorForm } from './PresetEditorForm';
import { getStaticPresetTree } from '../data/pipeline-tree-definition';
import type { usePresets } from '../hooks/usePresets';
import { useState } from 'react';

type PresetsHook = ReturnType<typeof usePresets>;

type PresetManagementPageProps = {
  presetsHook: PresetsHook;
  navigateToMain: () => void;
};

export function PresetManagementPage({ presetsHook, navigateToMain }: PresetManagementPageProps) {
  const { presets, selectedPresetId, selectedPreset, selectPreset, createPreset, updatePreset, deletePreset } =
    presetsHook;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const presetTree = selectedPreset ? getStaticPresetTree(selectedPreset) : [];

  async function handleCreate() {
    await createPreset({ name: `Preset ${presets.length + 1}` });
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      await deletePreset(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Auto-clear confirm after 3 seconds
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 3000);
    }
  }

  return (
    <div className="relative z-10 flex flex-1 h-full overflow-hidden">
      {/* Left sidebar — Pipeline Tree */}
      <aside
        className="pipeline-sidebar border-r border-white/[0.06] py-6 flex-shrink-0 overflow-y-auto"
        style={{ width: 280 }}
      >
        <div className="px-4 mb-4">
          <h3 className="font-heading text-xs text-white/40 uppercase tracking-wider">Pipeline View</h3>
        </div>
        {presetTree.length > 0 ? (
          <PipelineTreeView treeData={presetTree} allExpanded />
        ) : (
          <div className="px-4 py-6">
            <span className="font-mono text-[11px] text-white/15">No preset selected</span>
          </div>
        )}
      </aside>

      {/* Center — Editor */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-[#0f0a1a]/90 backdrop-blur-md border-b border-white/[0.06] px-6 py-4 flex items-center gap-4">
          <button
            onClick={navigateToMain}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h2 className="font-heading text-lg gradient-text">Manage Presets</h2>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8">
          {selectedPreset ? (
            <PresetEditorForm
              preset={selectedPreset}
              onUpdate={(updates) => updatePreset(selectedPreset.id, updates)}
            />
          ) : (
            <div className="text-center py-16">
              <p className="text-white/30 text-sm">Select or create a preset to edit</p>
            </div>
          )}
        </div>
      </main>

      {/* Right sidebar — Preset List */}
      <aside
        className="border-l border-white/[0.06] py-6 flex-shrink-0 overflow-y-auto"
        style={{ width: 240 }}
      >
        <div className="px-4 mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xs text-white/40 uppercase tracking-wider">Presets</h3>
          <button
            onClick={handleCreate}
            className="p-1.5 rounded-lg hover:bg-tertiary/15 text-tertiary/60 hover:text-tertiary transition-colors"
            title="Create new preset"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-0.5 px-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => selectPreset(preset.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                preset.id === selectedPresetId
                  ? 'bg-white/[0.07] border-l-2 border-[#22d3d8]'
                  : 'border-l-2 border-transparent hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`flex-1 text-sm font-heading truncate ${
                  preset.id === selectedPresetId ? 'text-white/90' : 'text-white/55'
                }`}
              >
                {preset.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(preset.id);
                }}
                className={`shrink-0 p-1 rounded transition-colors ${
                  confirmDeleteId === preset.id
                    ? 'text-red-400 bg-red-500/20'
                    : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10'
                }`}
                title={confirmDeleteId === preset.id ? 'Click again to confirm' : 'Delete preset'}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
