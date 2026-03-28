import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  AGENT_NODES,
  LLM_AGENT_NODES,
  AGENT_NODE_LABELS,
  BACKEND_OPTIONS,
} from '../types/preset';
import type {
  AgentModelConfig,
  AgentRateLimits,
  RetryConfig,
  Provider,
  AgentNode,
  LlmAgentNode,
} from '../types/preset';
import { getUsableModelIds, GEMINI_PROFILES } from '../data/gemini-profiles';

type AgentConfigPanelProps = {
  agentModelConfigs: Record<string, AgentModelConfig>;
  backends: Record<string, string>;
  retryAttempts: Record<string, RetryConfig>;
  customRules: Record<string, string>;
  agentRateLimits: Record<string, AgentRateLimits>;
  globalRateLimits: { maxRpm: number | null; maxTpm: number | null; maxRpd: number | null; maxSpending: number | null };
  onUpdateModelConfig: (node: string, config: AgentModelConfig) => void;
  onUpdateBackend: (node: string, backend: string) => void;
  onUpdateRetry: (node: string, retry: RetryConfig) => void;
  onUpdateCustomRules: (node: string, rules: string) => void;
  onUpdateRateLimits: (node: string, limits: AgentRateLimits) => void;
};

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const geminiModelIds = getUsableModelIds();

const llmNodeSet = new Set<string>(LLM_AGENT_NODES);

function isLlmNode(node: string): node is LlmAgentNode {
  return llmNodeSet.has(node);
}

const RATE_LIMIT_FIELDS: { key: keyof AgentRateLimits; label: string }[] = [
  { key: 'maxRpm', label: 'RPM' },
  { key: 'maxTpm', label: 'TPM' },
  { key: 'maxRpd', label: 'RPD' },
  { key: 'maxSpending', label: 'Spending' },
];

