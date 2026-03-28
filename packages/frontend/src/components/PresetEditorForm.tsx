import type { Preset, AnalysisMode, AgentModelConfig, AgentRateLimits, RetryConfig } from '../types/preset';
import { AgentConfigPanel } from './AgentConfigPanel';

type PresetEditorFormProps = {
  preset: Preset;
  onUpdate: (updates: Partial<Preset>) => void;
};

const ANALYSIS_MODE_OPTIONS: { value: AnalysisMode; label: string }[] = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'interactive', label: 'Interactive (Human)' },
  { value: 'auto', label: 'Auto (Agent)' },
];

export function PresetEditorForm({ preset, onUpdate }: PresetEditorFormProps) {

  function handleUpdateModelConfig(node: string, config: AgentModelConfig) {
    onUpdate({
      agentModelConfigs: { ...preset.agentModelConfigs, [node]: config },
    });
  }

  function handleUpdateBackend(node: string, backend: string) {
    onUpdate({
      backends: { ...preset.backends, [node]: backend },
    });
  }

  function handleUpdateRetry(node: string, retry: RetryConfig) {
    onUpdate({
      retryAttempts: { ...preset.retryAttempts, [node]: retry },
    });
  }

  function handleUpdateCustomRules(node: string, rules: string) {
    onUpdate({
      customRules: { ...preset.customRules, [node]: rules },
    });
  }

  function handleUpdateRateLimits(node: string, limits: AgentRateLimits) {
    onUpdate({
      agentRateLimits: { ...preset.agentRateLimits, [node]: limits },
    });
  }

  return (
    <div className="space-y-6">
      {/* Section 1: General */}
      <section className="inner-card space-y-4">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">General</h3>

        <div>
          <label className="block text-xs text-white/50 mb-1">Name</label>
          <input
            type="text"
            value={preset.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
      </section>

      {/* Section 2: Rate Limits */}
      <section className="inner-card space-y-4">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Rate Limits</h3>

        <RateLimitField label="Maximum RPM" value={preset.maxRpm} onChange={(v) => onUpdate({ maxRpm: v })} />
        <RateLimitField label="Maximum TPM" value={preset.maxTpm} onChange={(v) => onUpdate({ maxTpm: v })} />
        <RateLimitField label="Maximum RPD" value={preset.maxRpd} onChange={(v) => onUpdate({ maxRpd: v })} />
        <RateLimitField label="Maximum Spending" value={preset.maxSpending} onChange={(v) => onUpdate({ maxSpending: v })} />
      </section>

      {/* Section 3: Build */}
      <section className="inner-card space-y-4">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Build</h3>

        <div>
          <label className="block text-xs text-white/50 mb-1">Build Command</label>
          <input
            type="text"
            value={preset.buildCommand}
            onChange={(e) => onUpdate({ buildCommand: e.target.value })}
            disabled={preset.buildCommandAutoDetect}
            placeholder="npm run build"
            className={preset.buildCommandAutoDetect ? 'opacity-40' : ''}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="buildAutoDetect"
            checked={preset.buildCommandAutoDetect}
            onChange={(e) => onUpdate({ buildCommandAutoDetect: e.target.checked })}
          />
          <label htmlFor="buildAutoDetect" className="text-xs text-white/60 cursor-pointer select-none">
            Determine automatically
          </label>
        </div>
      </section>

      {/* Section 4: Analysis Modes */}
      <section className="inner-card space-y-4">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Analysis Modes</h3>

        <div>
          <label className="block text-xs text-white/50 mb-1">Business Clarifications</label>
          <select
            value={preset.businessClarificationsMode}
            onChange={(e) => onUpdate({ businessClarificationsMode: e.target.value as AnalysisMode })}
            className="preset-select"
          >
            {ANALYSIS_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Technical Clarifications</label>
          <select
            value={preset.technicalClarificationsMode}
            onChange={(e) => onUpdate({ technicalClarificationsMode: e.target.value as AnalysisMode })}
            className="preset-select"
          >
            {ANALYSIS_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Section 5: Agent Toggles */}
      <section className="inner-card space-y-3">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Agent Toggles</h3>

        <div className="grid grid-cols-2 gap-3">
          <ToggleRow label="Microplanner" checked={preset.microplanner} onChange={(v) => onUpdate({ microplanner: v })} />
          <ToggleRow label="Builder" checked={preset.builder} onChange={(v) => onUpdate({ builder: v })} />
          <ToggleRow label="Micro Verifier" checked={preset.microVerifier} onChange={(v) => onUpdate({ microVerifier: v })} />
          <ToggleRow label="Final Verifier" checked={preset.finalVerifier} onChange={(v) => onUpdate({ finalVerifier: v })} />
        </div>
      </section>

      {/* Section 6: Rounds */}
      <section className="inner-card space-y-4">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Rounds</h3>

        <div>
          <label className="block text-xs text-white/50 mb-1">Business Clarification Rounds</label>
          <input
            type="number"
            min="1"
            max="20"
            value={preset.businessClarificationRounds}
            onChange={(e) => onUpdate({ businessClarificationRounds: parseInt(e.target.value) || 1 })}
            disabled={preset.businessClarificationsMode === 'disabled'}
            className={`preset-number ${preset.businessClarificationsMode === 'disabled' ? 'opacity-40' : ''}`}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Technical Clarification Rounds</label>
          <input
            type="number"
            min="1"
            max="20"
            value={preset.technicalClarificationRounds}
            onChange={(e) => onUpdate({ technicalClarificationRounds: parseInt(e.target.value) || 1 })}
            disabled={preset.technicalClarificationsMode === 'disabled'}
            className={`preset-number ${preset.technicalClarificationsMode === 'disabled' ? 'opacity-40' : ''}`}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Max Implementation Attempts</label>
          <input
            type="number"
            min="1"
            max="20"
            value={preset.maxImplementationAttempts}
            onChange={(e) => onUpdate({ maxImplementationAttempts: parseInt(e.target.value) || 1 })}
            disabled={!preset.builder && !preset.microVerifier}
            className={`preset-number ${!preset.builder && !preset.microVerifier ? 'opacity-40' : ''}`}
          />
        </div>
      </section>

      {/* Section 7: Documentation */}
      <section className="inner-card space-y-4">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Documentation</h3>

        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-xs text-white/60">Enable Documentation Agents</span>
          <ToggleSwitch
            checked={preset.documentationEnabled}
            onChange={(v) => onUpdate({ documentationEnabled: v })}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Documentation Index Path</label>
          <input
            type="text"
            value={preset.documentationIndexPath}
            onChange={(e) => onUpdate({ documentationIndexPath: e.target.value })}
            disabled={!preset.documentationEnabled}
            placeholder="docs/INDEX.md"
            className={!preset.documentationEnabled ? 'opacity-40' : ''}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1">Docs Folder Path</label>
          <input
            type="text"
            value={preset.docsFolderPath}
            onChange={(e) => onUpdate({ docsFolderPath: e.target.value })}
            disabled={!preset.documentationEnabled}
            placeholder="docs/"
            className={!preset.documentationEnabled ? 'opacity-40' : ''}
          />
        </div>
      </section>

      {/* Section 8: Agent Configuration (replaces 4 separate dialogs) */}
      <section className="space-y-3">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider px-1">
          Agent Configuration
        </h3>
        <AgentConfigPanel
          agentModelConfigs={preset.agentModelConfigs}
          backends={preset.backends}
          retryAttempts={preset.retryAttempts}
          customRules={preset.customRules}
          agentRateLimits={preset.agentRateLimits}
          globalRateLimits={{ maxRpm: preset.maxRpm, maxTpm: preset.maxTpm, maxRpd: preset.maxRpd, maxSpending: preset.maxSpending }}
          onUpdateModelConfig={handleUpdateModelConfig}
          onUpdateBackend={handleUpdateBackend}
          onUpdateRetry={handleUpdateRetry}
          onUpdateCustomRules={handleUpdateCustomRules}
          onUpdateRateLimits={handleUpdateRateLimits}
        />
      </section>
    </div>
  );
}

// --- Sub-components ---

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-tertiary/60' : 'bg-white/10'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          checked ? 'translate-x-[18px] bg-tertiary' : 'translate-x-[3px] bg-white/40'
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-white/60">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function RateLimitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const isNoLimit = value === null;

  return (
    <div>
      <label className="block text-xs text-white/50 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min="0"
          value={isNoLimit ? '' : value}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
          disabled={isNoLimit}
          placeholder="—"
          className={`preset-number flex-1 ${isNoLimit ? 'opacity-40' : ''}`}
        />
        <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={isNoLimit}
            onChange={(e) => onChange(e.target.checked ? null : 0)}
          />
          <span className="text-[10px] text-white/40">No limit</span>
        </label>
      </div>
    </div>
  );
}
