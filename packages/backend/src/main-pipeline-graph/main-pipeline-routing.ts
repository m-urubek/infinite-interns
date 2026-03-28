import { type MainPipelineState } from "./main-pipeline-types";
import * as Util from "../shared/util";
import { type AnalysisControllerRoute } from "../nodes/analysis-controller/analysis-controller-types";

// ---------------------------------------------------------------------------
// Routing: after analysis controller, route to the next target
// ---------------------------------------------------------------------------

export type PostAnalysisControllerRoute = AnalysisControllerRoute;

export function routeAfterAnalysisController(
  state: NonNullable<MainPipelineState>
): NonNullable<PostAnalysisControllerRoute> {
  const controllerOutput: typeof state.analysisControllerState.output = state.analysisControllerState.output;

  if (!Util.isNotNullOrUndf(controllerOutput)) {
    throw new Error("Analysis controller output is null or undefined");
  }

  const resultRoute: NonNullable<PostAnalysisControllerRoute> = controllerOutput.nextTarget;
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after controller, decide whether to microplan, implement, or finalize
// ---------------------------------------------------------------------------

export type PostControllerRoute =
  | "microplannerGraph"
  | "implementerGraph"
  | "finalVerifierGraph"
  | "documentationIndexerGraph"
  | "__end__";

export function routeAfterController(state: NonNullable<MainPipelineState>): NonNullable<PostControllerRoute> {
  let resultRoute: NonNullable<PostControllerRoute>;

  if (state.controllerState.internal.allTasksDone) {
    const finalVerifierEnabled: NonNullable<boolean> = state.finalVerifierEnabled;
    const docsEnabled: NonNullable<boolean> = state.documentationConfig?.enabled ?? false;

    if (finalVerifierEnabled) {
      resultRoute = "finalVerifierGraph" as NonNullable<PostControllerRoute>;
    } else if (docsEnabled) {
      resultRoute = "documentationIndexerGraph" as NonNullable<PostControllerRoute>;
    } else {
      resultRoute = "__end__" as NonNullable<PostControllerRoute>;
    }
  } else {
    const microplannerEnabled: NonNullable<boolean> = state.microplannerEnabled;
    const isCorrection: NonNullable<boolean> = state.controllerState.output?.isCorrection ?? false;

    // Skip microplanner for correction runs — go straight to implementer
    if (microplannerEnabled && !isCorrection) {
      resultRoute = "microplannerGraph" as NonNullable<PostControllerRoute>;
    } else {
      resultRoute = "implementerGraph" as NonNullable<PostControllerRoute>;
    }
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after implementer, decide whether to build, verify, or loop back
// ---------------------------------------------------------------------------

export type PostImplementerRoute = "builderNode" | "verifierGraph" | "testsGeneratorGraph";

export function routeAfterImplementer(state: NonNullable<MainPipelineState>): NonNullable<PostImplementerRoute> {
  let resultRoute: NonNullable<PostImplementerRoute>;

  if (state.builderEnabled) {
    resultRoute = "builderNode" as NonNullable<PostImplementerRoute>;
  } else if (state.microVerifierEnabled) {
    resultRoute = "verifierGraph" as NonNullable<PostImplementerRoute>;
  } else {
    resultRoute = "testsGeneratorGraph" as NonNullable<PostImplementerRoute>;
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after builder, decide whether to verify, generate tests, or correct
// ---------------------------------------------------------------------------

export type PostBuilderRoute = "verifierGraph" | "testsGeneratorGraph" | "controllerNode";

export function routeAfterBuilder(state: NonNullable<MainPipelineState>): NonNullable<PostBuilderRoute> {
  if (!Util.isNotNullOrUndf(state.builderState.output)) {
    throw new Error("Builder output is null or undefined after build");
  }

  let resultRoute: NonNullable<PostBuilderRoute>;

  if (state.builderState.output.success) {
    if (state.microVerifierEnabled) {
      resultRoute = "verifierGraph" as NonNullable<PostBuilderRoute>;
    } else {
      resultRoute = "testsGeneratorGraph" as NonNullable<PostBuilderRoute>;
    }
  } else {
    resultRoute = "controllerNode" as NonNullable<PostBuilderRoute>;
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after verifier, decide whether to generate tests or correct
// ---------------------------------------------------------------------------

export type PostVerifierRoute = "testsGeneratorGraph" | "controllerNode";

export function routeAfterVerifier(state: NonNullable<MainPipelineState>): NonNullable<PostVerifierRoute> {
  if (!Util.isNotNullOrUndf(state.verifierState.output)) {
    throw new Error("Verifier output is null or undefined after verification");
  }

  let resultRoute: NonNullable<PostVerifierRoute>;

  if (state.verifierState.output.success) {
    resultRoute = "testsGeneratorGraph" as NonNullable<PostVerifierRoute>;
  } else {
    resultRoute = "controllerNode" as NonNullable<PostVerifierRoute>;
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after tests generator, decide whether to micro-document or loop back
// ---------------------------------------------------------------------------

export type PostTestsGeneratorRoute = "microDocumenterGraph" | "controllerNode";

export function routeAfterTestsGenerator(state: NonNullable<MainPipelineState>): NonNullable<PostTestsGeneratorRoute> {
  const docsEnabled: NonNullable<boolean> = state.documentationConfig?.enabled ?? false;

  let resultRoute: NonNullable<PostTestsGeneratorRoute>;

  if (docsEnabled) {
    resultRoute = "microDocumenterGraph" as NonNullable<PostTestsGeneratorRoute>;
  } else {
    resultRoute = "controllerNode" as NonNullable<PostTestsGeneratorRoute>;
  }
  return resultRoute;
}

// ---------------------------------------------------------------------------
// Routing: after final verifier, decide whether to index docs or end
// ---------------------------------------------------------------------------

export type PostFinalVerifierRoute = "documentationIndexerGraph" | "__end__";

export function routeAfterFinalVerifier(state: NonNullable<MainPipelineState>): NonNullable<PostFinalVerifierRoute> {
  const docsEnabled: NonNullable<boolean> = state.documentationConfig?.enabled ?? false;

  let resultRoute: NonNullable<PostFinalVerifierRoute>;

  if (docsEnabled) {
    resultRoute = "documentationIndexerGraph" as NonNullable<PostFinalVerifierRoute>;
  } else {
    resultRoute = "__end__" as NonNullable<PostFinalVerifierRoute>;
  }
  return resultRoute;
}
