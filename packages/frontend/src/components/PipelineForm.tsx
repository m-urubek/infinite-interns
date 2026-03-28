import { useState, useEffect } from 'react';
import type { PipelineInput, AgentConfigs, RateLimitsConfig, DocumentationConfig } from '../hooks/usePipeline';
import type { Preset } from '../types/preset';
import { LLM_AGENT_NODES } from '../types/preset';

interface PipelineFormProps {
  onSubmit: (input: PipelineInput) => void;
  preset?: Preset | null;
}

function buildAgentConfigs(preset: Preset): AgentConfigs {
  const configs: AgentConfigs = {};
  for (const node of LLM_AGENT_NODES) {
    const modelConfig = preset.agentModelConfigs[node] ?? {
      model: 'gemini-3-flash-preview',
      temperature: 1,
      thinkingEnabled: false,
    };
    const retryConfig = preset.retryAttempts[node] ?? {
      maxInSessionAttempts: 3,
      maxSessionAttempts: 3,
    };
    const customRules = preset.customRules[node] || null;
    configs[node] = { modelConfig, retryConfig, customRules };
  }
  return configs;
}

function buildRateLimitsConfig(preset: Preset): RateLimitsConfig | null {
  const hasAnyLimit =
    preset.maxRpm !== null ||
    preset.maxTpm !== null ||
    preset.maxRpd !== null ||
    preset.maxSpending !== null;
  if (!hasAnyLimit) return null;
  return {
    maxRpm: preset.maxRpm,
    maxTpm: preset.maxTpm,
    maxRpd: preset.maxRpd,
    maxSpending: preset.maxSpending,
  };
}

function buildDocumentationConfig(preset: Preset): DocumentationConfig | null {
  if (!preset.documentationEnabled) return null;
  return {
    enabled: true,
    indexPath: preset.documentationIndexPath,
    docsFolderPath: preset.docsFolderPath,
  };
}

export function PipelineForm({ onSubmit, preset }: PipelineFormProps) {
  const [assignment, setAssignment] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [buildCommand, setBuildCommand] = useState('');
  const [finalVerifierEnabled, setFinalVerifierEnabled] = useState(true);

  // Initialize form from preset when it changes
  useEffect(() => {
    if (preset) {
      setBuildCommand(preset.buildCommandAutoDetect ? '' : preset.buildCommand);
      setFinalVerifierEnabled(preset.finalVerifier);
    }
  }, [preset]);

  const isValid = assignment.trim().length > 0 && projectDir.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({
      assignment: assignment.trim(),
      projectDir: projectDir.trim(),
      buildCommand: buildCommand.trim() || null,
      finalVerifierEnabled,
      businessClarificationsMode: preset?.businessClarificationsMode ?? 'interactive',
      technicalClarificationsMode: preset?.technicalClarificationsMode ?? 'disabled',
      businessClarificationRounds: preset?.businessClarificationRounds ?? 5,
      technicalClarificationRounds: preset?.technicalClarificationRounds ?? 5,
      maxImplementationAttempts: preset?.maxImplementationAttempts ?? 7,
      microplannerEnabled: preset?.microplanner ?? true,
      builderEnabled: preset?.builder ?? true,
      microVerifierEnabled: preset?.microVerifier ?? true,
      documentationConfig: preset ? buildDocumentationConfig(preset) : null,
      rateLimitsConfig: preset ? buildRateLimitsConfig(preset) : null,
      agentConfigs: preset ? buildAgentConfigs(preset) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="inner-card">
        <label className="block font-heading text-sm text-white/80 mb-2">
          Assignment
        </label>
        <textarea
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          placeholder="Describe the task for the pipeline..."
          rows={4}
        />
      </div>

      <div className="inner-card">
        <label className="block font-heading text-sm text-white/80 mb-2">
          Project Directory
        </label>
        <input
          type="text"
          value={projectDir}
          onChange={(e) => setProjectDir(e.target.value)}
          placeholder="/path/to/project"
        />
      </div>

      <div className="inner-card">
        <label className="block font-heading text-sm text-white/80 mb-2">
          Build Command <span className="text-white/40">(optional)</span>
        </label>
        <input
          type="text"
          value={buildCommand}
          onChange={(e) => setBuildCommand(e.target.value)}
          placeholder={preset?.buildCommandAutoDetect ? 'Auto-detect enabled in preset' : 'npm run build'}
        />
      </div>

      <div className="inner-card flex items-center gap-3">
        <input
          type="checkbox"
          id="finalVerifier"
          checked={finalVerifierEnabled}
          onChange={(e) => setFinalVerifierEnabled(e.target.checked)}
        />
        <label
          htmlFor="finalVerifier"
          className="font-heading text-sm text-white/80 cursor-pointer select-none"
        >
          Enable Final Verification
        </label>
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="glow-button text-lg px-8 py-3"
        >
          Launch Pipeline
        </button>
      </div>
    </form>
  );
}
