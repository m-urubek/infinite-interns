import { useState } from 'react';
import { X } from 'lucide-react';
import { AGENT_NODES, AGENT_NODE_LABELS, BACKEND_OPTIONS } from '../../types/preset';

type BackendsDialogProps = {
  backends: Record<string, string>;
  onSave: (backends: Record<string, string>) => void;
  onClose: () => void;
};

export function BackendsDialog({ backends, onSave, onClose }: BackendsDialogProps) {
  const [local, setLocal] = useState<Record<string, string>>({ ...backends });

  function handleChange(node: string, value: string) {
    setLocal((prev) => ({ ...prev, [node]: value }));
  }

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="preset-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg text-white/80">Configure Backends</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {AGENT_NODES.map((node) => (
            <div key={node} className="flex items-center justify-between gap-4">
              <span className="text-xs text-white/60 shrink-0">{AGENT_NODE_LABELS[node]}</span>
              <select
                value={local[node] ?? 'ReadOnlyBackend'}
                onChange={(e) => handleChange(node, e.target.value)}
                className="preset-select text-xs"
              >
                {BACKEND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={() => onSave(local)}
            className="glow-button px-5 py-2 text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
