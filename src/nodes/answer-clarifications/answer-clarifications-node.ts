import * as Langgraph from "@langchain/langgraph";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";
import { type ClarifyingQuestion } from "../../main-pipeline-graph/main-pipeline-types";
import * as Util from "../../shared/util";
import { type PrdAnalyzerOutput } from "../../agents/prd-analyzer/prd-analyzer-types";

type HumanAnswers = NonNullable<Array<string>>;

export function answerClarificationsNode(
  state: NonNullable<MainPipelineState>
): NonNullable<Partial<MainPipelineState>> {
  // Read from upstream output (prdAnalyzerState.output)
  const analyzerOutput: PrdAnalyzerOutput | null | undefined = state.prdAnalyzerState.output;
  if (!Util.isNotNullOrUndf(analyzerOutput)) {
    throw new Error("PRD Analyzer output is null or undefined");
  }
  const questions: NonNullable<Array<string>> = analyzerOutput.questions;

  // Interrupt execution and wait for human answers.
  // The human resumes with Command({ resume: ["answer1", "answer2", ...] })
  const humanAnswers: NonNullable<HumanAnswers> = Langgraph.interrupt<Array<string>, NonNullable<HumanAnswers>>(
    questions
  );

  // Build new clarifications from the human answers
  const newClarifications: NonNullable<Array<ClarifyingQuestion>> = questions.map(
    (question: NonNullable<string>, index: NonNullable<number>): NonNullable<ClarifyingQuestion> => {
      const clarification: NonNullable<ClarifyingQuestion> = {
        question: question,
        answer: humanAnswers[index] ?? null,
      };
      return clarification;
    }
  );

  // Read previous clarifications from upstream output (prdAnalyzerState.output — direct upstream, passes them through)
  const existingClarifications: NonNullable<Array<ClarifyingQuestion>> = analyzerOutput.clarifications ?? [];
  const allClarifications: NonNullable<Array<ClarifyingQuestion>> = [...existingClarifications, ...newClarifications];

  // Write own internal
  state.answerClarificationsState.internal.clarificationRound =
    state.answerClarificationsState.internal.clarificationRound + 1;

  // Write own output (prdGeneratorGraph reads this on the next run)
  state.answerClarificationsState.output = {
    clarifications: allClarifications,
  };

  const update: NonNullable<Partial<MainPipelineState>> = {
    answerClarificationsState: state.answerClarificationsState,
  };
  return update;
}
