export type LlmAgentNode = "prdGenerator" | "prdAnalyzer" | "planner" | "implementer" | "verifier" | "finalVerifier";

export type ModelConfig = {
  model: NonNullable<string>;
  temperature: NonNullable<number>;
  thinkingEnabled: NonNullable<boolean>;
};

export type RetryConfig = {
  maxInSessionAttempts: NonNullable<number>;
  maxSessionAttempts: NonNullable<number>;
};

export type AgentConfig = {
  modelConfig: NonNullable<ModelConfig>;
  retryConfig: NonNullable<RetryConfig>;
};

export type AgentConfigs = Record<LlmAgentNode, AgentConfig>;
