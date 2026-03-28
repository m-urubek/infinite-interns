import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type TechnicalPrdAnalyzerAgentResult = {
  needsClarification: NonNullable<boolean>;
  questions: NonNullable<Array<string>>;
  confidence: NonNullable<number>;
  reasoning: NonNullable<string>;
};

export type TechnicalPrdAnalyzerOutput = TechnicalPrdAnalyzerAgentResult & {
  prd: NonNullable<string>;
  clarifications: ClarifyingQuestions | null | undefined;
};

export type TechnicalPrdAnalyzerState = {
  output: TechnicalPrdAnalyzerOutput | null | undefined;
};
