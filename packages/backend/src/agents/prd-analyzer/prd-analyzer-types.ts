import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type PrdAnalyzerAgentResult = {
  needsClarification: NonNullable<boolean>;
  questions: NonNullable<Array<string>>;
  confidence: NonNullable<number>;
  reasoning: NonNullable<string>;
};

export type PrdAnalyzerOutput = PrdAnalyzerAgentResult & {
  prd: NonNullable<string>;
  clarifications: ClarifyingQuestions | null | undefined;
};

export type PrdAnalyzerState = {
  output: PrdAnalyzerOutput | null | undefined;
};
