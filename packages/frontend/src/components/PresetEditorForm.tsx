import { useState } from 'react';
import type { Preset } from '../types/preset';
import { BackendsDialog } from './dialogs/BackendsDialog';
import { CustomRulesDialog } from './dialogs/CustomRulesDialog';
import { RetryAttemptsDialog } from './dialogs/RetryAttemptsDialog';
import { ModelConfigDialog } from './dialogs/ModelConfigDialog';
import { Settings2 } from 'lucide-react';

type PresetEditorFormProps = {
  preset: Preset;
  onUpdate: (updates: Partial<Preset>) => void;
};

type DialogType = 'backends' | 'customRules' | 'retryAttempts' | 'modelConfig' | null;

export function PresetEditorForm({ preset, onUpdate }: PresetEditorFormProps) {
  const [openDialog, setOpenDialog] = useState<DialogType>(null);

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

        <div>
          <label className="block text-xs text-white/50 mb-1">Provider</label>
          <select
            value={preset.provider}
            onChange={(e) => onUpdate({ provider: e.target.value as 'google' })}
            className="preset-select"
          >
            <option value="google">Google (Gemini)</option>
          </select>
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

      {/* Section 4: Agent Toggles */}
      <section className="inner-card space-y-3">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Agent Toggles</h3>

        <div className="grid grid-cols-2 gap-3">
          <ToggleRow label="Business Clarifications" checked={preset.businessClarifications} onChange={(v) => onUpdate({ businessClarifications: v })} />
          <ToggleRow label="Technical Clarifications" checked={preset.technicalClarifications} onChange={(v) => onUpdate({ technicalClarifications: v })} />
          <ToggleRow label="Microplanner" checked={preset.microplanner} onChange={(v) => onUpdate({ microplanner: v })} />
          <ToggleRow label="Builder" checked={preset.builder} onChange={(v) => onUpdate({ builder: v })} />
          <ToggleRow label="Micro Verifier" checked={preset.microVerifier} onChange={(v) => onUpdate({ microVerifier: v })} />
          <ToggleRow label="Final Verifier" checked={preset.finalVerifier} onChange={(v) => onUpdate({ finalVerifier: v })} />
        </div>
      </section>

      {/* Section 5: Rounds */}
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
            disabled={!preset.businessClarifications}
            className={`preset-number ${!preset.businessClarifications ? 'opacity-40' : ''}`}
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
            disabled={!preset.technicalClarifications}
            className={`preset-number ${!preset.technicalClarifications ? 'opacity-40' : ''}`}
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

      {/* Section 6: Advanced */}
      <section className="inner-card space-y-3">
        <h3 className="font-heading text-sm text-white/60 uppercase tracking-wider">Advanced</h3>

        <div className="grid grid-cols-2 gap-3">
          <AdvancedButton label="Configure Models" onClick={() => setOpenDialog('modelConfig')} />
          <AdvancedButton label="Configure Backends" onClick={() => setOpenDialog('backends')} />
          <AdvancedButton label="Custom Rules" onClick={() => setOpenDialog('customRules')} />
          <AdvancedButton label="Retry Attempts" onClick={() => setOpenDialog('retryAttempts')} />
          <AdvancedButton label="Custom Tools" disabled />
        </div>
      </section>

      {/* Dialogs */}
      {openDialog === 'modelConfig' && (
        <ModelConfigDialog
          agentModelConfigs={preset.agentModelConfigs}
          onSave={(agentModelConfigs) => { onUpdate({ agentModelConfigs }); setOpenDialog(null); }}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog === 'backends' && (
        <BackendsDialog
          backends={preset.backends}
          onSave={(backends) => { onUpdate({ backends }); setOpenDialog(null); }}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog === 'customRules' && (
        <CustomRulesDialog
          customRules={preset.customRules}
          onSave={(customRules) => { onUpdate({ customRules }); setOpenDialog(null); }}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog === 'retryAttempts' && (
        <RetryAttemptsDialog
          retryAttempts={preset.retryAttempts}
          onSave={(retryAttempts) => { onUpdate({ retryAttempts }); setOpenDialog(null); }}
          onClose={() => setOpenDialog(null)}
        />
      )}
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

function AdvancedButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-heading transition-colors ${
        disabled
          ? 'text-white/20 bg-white/[0.03] cursor-not-allowed'
          : 'text-white/50 bg-white/[0.05] hover:bg-white/[0.08] hover:text-white/70'
      }`}
    >
      <Settings2 size={12} />
      {label}
      {disabled && <span className="text-[10px] text-white/15">(coming soon)</span>}
    </button>
  );
}
