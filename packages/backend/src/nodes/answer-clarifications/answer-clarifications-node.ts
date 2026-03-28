import * as Langgraph from "@langchain/langgraph";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";
import { type ClarifyingQuestion } from "../../main-pipeline-graph/main-pipeline-types";
import * as Util from "../../shared/util";
import { type AnalysisControllerOutput } from "../analysis-controller/analysis-controller-types";

type HumanAnswers = NonNullable<Array<string>>;

export function answerClarificationsNode(
  state: NonNullable<MainPipelineState>
): NonNullable<Partial<MainPipelineState>> {
  // Read from upstream output (analysisControllerState.output)
  const controllerOutput: AnalysisControllerOutput | null | undefined = state.analysisControllerState.output;
  if (!Util.isNotNullOrUndf(controllerOutput)) {
    throw new Error("Analysis controller output is null or undefined");
  }
  const questions: NonNullable<Array<string>> = controllerOutput.questions;

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

  // Read previous clarifications from upstream output (analysisControllerState.output — direct upstream, passes them through)
  const existingClarifications: NonNullable<Array<ClarifyingQuestion>> = controllerOutput.clarifications ?? [];
  const allClarifications: NonNullable<Array<ClarifyingQuestion>> = [...existingClarifications, ...newClarifications];

  // Write own internal
  state.answerClarificationsState.internal.clarificationRound =
    state.answerClarificationsState.internal.clarificationRound + 1;

  // Write own output (analysisControllerNode reads this on the next run)
  state.answerClarificationsState.output = {
    clarifications: allClarifications,
  };

  const update: NonNullable<Partial<MainPipelineState>> = {
    answerClarificationsState: state.answerClarificationsState,
  };
  return update;
}
