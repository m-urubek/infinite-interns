import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type BusinessClarificationAnswererOutput = {
  clarifications: NonNullable<ClarifyingQuestions>;
};

export type BusinessClarificationAnswererState = {
  output: BusinessClarificationAnswererOutput | null | undefined;
};
