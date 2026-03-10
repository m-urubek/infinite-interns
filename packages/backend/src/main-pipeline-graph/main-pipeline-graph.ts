import * as Langgraph from "@langchain/langgraph";
import * as MainPipelineAnnotations from "./main-pipeline-annotations";
import * as PrdGeneratorGraph from "../agents/prd-generator/prd-generator-graph";
import * as PrdAnalyzerGraph from "../agents/prd-analyzer/prd-analyzer-graph";
import * as AnswerClarificationsNode from "../nodes/answer-clarifications/answer-clarifications-node";
import * as PlannerGraph from "../agents/planner/planner-graph";
import * as ControllerNode from "../nodes/controller/controller-node";
import * as ImplementerGraph from "../agents/implementer/implementer-graph";
import * as BuilderNode from "../nodes/builder/builder-node";
import * as VerifierGraph from "../agents/verifier/verifier-graph";
import * as FinalVerifierGraph from "../agents/final-verifier/final-verifier-graph";
import * as MainPipelineRouting from "./main-pipeline-routing";
import { type PostAnalyzerRoute, type PostControllerRoute, type PostBuilderRoute } from "./main-pipeline-routing";
import { type MainPipelineState } from "./main-pipeline-types";

type AnalyzerRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostAnalyzerRoute>;
type ControllerRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostControllerRoute>;
type BuilderRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostBuilderRoute>;

const routeAfterAnalyzer: NonNullable<AnalyzerRouteFunction> = MainPipelineRouting.routeAfterAnalyzer;
const routeAfterController: NonNullable<ControllerRouteFunction> = MainPipelineRouting.routeAfterController;
const routeAfterBuilder: NonNullable<BuilderRouteFunction> = MainPipelineRouting.routeAfterBuilder;

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
  .addConditionalEdges("controllerNode", routeAfterController, ["implementerGraph", "finalVerifierGraph", "__end__"])
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
