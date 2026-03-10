import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";

export type AnswerClarificationsOutput = {
  clarifications: NonNullable<ClarifyingQuestions>;
};

export type AnswerClarificationsInternal = {
  clarificationRound: NonNullable<number>;
};

export type AnswerClarificationsState = {
  output: AnswerClarificationsOutput | null | undefined;
  internal: NonNullable<AnswerClarificationsInternal>;
};
