import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type PrdGeneratorState = {
  output: NonNullable<PrdGeneratorOutput>;
};

export type PrdGeneratorOutput = {
  prd: NonNullable<string>;
  clarifications: ClarifyingQuestions | null | undefined;
};
