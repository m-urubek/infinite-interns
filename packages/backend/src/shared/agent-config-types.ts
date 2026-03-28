export type LlmAgentNode =
  | "prdGenerator"
  | "prdAnalyzer"
  | "planner"
  | "implementer"
  | "verifier"
  | "finalVerifier"
  | "technicalPrdAnalyzer"
  | "businessClarificationAnswerer"
  | "technicalClarificationAnswerer"
  | "microplanner"
  | "testsGenerator"
  | "initialDocumenter"
  | "microDocumenter"
  | "finalDocumenter"
  | "documentationIndexer";

export type ModelProvider = "google" | "openai" | "deepseek";

export type ModelConfig = {
  model: NonNullable<string>;
  temperature: NonNullable<number>;
  thinkingEnabled: NonNullable<boolean>;
  provider: ModelProvider | null | undefined;
};

export type RetryConfig = {
  maxInSessionAttempts: NonNullable<number>;
  maxSessionAttempts: NonNullable<number>;
};

export type AgentConfig = {
  modelConfig: NonNullable<ModelConfig>;
  retryConfig: NonNullable<RetryConfig>;
  customRules: string | null | undefined;
};

export type AgentConfigs = Record<LlmAgentNode, AgentConfig>;

export type AnalysisMode = "disabled" | "interactive" | "auto";

export type DocumentationConfig = {
  enabled: NonNullable<boolean>;
  indexPath: NonNullable<string>;
  docsFolderPath: NonNullable<string>;
};

export type RateLimitsConfig = {
  maxRpm: number | null | undefined;
  maxTpm: number | null | undefined;
  maxRpd: number | null | undefined;
  maxSpending: number | null | undefined;
};
