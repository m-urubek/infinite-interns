import { StateGraph, MemorySaver } from "@langchain/langgraph";

import {
  PipelineStateAnnotation,
  PipelineInput,
  routeAfterVerify,
  routeAfterFinalVerify,
  routeStopCheck,
  MAX_CLARIFICATION_ROUNDS,
} from "./pipeline-state.js";
import type { PipelineState, VerifyRoute } from "./pipeline-state.js";
import { prdGeneratorGraph } from "./agents/prd-generator.js";
import { analyzePrdGraph } from "./agents/prd-analyzer.js";
import { businessAnalyzeGraph } from "./agents/business-analyzer.js";
import { answerClarificationsGraph } from "./agents/clarification-answerer.js";
import { createPlanGraph } from "./agents/planner.js";
import { microplannerGraph } from "./agents/microplanner.js";
import { implementGraph } from "./agents/implementer.js";
import { verifierGraph } from "./agents/verifier.js";
import { finalVerifyGraph } from "./agents/final-verifier.js";
import { humanPromptNode, reviewNode } from "./pipeline-human-input.js";

// ---------------------------------------------------------------------------
// Utility nodes
// ---------------------------------------------------------------------------

function stopCheckNode(_state: PipelineState): Partial<PipelineState> {
  const update: Partial<PipelineState> = {};
  return update;
}

// Resets clarificationRound before the tech phase so the tech phase
// gets its own MAX_CLARIFICATION_ROUNDS budget separate from biz phase
function enterTechPhaseNode(_state: PipelineState): Partial<PipelineState> {
  const update: Partial<PipelineState> = { clarificationRound: 0 };
  return update;
}

// ---------------------------------------------------------------------------
// Phase routing functions
// ---------------------------------------------------------------------------

type BizPhaseRoute = "humanPrompt" | "__end__";

function routeInsideBizPhase(state: PipelineState): BizPhaseRoute {
  let route: BizPhaseRoute;
  if (
    state.needsClarification &&
    state.clarificationRound < MAX_CLARIFICATION_ROUNDS
  ) {
    route = "humanPrompt";
  } else {
    route = "__end__";
  }
  return route;
}

type TechPhaseRoute = "answerClarifications" | "__end__";

function routeInsideTechPhase(state: PipelineState): TechPhaseRoute {
  let route: TechPhaseRoute;
  if (
    state.needsClarification &&
    state.clarificationRound < MAX_CLARIFICATION_ROUNDS
  ) {
    route = "answerClarifications";
  } else {
    route = "__end__";
  }
  return route;
}

type AssignmentLoopRoute = "createMicroplan" | "__end__";

function routeInsideAssignmentLoop(state: PipelineState): AssignmentLoopRoute {
  const verifyRoute: VerifyRoute = routeAfterVerify(state);
  const route: AssignmentLoopRoute =
    verifyRoute === "createMicroplan" ? "createMicroplan" : "__end__";
  return route;
}

// ---------------------------------------------------------------------------
// Phase subgraphs
// ---------------------------------------------------------------------------

const bizPhaseGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("generatePrd", prdGeneratorGraph)
  .addNode("businessAnalyze", businessAnalyzeGraph)
  .addNode("humanPrompt", humanPromptNode)
  .addEdge("__start__", "generatePrd")
  .addEdge("generatePrd", "businessAnalyze")
  .addConditionalEdges("businessAnalyze", routeInsideBizPhase, [
    "humanPrompt",
    "__end__",
  ])
  .addEdge("humanPrompt", "generatePrd")
  .compile();

const techPhaseGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("generatePrd", prdGeneratorGraph)
  .addNode("techAnalyze", analyzePrdGraph)
  .addNode("answerClarifications", answerClarificationsGraph)
  .addEdge("__start__", "generatePrd")
  .addEdge("generatePrd", "techAnalyze")
  .addConditionalEdges("techAnalyze", routeInsideTechPhase, [
    "answerClarifications",
    "__end__",
  ])
  .addEdge("answerClarifications", "generatePrd")
  .compile();

const assignmentLoopGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("createMicroplan", microplannerGraph)
  .addNode("implement", implementGraph)
  .addNode("verify", verifierGraph)
  .addEdge("__start__", "createMicroplan")
  .addEdge("createMicroplan", "implement")
  .addEdge("implement", "verify")
  .addConditionalEdges("verify", routeInsideAssignmentLoop, [
    "createMicroplan",
    "__end__",
  ])
  .compile();

// ---------------------------------------------------------------------------
// Main pipeline graph
// ---------------------------------------------------------------------------

const graphBuilder = new StateGraph({
  stateSchema: PipelineStateAnnotation,
  input: PipelineInput,
})
  .addNode("bizPhase", bizPhaseGraph)
  .addNode("enterTechPhase", enterTechPhaseNode)
  .addNode("techPhase", techPhaseGraph)
  .addNode("stopCheck", stopCheckNode)
  .addNode("review", reviewNode)
  .addNode("createPlan", createPlanGraph)
  .addNode("assignmentLoop", assignmentLoopGraph)
  .addNode("finalVerify", finalVerifyGraph)

  .addEdge("__start__", "bizPhase")
  .addEdge("bizPhase", "enterTechPhase")
  .addEdge("enterTechPhase", "techPhase")
  .addEdge("techPhase", "stopCheck")
  .addConditionalEdges("stopCheck", routeStopCheck, ["review", "createPlan"])
  .addEdge("review", "createPlan")
  .addEdge("createPlan", "assignmentLoop")
  .addEdge("assignmentLoop", "finalVerify")
  .addConditionalEdges("finalVerify", routeAfterFinalVerify, [
    "createPlan",
    "__end__",
  ]);

// Export the uncompiled builder so CLI runners can inject their own checkpointer
export { graphBuilder };

// Default export compiled with MemorySaver for LangGraph Studio and direct use
export const graph = graphBuilder.compile({
  checkpointer: new MemorySaver(),
});
