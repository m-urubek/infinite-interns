import * as Langgraph from "@langchain/langgraph";
import * as MainPipelineAnnotations from "./main-pipeline-annotations";
import * as PrdGeneratorGraph from "../agents/prd-generator/prd-generator-graph";
import * as PrdAnalyzerGraph from "../agents/prd-analyzer/prd-analyzer-graph";
import * as TechnicalPrdAnalyzerGraph from "../agents/technical-prd-analyzer/technical-prd-analyzer-graph";
import * as AnswerClarificationsNode from "../nodes/answer-clarifications/answer-clarifications-node";
import * as BusinessClarificationAnswererGraph from "../agents/business-clarification-answerer/business-clarification-answerer-graph";
import * as TechnicalClarificationAnswererGraph from "../agents/technical-clarification-answerer/technical-clarification-answerer-graph";
import * as AnalysisControllerNode from "../nodes/analysis-controller/analysis-controller-node";
import * as PlannerGraph from "../agents/planner/planner-graph";
import * as ControllerNode from "../nodes/controller/controller-node";
import * as MicroplannerGraph from "../agents/microplanner/microplanner-graph";
import * as ImplementerGraph from "../agents/implementer/implementer-graph";
import * as BuilderNode from "../nodes/builder/builder-node";
import * as VerifierGraph from "../agents/verifier/verifier-graph";
import * as TestsGeneratorGraph from "../agents/tests-generator/tests-generator-graph";
import * as FinalVerifierGraph from "../agents/final-verifier/final-verifier-graph";
import * as InitialDocumenterGraph from "../agents/initial-documenter/initial-documenter-graph";
import * as MicroDocumenterGraph from "../agents/micro-documenter/micro-documenter-graph";
import * as DocumentationIndexerGraph from "../agents/documentation-indexer/documentation-indexer-graph";
import * as FinalDocumenterGraph from "../agents/final-documenter/final-documenter-graph";
import * as MainPipelineRouting from "./main-pipeline-routing";
import {
  type PostAnalysisControllerRoute,
  type PostControllerRoute,
  type PostImplementerRoute,
  type PostBuilderRoute,
  type PostVerifierRoute,
  type PostTestsGeneratorRoute,
  type PostFinalVerifierRoute,
} from "./main-pipeline-routing";
import { type MainPipelineState } from "./main-pipeline-types";

type AnalysisControllerRouteFunction = (
  state: NonNullable<MainPipelineState>
) => NonNullable<PostAnalysisControllerRoute>;
type ControllerRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostControllerRoute>;
type ImplementerRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostImplementerRoute>;
type BuilderRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostBuilderRoute>;
type VerifierRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostVerifierRoute>;
type TestsGeneratorRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostTestsGeneratorRoute>;
type FinalVerifierRouteFunction = (state: NonNullable<MainPipelineState>) => NonNullable<PostFinalVerifierRoute>;

const routeAfterAnalysisController: NonNullable<AnalysisControllerRouteFunction> =
  MainPipelineRouting.routeAfterAnalysisController;
const routeAfterController: NonNullable<ControllerRouteFunction> = MainPipelineRouting.routeAfterController;
const routeAfterImplementer: NonNullable<ImplementerRouteFunction> = MainPipelineRouting.routeAfterImplementer;
const routeAfterBuilder: NonNullable<BuilderRouteFunction> = MainPipelineRouting.routeAfterBuilder;
const routeAfterVerifier: NonNullable<VerifierRouteFunction> = MainPipelineRouting.routeAfterVerifier;
const routeAfterTestsGenerator: NonNullable<TestsGeneratorRouteFunction> = MainPipelineRouting.routeAfterTestsGenerator;
const routeAfterFinalVerifier: NonNullable<FinalVerifierRouteFunction> = MainPipelineRouting.routeAfterFinalVerifier;

// ---------------------------------------------------------------------------
// Main pipeline graph
//
// Flow:
//   __start__ -> analysisControllerNode -> conditional edges:
//     -> prdGeneratorGraph -> analysisControllerNode
//     -> prdAnalyzerGraph -> analysisControllerNode
//     -> technicalPrdAnalyzerGraph -> analysisControllerNode
//     -> answerClarificationsNode -> analysisControllerNode
//     -> businessClarificationAnswererGraph -> analysisControllerNode
//     -> technicalClarificationAnswererGraph -> analysisControllerNode
//     -> initialDocumenterGraph (docs enabled) -> plannerGraph
//     -> plannerGraph -> controllerNode -> (allTasksDone?)
//       -> No (microplanner enabled + not correction) -> microplannerGraph -> implementerGraph
//       -> No (microplanner disabled or correction) -> implementerGraph
//       -> implementerGraph -> (builder enabled?)
//         -> Yes -> builderNode -> (buildSuccess?)
//           -> Yes + verifier enabled -> verifierGraph -> (success?)
//             -> Yes -> testsGeneratorGraph -> (docs enabled?)
//               -> Yes -> microDocumenterGraph -> controllerNode
//               -> No  -> controllerNode
//             -> No  -> controllerNode (correction loop)
//           -> Yes + verifier disabled -> testsGeneratorGraph -> ...
//           -> No  -> controllerNode (correction loop)
//         -> No + verifier enabled -> verifierGraph -> ...
//         -> No + verifier disabled -> testsGeneratorGraph -> ...
//       -> Yes + finalVerifier enabled -> finalVerifierGraph -> (docs enabled?)
//         -> Yes -> documentationIndexerGraph -> finalDocumenterGraph -> __end__
//         -> No  -> __end__
//       -> Yes + finalVerifier disabled + docs enabled -> documentationIndexerGraph -> ...
//       -> Yes + finalVerifier disabled + docs disabled -> __end__
// ---------------------------------------------------------------------------