export function AgentConfigPanel({
  agentModelConfigs,
  backends,
  retryAttempts,
  customRules,
  agentRateLimits,
  globalRateLimits,
  onUpdateModelConfig,
  onUpdateBackend,
  onUpdateRetry,
  onUpdateCustomRules,
  onUpdateRateLimits,
}: AgentConfigPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  function toggleExpand(node: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(node)) {
        next.delete(node);
      } else {
        next.add(node);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {AGENT_NODES.map((node) => {
        const isLlm = isLlmNode(node);
        const expanded = expandedNodes.has(node);
        const modelConfig = isLlm
          ? agentModelConfigs[node] ?? { provider: 'google' as Provider, model: 'gemini-3-flash-preview', temperature: 1, thinkingEnabled: false }
          : null;
        const backend = backends[node] ?? 'ReadOnlyBackend';
        const retry = retryAttempts[node] ?? { maxInSessionAttempts: 3, maxSessionAttempts: 3 };
        const rules = customRules[node] ?? '';
        const rateLimits = agentRateLimits[node] ?? { maxRpm: null, maxTpm: null, maxRpd: null, maxSpending: null };
        const sessionsDisabled = node === 'implementer';

        return (
          <div key={node} className="inner-card">
            {/* Card Header - always visible summary */}
            <button
              type="button"
              onClick={() => toggleExpand(node)}
              className="w-full flex items-center gap-2 text-left"
            >
              <span className="text-white/30">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-xs font-heading text-white/70 flex-1">
                {AGENT_NODE_LABELS[node as AgentNode]}
              </span>
              {/* Summary chips when collapsed */}
              {!expanded && isLlm && modelConfig && (
                <span className="text-[10px] text-white/25 truncate max-w-[200px]">
                  {modelConfig.provider === 'google' ? '' : `${modelConfig.provider} · `}{modelConfig.model}
                </span>
              )}
              {!expanded && !isLlm && (
                <span className="text-[10px] text-white/25">{backend}</span>
              )}
            </button>

            {/* Expanded content */}
            {expanded && (
              <div className="mt-3 space-y-3 pt-3 border-t border-white/[0.06]">
                {/* Provider + Model row (LLM agents only) */}
                {isLlm && modelConfig && (
                  <>
                    <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                      <label className="text-[10px] text-white/30 w-16">Provider</label>
                      <select
                        value={modelConfig.provider}
                        onChange={(e) =>
                          onUpdateModelConfig(node, { ...modelConfig, provider: e.target.value as Provider })
                        }
                        className="preset-select text-xs"
                      >
                        {PROVIDER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                      <label className="text-[10px] text-white/30 w-16">Model</label>
                      {modelConfig.provider === 'google' ? (
                        <select
                          value={modelConfig.model}
                          onChange={(e) =>
                            onUpdateModelConfig(node, { ...modelConfig, model: e.target.value })
                          }
                          className="preset-select text-xs"
                        >
                          {geminiModelIds.map((id) => (
                            <option key={id} value={id}>{id}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={modelConfig.model}
                          onChange={(e) =>
                            onUpdateModelConfig(node, { ...modelConfig, model: e.target.value })
                          }
                          placeholder={`Enter ${modelConfig.provider} model ID`}
                          className="text-xs"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                      <label className="text-[10px] text-white/30 w-16">Temp</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={modelConfig.temperature}
                          onChange={(e) =>
                            onUpdateModelConfig(node, { ...modelConfig, temperature: parseFloat(e.target.value) })
                          }
                          className="preset-range flex-1"
                        />
                        <span className="text-[10px] text-white/30 w-6 text-right">{modelConfig.temperature.toFixed(1)}</span>
                      </div>
                    </div>

                    {(() => {
                      const profile = modelConfig.provider === 'google' ? GEMINI_PROFILES[modelConfig.model] : undefined;
                      const supportsThinking = modelConfig.provider === 'google' && (profile?.reasoningOutput ?? false);
                      return (
                        <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                          <label className="text-[10px] text-white/30 w-16">Thinking</label>
                          <label className={`flex items-center gap-1.5 cursor-pointer select-none ${!supportsThinking ? 'opacity-30 cursor-not-allowed' : ''}`}>
                            <input
                              type="checkbox"
                              checked={modelConfig.thinkingEnabled}
                              disabled={!supportsThinking}
                              onChange={(e) =>
                                onUpdateModelConfig(node, { ...modelConfig, thinkingEnabled: e.target.checked })
                              }
                            />
                            <span className="text-[10px] text-white/40">
                              {supportsThinking ? 'Enabled' : 'Not supported'}
                            </span>
                          </label>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Backend */}
                <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                  <label className="text-[10px] text-white/30 w-16">Backend</label>
                  <select
                    value={backend}
                    onChange={(e) => onUpdateBackend(node, e.target.value)}
                    className="preset-select text-xs"
                  >
                    {BACKEND_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Retry Attempts */}
                <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                  <label className="text-[10px] text-white/30 w-16">Retries</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/25">In-session</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={retry.maxInSessionAttempts}
                        onChange={(e) =>
                          onUpdateRetry(node, { ...retry, maxInSessionAttempts: parseInt(e.target.value) || 1 })
                        }
                        className="preset-number w-14 text-center text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/25">Sessions</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={sessionsDisabled ? 1 : retry.maxSessionAttempts}
                        onChange={(e) =>
                          onUpdateRetry(node, { ...retry, maxSessionAttempts: parseInt(e.target.value) || 1 })
                        }
                        disabled={sessionsDisabled}
                        className={`preset-number w-14 text-center text-xs ${sessionsDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Rate Limits Override (LLM agents only) */}
                {isLlm && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/30">Rate Limits</label>
                    <div className="grid grid-cols-2 gap-2">
                      {RATE_LIMIT_FIELDS.map(({ key, label }) => {
                        const isOverridden = rateLimits[key] !== null;
                        const globalVal = globalRateLimits[key];
                        const placeholder = globalVal !== null ? String(globalVal) : '—';
                        return (
                          <div key={key} className="flex items-center gap-1.5">
                            <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
                              <input
                                type="checkbox"
                                checked={isOverridden}
                                onChange={(e) =>
                                  onUpdateRateLimits(node, { ...rateLimits, [key]: e.target.checked ? (globalVal ?? 0) : null })
                                }
                              />
                              <span className="text-[10px] text-white/30 w-12">{label}</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={isOverridden ? rateLimits[key]! : ''}
                              onChange={(e) =>
                                onUpdateRateLimits(node, { ...rateLimits, [key]: e.target.value ? parseInt(e.target.value) : 0 })
                              }
                              disabled={!isOverridden}
                              placeholder={placeholder}
                              className={`preset-number w-16 text-center text-xs ${!isOverridden ? 'opacity-30' : ''}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Rules (LLM agents only) */}
                {isLlm && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30">Custom Rules</label>
                    <textarea
                      value={rules}
                      onChange={(e) => onUpdateCustomRules(node, e.target.value)}
                      placeholder="Custom rules for this agent..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
