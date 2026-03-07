import { interrupt } from "@langchain/langgraph";
import { analysisSchema as prdAnalysisSchema } from "./agents/prd-analyzer.js";
import type { PipelineState } from "./pipeline-state.js";
import type { Clarification } from "./types.js";

type QuestionItem = { question: string; reason: string };
type HumanAnswer = { question: string; answer: string };
type HumanAnswers = Array<HumanAnswer>;
type HumanInterruptPayload = { questions: Array<QuestionItem> };
type ReviewInterruptPayload = { prd: string; message: string };

export function humanPromptNode(state: PipelineState): Partial<PipelineState> {
  let questions: Array<QuestionItem> = [];
  try {
    const parsed = JSON.parse(state.analysisResult);
    const result = prdAnalysisSchema.safeParse(parsed);
    if (result.success) {
      questions = result.data.questions;
    }
  } catch {
    questions = [];
  }

  const interruptPayload: HumanInterruptPayload = { questions };
  const answers: HumanAnswers = interrupt<HumanInterruptPayload, HumanAnswers>(
    interruptPayload,
  );

  const clarifications: Array<Clarification> = answers.map(
    (a: HumanAnswer): Clarification => {
      const c: Clarification = {
        question: a.question,
        answer: a.answer,
        confident: true,
      };
      return c;
    },
  );

  const clarificationRound: number = state.clarificationRound + 1;
  const update: Partial<PipelineState> = {
    clarifications: [...state.clarifications, ...clarifications],
    clarificationRound,
    status: "clarifications_answered",
  };
  return update;
}

export function reviewNode(_state: PipelineState): Partial<PipelineState> {
  const payload: ReviewInterruptPayload = {
    prd: _state.prd,
    message:
      "PRD is ready for review. Resume when ready to proceed to planning.",
  };
  interrupt(payload);
  const update: Partial<PipelineState> = { status: "prd_reviewed" };
  return update;
}
