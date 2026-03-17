import { useState } from 'react';
import { X } from 'lucide-react';
import { AGENT_NODES, AGENT_NODE_LABELS } from '../../types/preset';

type CustomRulesDialogProps = {
  customRules: Record<string, string>;
  onSave: (customRules: Record<string, string>) => void;
  onClose: () => void;
};

export function CustomRulesDialog({ customRules, onSave, onClose }: CustomRulesDialogProps) {
  const [local, setLocal] = useState<Record<string, string>>({ ...customRules });

  function handleChange(node: string, value: string) {
    setLocal((prev) => ({ ...prev, [node]: value }));
  }

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="preset-modal-card max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg text-white/80">Custom Rules</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {AGENT_NODES.map((node) => (
            <div key={node}>
              <label className="block text-xs text-white/50 mb-1">{AGENT_NODE_LABELS[node]}</label>
              <textarea
                value={local[node] ?? ''}
                onChange={(e) => handleChange(node, e.target.value)}
                placeholder="Custom rules for this agent..."
                rows={3}
                className="text-xs"
              />
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
