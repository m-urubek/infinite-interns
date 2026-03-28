import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type TechnicalClarificationAnswererOutput = {
  clarifications: NonNullable<ClarifyingQuestions>;
};

export type TechnicalClarificationAnswererState = {
  output: TechnicalClarificationAnswererOutput | null | undefined;
};
