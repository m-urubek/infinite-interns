import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type PrdGeneratorState = {
  input: NonNullable<PrdGeneratorInput>;
  output: NonNullable<PrdGeneratorOutput>;
};

export type PrdGeneratorInput = {
  assignment: NonNullable<string>;
  clarifications: ClarifyingQuestions | null | undefined;
};

export type PrdGeneratorOutput = {
  prd: NonNullable<string>;
  clarifications: ClarifyingQuestions | null | undefined;
};
