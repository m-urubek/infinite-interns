import * as Langgraph from "@langchain/langgraph";
import * as MainPipelineAnnotations from "./main-pipeline-annotations";
import * as PrdGeneratorGraph from "../agents/prd-generator/prd-generator-graph";
import * as PrdAnalyzerGraph from "../agents/prd-analyzer/prd-analyzer-graph";
import { type MainPipelineState } from "./main-pipeline-types";
import * as SharedUtility from "../shared/shared-utility";
import { type PrdAnalyzerOutput } from "../agents/prd-analyzer/prd-analyzer-types";
import * as AnswerClarificationsNode from "../nodes/answer-clarifications/answer-clarifications-node";
import * as PlannerGraph from "../agents/planner/planner-graph";
import * as ControllerNode from "../nodes/controller/controller-node";
import * as ImplementerGraph from "../agents/implementer/implementer-graph";
import * as BuilderNode from "../nodes/builder/builder-node";
import * as VerifierGraph from "../agents/verifier/verifier-graph";
import * as FinalVerifierGraph from "../agents/final-verifier/final-verifier-graph";

const MAX_CLARIFICATION_ROUNDS: NonNullable<number> = 5;

// ---------------------------------------------------------------------------
// Routing: after analyzer, decide whether to ask for clarifications or plan
// ---------------------------------------------------------------------------

type PostAnalyzerRoute = "answerClarificationsNode" | "plannerGraph";

function routeAfterAnalyzer(state: NonNullable<MainPipelineState>): NonNullable<PostAnalyzerRoute> {
  const analyzerOutput: PrdAnalyzerOutput | null | undefined = state.prdAnalyzerState.output;

  if (!SharedUtility.isNotNullOrUndf(analyzerOutput)) {
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

type PostControllerRoute = "implementerGraph" | "finalVerifierGraph";

function routeAfterController(state: NonNullable<MainPipelineState>): NonNullable<PostControllerRoute> {
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

type PostBuilderRoute = "verifierGraph" | "controllerNode";

function routeAfterBuilder(state: NonNullable<MainPipelineState>): NonNullable<PostBuilderRoute> {
  if (!SharedUtility.isNotNullOrUndf(state.builderState.output)) {
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

// ---------------------------------------------------------------------------
// Main pipeline graph
//
// Flow:
//   __start__ -> prdGeneratorGraph -> prdAnalyzerGraph
//     -> (needsClarification?) -> Yes -> answerClarificationsNode (interrupt)
//                                        -> prdGeneratorGraph (loop)
//     -> No / round limit reached  -> plannerGraph
//     -> controllerNode -> (allTasksDone?)
//       -> No  -> implementerGraph -> builderNode -> (buildSuccess?)
//         -> Yes -> verifierGraph -> controllerNode (loop)
//         -> No  -> controllerNode (correction loop)
//       -> Yes -> finalVerifierGraph -> __end__
// ---------------------------------------------------------------------------

const graphBuilder = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
  input: MainPipelineAnnotations.mainPipelineInputAnnotation,
})
  .addNode("prdGeneratorGraph", PrdGeneratorGraph.prdGeneratorGraph)
  .addNode("prdAnalyzerGraph", PrdAnalyzerGraph.prdAnalyzerGraph)
  .addNode("answerClarificationsNode", AnswerClarificationsNode.answerClarificationsNode)
  .addNode("plannerGraph", PlannerGraph.plannerGraph)
  .addNode("controllerNode", ControllerNode.controllerNode)
  .addNode("implementerGraph", ImplementerGraph.implementerGraph)
  .addNode("builderNode", BuilderNode.builderNode)
  .addNode("verifierGraph", VerifierGraph.verifierGraph)
  .addNode("finalVerifierGraph", FinalVerifierGraph.finalVerifierGraph)
  .addEdge("__start__", "prdGeneratorGraph")
  .addEdge("prdGeneratorGraph", "prdAnalyzerGraph")
  .addConditionalEdges("prdAnalyzerGraph", routeAfterAnalyzer, ["answerClarificationsNode", "plannerGraph"])
  .addEdge("answerClarificationsNode", "prdGeneratorGraph")
  .addEdge("plannerGraph", "controllerNode")
  .addConditionalEdges("controllerNode", routeAfterController, ["implementerGraph", "finalVerifierGraph"])
  .addEdge("implementerGraph", "builderNode")
  .addConditionalEdges("builderNode", routeAfterBuilder, ["verifierGraph", "controllerNode"])
  .addEdge("verifierGraph", "controllerNode")
  .addEdge("finalVerifierGraph", "__end__");

// Export the uncompiled builder so CLI runners can inject their own checkpointer
export { graphBuilder };

// Default export compiled with MemorySaver for LangGraph Studio and direct use
export const graph = graphBuilder.compile({
  checkpointer: new Langgraph.MemorySaver(),
});
