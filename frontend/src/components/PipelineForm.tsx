import { useState } from 'react';
import type { PipelineInput } from '../hooks/usePipeline';

interface PipelineFormProps {
  onSubmit: (input: PipelineInput) => void;
}

export function PipelineForm({ onSubmit }: PipelineFormProps) {
  const [assignment, setAssignment] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [buildCommand, setBuildCommand] = useState('');
  const [finalVerifierEnabled, setFinalVerifierEnabled] = useState(true);

  const isValid = assignment.trim().length > 0 && projectDir.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({
      assignment: assignment.trim(),
      projectDir: projectDir.trim(),
      buildCommand: buildCommand.trim() || null,
      finalVerifierEnabled,
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
          placeholder="npm run build"
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
