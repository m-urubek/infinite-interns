import { v4 as uuidv4 } from 'uuid';

export type RetryConfig = {
  maxInSessionAttempts: number;
  maxSessionAttempts: number;
};

export type AgentModelConfig = {
  model: string;
  temperature: number;
  thinkingEnabled: boolean;
};

export type Preset = {
  id: string;
  name: string;
  provider: 'google';
  maxRpm: number | null;
  maxTpm: number | null;
  maxRpd: number | null;
  maxSpending: number | null;
  buildCommand: string;
  buildCommandAutoDetect: boolean;
  businessClarifications: boolean;
  technicalClarifications: boolean;
  microplanner: boolean;
  builder: boolean;
  microVerifier: boolean;
  finalVerifier: boolean;
  businessClarificationRounds: number;
  technicalClarificationRounds: number;
  maxImplementationAttempts: number;
  backends: Record<string, string>;
  customRules: Record<string, string>;
  retryAttempts: Record<string, RetryConfig>;
  agentModelConfigs: Record<string, AgentModelConfig>;
};

export const AGENT_NODES = [
  'prdGenerator',
  'prdAnalyzer',
  'answerClarifications',
  'planner',
  'controller',
  'implementer',
  'builder',
  'verifier',
  'finalVerifier',
] as const;

export type AgentNode = (typeof AGENT_NODES)[number];

/** Subset of agent nodes that use an LLM (have model config). */
export const LLM_AGENT_NODES = [
  'prdGenerator',
  'prdAnalyzer',
  'planner',
  'implementer',
  'verifier',
  'finalVerifier',
] as const;

export type LlmAgentNode = (typeof LLM_AGENT_NODES)[number];

export const AGENT_NODE_LABELS: Record<AgentNode, string> = {
  prdGenerator: 'PRD Generator',
  prdAnalyzer: 'PRD Analyzer',
  answerClarifications: 'Clarifications',
  planner: 'Planner',
  controller: 'Controller',
  implementer: 'Implementer',
  builder: 'Builder',
  verifier: 'Micro Verifier',
  finalVerifier: 'Final Verifier',
};

export const BACKEND_OPTIONS = [
  'ReadOnlyBackend',
  'ReadOnlyShellBackend',
  'LocalShellBackend',
] as const;

const DEFAULT_BACKENDS: Record<AgentNode, string> = {
  prdGenerator: 'ReadOnlyBackend',
  prdAnalyzer: 'ReadOnlyBackend',
  answerClarifications: 'ReadOnlyBackend',
  planner: 'ReadOnlyShellBackend',
  controller: 'ReadOnlyBackend',
  implementer: 'LocalShellBackend',
  builder: 'ReadOnlyBackend',
  verifier: 'ReadOnlyShellBackend',
  finalVerifier: 'ReadOnlyShellBackend',
};

const DEFAULT_RETRY: RetryConfig = {
  maxInSessionAttempts: 3,
  maxSessionAttempts: 3,
};

const DEFAULT_MODEL_CONFIG: AgentModelConfig = {
  model: 'gemini-3-flash-preview',
  temperature: 1,
  thinkingEnabled: false,
};

export function createDefaultPreset(name = 'Default'): Preset {
  const backends: Record<string, string> = {};
  const customRules: Record<string, string> = {};
  const retryAttempts: Record<string, RetryConfig> = {};
  const agentModelConfigs: Record<string, AgentModelConfig> = {};

  for (const node of AGENT_NODES) {
    backends[node] = DEFAULT_BACKENDS[node];
    customRules[node] = '';
    retryAttempts[node] = { ...DEFAULT_RETRY };
  }

  for (const node of LLM_AGENT_NODES) {
    agentModelConfigs[node] = { ...DEFAULT_MODEL_CONFIG };
  }

  return {
    id: uuidv4(),
    name,
    provider: 'google',
    maxRpm: null,
    maxTpm: null,
    maxRpd: null,
    maxSpending: null,
    buildCommand: '',
    buildCommandAutoDetect: true,
    businessClarifications: true,
    technicalClarifications: true,
    microplanner: true,
    builder: true,
    microVerifier: true,
    finalVerifier: true,
    businessClarificationRounds: 5,
    technicalClarificationRounds: 5,
    maxImplementationAttempts: 7,
    backends,
    customRules,
    retryAttempts,
    agentModelConfigs,
  };
}
