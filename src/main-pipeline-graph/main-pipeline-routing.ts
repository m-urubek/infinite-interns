import { type MainPipelineState } from "./main-pipeline-types";
import * as Util from "../shared/util";
import { type PrdAnalyzerOutput } from "../agents/prd-analyzer/prd-analyzer-types";

const MAX_CLARIFICATION_ROUNDS: NonNullable<number> = 5;

// ---------------------------------------------------------------------------
// Routing: after analyzer, decide whether to ask for clarifications or plan
// ---------------------------------------------------------------------------

export type PostAnalyzerRoute = "answerClarificationsNode" | "plannerGraph";

export function routeAfterAnalyzer(state: NonNullable<MainPipelineState>): NonNullable<PostAnalyzerRoute> {
  const analyzerOutput: PrdAnalyzerOutput | null | undefined = state.prdAnalyzerState.output;

  if (!Util.isNotNullOrUndf(analyzerOutput)) {
    throw new Error("PRD Analyzer output is null or undefined after analysis");
  }

  let resultRoute: NonNullable<PostAnalyzerRoute>;

  const roundLimitReached: NonNullable<boolean> =
    state.answerClarificationsState.internal.clarificationRound >= MAX_CLARIFICATION_ROUNDS;

  if (!analyzerOutput.needsClarification || roundLimitReached) {
    resultRoute = "plannerGraph" as NonNullable<PostAnalyzerRoute>;
  } else {
    resultRoute = "answerClarificationsNode" as NonNullable<PostAnalyzerRoute>;
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after controller, decide whether to implement or finalize
// ---------------------------------------------------------------------------

export type PostControllerRoute = "implementerGraph" | "finalVerifierGraph";

export function routeAfterController(state: NonNullable<MainPipelineState>): NonNullable<PostControllerRoute> {
  let resultRoute: NonNullable<PostControllerRoute>;

  if (state.controllerState.internal.allTasksDone) {
    resultRoute = "finalVerifierGraph" as NonNullable<PostControllerRoute>;
  } else {
    resultRoute = "implementerGraph" as NonNullable<PostControllerRoute>;
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after builder, decide whether to verify or correct
// ---------------------------------------------------------------------------

export type PostBuilderRoute = "verifierGraph" | "controllerNode";

export function routeAfterBuilder(state: NonNullable<MainPipelineState>): NonNullable<PostBuilderRoute> {
  if (!Util.isNotNullOrUndf(state.builderState.output)) {
    throw new Error("Builder output is null or undefined after build");
  }

  let resultRoute: NonNullable<PostBuilderRoute>;

  if (state.builderState.output.success) {
    resultRoute = "verifierGraph" as NonNullable<PostBuilderRoute>;
  } else {
    resultRoute = "controllerNode" as NonNullable<PostBuilderRoute>;
  }
  return resultRoute;
}
