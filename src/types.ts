// ---------------------------------------------------------------------------
// Shared types used across pipeline and agent-invoke modules
// Extracted to avoid circular dependencies
// ---------------------------------------------------------------------------

export type AgentModuleKey =
  | "prd-generator"
  | "prd-analyzer"
  | "business-analyzer"
  | "clarification-answerer"
  | "planner"
  | "microplanner"
  | "implementer"
  | "verifier"
  | "final-verifier";

export type Assignment = {
  id: string;
  title: string;
  description: string;
  dependsOn: Array<string>;
  estimatedFiles: Array<string>;
};

export type Clarification = {
  question: string;
  answer: string;
  confident: boolean;
};

export type ParseKey =
  | "prd"
  | "analysis"
  | "clarifications"
  | "plan"
  | "microplan"
  | "implementation"
  | "verify"
  | "finalVerify";

export type ParsedOutput =
  | { needsClarification: boolean; analysisResult: string }
  | Array<Clarification>
  | Array<Assignment>
  | Record<string, unknown>
  | { passed: boolean; feedback: string };

export type RetryInput = {
  agentModule: AgentModuleKey;
  initialMessage: string;
  parseKey: ParseKey;
};