const graphBuilder = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
  input: MainPipelineAnnotations.mainPipelineInputAnnotation,
})
  // Analysis section nodes
  .addNode("analysisControllerNode", AnalysisControllerNode.analysisControllerNode)
  .addNode("prdGeneratorGraph", PrdGeneratorGraph.prdGeneratorGraph)
  .addNode("prdAnalyzerGraph", PrdAnalyzerGraph.prdAnalyzerGraph)
  .addNode("technicalPrdAnalyzerGraph", TechnicalPrdAnalyzerGraph.technicalPrdAnalyzerGraph)
  .addNode("answerClarificationsNode", AnswerClarificationsNode.answerClarificationsNode)
  .addNode("businessClarificationAnswererGraph", BusinessClarificationAnswererGraph.businessClarificationAnswererGraph)
  .addNode(
    "technicalClarificationAnswererGraph",
    TechnicalClarificationAnswererGraph.technicalClarificationAnswererGraph
  )
  // Planning + implementation section nodes
  .addNode("plannerGraph", PlannerGraph.plannerGraph)
  .addNode("controllerNode", ControllerNode.controllerNode)
  .addNode("microplannerGraph", MicroplannerGraph.microplannerGraph)
  .addNode("implementerGraph", ImplementerGraph.implementerGraph)
  .addNode("builderNode", BuilderNode.builderNode)
  .addNode("verifierGraph", VerifierGraph.verifierGraph)
  .addNode("testsGeneratorGraph", TestsGeneratorGraph.testsGeneratorGraph)
  .addNode("finalVerifierGraph", FinalVerifierGraph.finalVerifierGraph)
  // Documentation section nodes
  .addNode("initialDocumenterGraph", InitialDocumenterGraph.initialDocumenterGraph)
  .addNode("microDocumenterGraph", MicroDocumenterGraph.microDocumenterGraph)
  .addNode("documentationIndexerGraph", DocumentationIndexerGraph.documentationIndexerGraph)
  .addNode("finalDocumenterGraph", FinalDocumenterGraph.finalDocumenterGraph)
  // Analysis section edges
  .addEdge("__start__", "analysisControllerNode")
  .addConditionalEdges("analysisControllerNode", routeAfterAnalysisController, [
    "prdGeneratorGraph",
    "prdAnalyzerGraph",
    "technicalPrdAnalyzerGraph",
    "answerClarificationsNode",
    "businessClarificationAnswererGraph",
    "technicalClarificationAnswererGraph",
    "initialDocumenterGraph",
    "plannerGraph",
  ])
  .addEdge("prdGeneratorGraph", "analysisControllerNode")
  .addEdge("prdAnalyzerGraph", "analysisControllerNode")
  .addEdge("technicalPrdAnalyzerGraph", "analysisControllerNode")
  .addEdge("answerClarificationsNode", "analysisControllerNode")
  .addEdge("businessClarificationAnswererGraph", "analysisControllerNode")
  .addEdge("technicalClarificationAnswererGraph", "analysisControllerNode")
  // Documentation: initial documenter → planner
  .addEdge("initialDocumenterGraph", "plannerGraph")
  // Planning + implementation section edges
  .addEdge("plannerGraph", "controllerNode")
  .addConditionalEdges("controllerNode", routeAfterController, [
    "microplannerGraph",
    "implementerGraph",
    "finalVerifierGraph",
    "documentationIndexerGraph",
    "__end__",
  ])
  .addEdge("microplannerGraph", "implementerGraph")
  .addConditionalEdges("implementerGraph", routeAfterImplementer, [
    "builderNode",
    "verifierGraph",
    "testsGeneratorGraph",
  ])
  .addConditionalEdges("builderNode", routeAfterBuilder, ["verifierGraph", "testsGeneratorGraph", "controllerNode"])
  .addConditionalEdges("verifierGraph", routeAfterVerifier, ["testsGeneratorGraph", "controllerNode"])
  // Documentation: after tests generator → micro documenter (if docs enabled) or controller
  .addConditionalEdges("testsGeneratorGraph", routeAfterTestsGenerator, ["microDocumenterGraph", "controllerNode"])
  .addEdge("microDocumenterGraph", "controllerNode")
  // Documentation: after final verifier → documentation indexer (if docs enabled) or end
  .addConditionalEdges("finalVerifierGraph", routeAfterFinalVerifier, ["documentationIndexerGraph", "__end__"])
  .addEdge("documentationIndexerGraph", "finalDocumenterGraph")
  .addEdge("finalDocumenterGraph", "__end__");

// Export the uncompiled builder so CLI runners can inject their own checkpointer
export { graphBuilder };

// Default export compiled with MemorySaver for LangGraph Studio and direct use
export const graph = graphBuilder.compile({
  checkpointer: new Langgraph.MemorySaver(),
});
