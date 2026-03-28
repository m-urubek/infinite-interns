import { useState } from 'react';
import { X } from 'lucide-react';
import { LLM_AGENT_NODES, AGENT_NODE_LABELS } from '../../types/preset';
import type { AgentModelConfig, Provider } from '../../types/preset';
import { getUsableModelIds, GEMINI_PROFILES } from '../../data/gemini-profiles';

type ModelConfigDialogProps = {
  agentModelConfigs: Record<string, AgentModelConfig>;
  provider: Provider;
  onSave: (configs: Record<string, AgentModelConfig>) => void;
  onClose: () => void;
};

const geminiModelIds = getUsableModelIds();

export function ModelConfigDialog({ agentModelConfigs, provider, onSave, onClose }: ModelConfigDialogProps) {
  const [local, setLocal] = useState<Record<string, AgentModelConfig>>(
    JSON.parse(JSON.stringify(agentModelConfigs)),
  );

  function handleChange(node: string, field: keyof AgentModelConfig, value: string | number | boolean) {
    setLocal((prev) => ({
      ...prev,
      [node]: { ...prev[node], [field]: value },
    }));
  }

  const isGeminiProvider = provider === 'google';

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="preset-modal-card max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg text-white/80">Per-Agent Model Configuration</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={18} />
          </button>
        </div>

        {!isGeminiProvider && (
          <div className="mb-4 p-3 rounded-lg bg-white/[0.05] text-xs text-white/50">
            Provider is set to <strong className="text-white/70">{provider}</strong>. Enter model IDs manually below. Thinking toggle is only available for Google (Gemini) models.
          </div>
        )}

        <div className="space-y-4">
          {LLM_AGENT_NODES.map((node) => {
            const config = local[node] ?? { model: 'gemini-3-flash-preview', temperature: 1, thinkingEnabled: false };
            const profile = isGeminiProvider ? GEMINI_PROFILES[config.model] : undefined;
            const supportsThinking = isGeminiProvider && (profile?.reasoningOutput ?? false);

            return (
              <div key={node} className="inner-card space-y-3">
                <h4 className="text-xs text-white/60 font-heading">{AGENT_NODE_LABELS[node]}</h4>

                <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  {isGeminiProvider ? (
                    <select
                      value={config.model}
                      onChange={(e) => handleChange(node, 'model', e.target.value)}
                      className="preset-select text-xs"
                    >
                      {geminiModelIds.map((id) => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={config.model}
                      onChange={(e) => handleChange(node, 'model', e.target.value)}
                      placeholder={`Enter ${provider} model ID`}
                      className="text-xs"
                    />
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 w-8 text-right">{config.temperature.toFixed(1)}</span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => handleChange(node, 'temperature', parseFloat(e.target.value))}
                      className="preset-range w-24"
                    />
                  </div>

                  <label className={`flex items-center gap-1.5 cursor-pointer select-none ${!supportsThinking ? 'opacity-30 cursor-not-allowed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={config.thinkingEnabled}
                      disabled={!supportsThinking}
                      onChange={(e) => handleChange(node, 'thinkingEnabled', e.target.checked)}
                    />
                    <span className="text-[10px] text-white/40">Think</span>
                  </label>
                </div>
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
