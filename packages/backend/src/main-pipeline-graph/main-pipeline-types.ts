import type * as MainPipelineAnnotations from "./main-pipeline-annotations";

export type ClarifyingQuestion = {
  question: NonNullable<string>;
  answer: string | null | undefined;
};

export type ClarifyingQuestions = NonNullable<Array<ClarifyingQuestion>>;

export type MainPipelineState = typeof MainPipelineAnnotations.mainPipelineStateAnnotation.State;
