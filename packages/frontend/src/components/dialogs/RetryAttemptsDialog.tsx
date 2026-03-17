import { useState } from 'react';
import { X } from 'lucide-react';
import { AGENT_NODES, AGENT_NODE_LABELS } from '../../types/preset';
import type { RetryConfig } from '../../types/preset';

type RetryAttemptsDialogProps = {
  retryAttempts: Record<string, RetryConfig>;
  onSave: (retryAttempts: Record<string, RetryConfig>) => void;
  onClose: () => void;
};

export function RetryAttemptsDialog({ retryAttempts, onSave, onClose }: RetryAttemptsDialogProps) {
  const [local, setLocal] = useState<Record<string, RetryConfig>>(
    JSON.parse(JSON.stringify(retryAttempts)),
  );

  function handleChange(node: string, field: keyof RetryConfig, value: number) {
    setLocal((prev) => ({
      ...prev,
      [node]: { ...prev[node], [field]: value },
    }));
  }

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="preset-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg text-white/80">Retry Attempts</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-[10px] text-white/30 uppercase tracking-wider">
            <span>Agent</span>
            <span className="w-20 text-center">In-session</span>
            <span className="w-20 text-center">Sessions</span>
          </div>

          {AGENT_NODES.map((node) => {
            const config = local[node] ?? { maxInSessionAttempts: 3, maxSessionAttempts: 3 };
            const sessionsDisabled = node === 'implementer';
            return (
              <div key={node} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <span className="text-xs text-white/60">{AGENT_NODE_LABELS[node]}</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.maxInSessionAttempts}
                  onChange={(e) => handleChange(node, 'maxInSessionAttempts', parseInt(e.target.value) || 1)}
                  className="preset-number w-20 text-center text-xs"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sessionsDisabled ? 1 : config.maxSessionAttempts}
                  onChange={(e) => handleChange(node, 'maxSessionAttempts', parseInt(e.target.value) || 1)}
                  disabled={sessionsDisabled}
                  className={`preset-number w-20 text-center text-xs ${sessionsDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                />
              </div>
            );
          })}
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
