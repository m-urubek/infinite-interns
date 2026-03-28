import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type AnalysisPhase = "prdGeneration" | "businessAnalysis" | "technicalAnalysis" | "done";

export type AnalysisControllerRoute =
  | "prdGeneratorGraph"
  | "prdAnalyzerGraph"
  | "technicalPrdAnalyzerGraph"
  | "answerClarificationsNode"
  | "businessClarificationAnswererGraph"
  | "technicalClarificationAnswererGraph"
  | "initialDocumenterGraph"
  | "plannerGraph";

export type AnalysisControllerOutput = {
  prd: NonNullable<string>;
  clarifications: ClarifyingQuestions | null | undefined;
  assignment: NonNullable<string>;
  questions: NonNullable<Array<string>>;
  nextTarget: NonNullable<AnalysisControllerRoute>;
};

export type AnalysisControllerInternal = {
  currentPhase: NonNullable<AnalysisPhase>;
  businessRound: NonNullable<number>;
  technicalRound: NonNullable<number>;
  prdGenerated: NonNullable<boolean>;
};

export type AnalysisControllerState = {
  output: AnalysisControllerOutput | null | undefined;
  internal: NonNullable<AnalysisControllerInternal>;
};
