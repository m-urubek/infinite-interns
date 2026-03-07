import { StateGraph, interrupt, MemorySaver } from "@langchain/langgraph";
import { analysisSchema as prdAnalysisSchema } from "./agents/prd-analyzer.js";

import {
  PipelineStateAnnotation,
  PipelineInput,
  routeAfterVerify,
  routeAfterFinalVerify,
  routeStopCheck,
  MAX_CLARIFICATION_ROUNDS,
} from "./pipeline-state.js";
import type { PipelineState, VerifyRoute } from "./pipeline-state.js";
import type { Clarification } from "./types.js";
import { analyzePrdGraph } from "./agents/prd-analyzer.js";
import { businessAnalyzeGraph } from "./agents/business-analyzer.js";
import { answerClarificationsGraph } from "./agents/clarification-answerer.js";
import { createPlanGraph } from "./agents/planner.js";
import { microplannerGraph } from "./agents/microplanner.js";
import { implementGraph } from "./agents/implementer.js";
import { verifierGraph } from "./agents/verifier.js";
import { finalVerifyGraph } from "./agents/final-verifier.js";
import { create as createPrdGenerator } from "./agents/prd-generator.js";

// ---------------------------------------------------------------------------
// Human interrupt payload types
// ---------------------------------------------------------------------------

type QuestionItem = { question: string; reason: string };
type HumanAnswer = { question: string; answer: string };
type HumanAnswers = Array<HumanAnswer>;
type HumanInterruptPayload = { questions: Array<QuestionItem> };
type ReviewInterruptPayload = { prd: string; message: string };

// ---------------------------------------------------------------------------
// Shared node: generatePrd — plain invocation, used inside every phase
// ---------------------------------------------------------------------------

async function generatePrdNode(
  state: PipelineState,
): Promise<Partial<PipelineState>> {
  let message: string = `Task: ${state.task}`;

  if (state.clarifications.length > 0) {
    message += `\n\nPrevious clarifications:\n${JSON.stringify(state.clarifications, null, 2)}`;
  }

  const agent: import("/home/pc/Coding/orchestration-tools/node_modules/deepagents/dist/index").DeepAgent =
    createPrdGenerator(state.projectDir);
  const rawResult = await agent.invoke({
    messages: [{ role: "user", content: message }],
  });

  type AgentResult = {
    messages: Array<{ content: unknown }>;
    structuredResponse?: unknown;
  };
  const result: AgentResult = rawResult as AgentResult;

  let prd: string;
  if (
    result.structuredResponse !== undefined &&
    result.structuredResponse !== null
  ) {
    prd = JSON.stringify(result.structuredResponse);
  } else {
    const lastMsg: { content: unknown } | undefined = result.messages.at(-1);
    prd = lastMsg
      ? typeof lastMsg.content === "string"
        ? lastMsg.content
        : JSON.stringify(lastMsg.content)
      : "";
  }

  const update: Partial<PipelineState> = {
    prd,
    analysisResult: "",
    needsClarification: false,
    assignments: [],
    status: "prd_generated",
  };
  return update;
}

// ---------------------------------------------------------------------------
// Shared node: humanPrompt — pauses via interrupt() for human clarification
// (used in both interactive and autonomous business phases)
// ---------------------------------------------------------------------------

function humanPromptNode(state: PipelineState): Partial<PipelineState> {
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

// ---------------------------------------------------------------------------
// Phase subgraphs: composed of agent graphs and nodes
// ---------------------------------------------------------------------------

type InteractivePhaseRoute = "humanPrompt" | "__end__";

function routeInsideInteractivePhase(
  state: PipelineState,
): InteractivePhaseRoute {
  let route: InteractivePhaseRoute;
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

const interactivePhaseGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("generatePrd", generatePrdNode)
  .addNode("analyzePrd", analyzePrdGraph)
  .addNode("humanPrompt", humanPromptNode)
  .addEdge("__start__", "generatePrd")
  .addEdge("generatePrd", "analyzePrd")
  .addConditionalEdges("analyzePrd", routeInsideInteractivePhase, [
    "humanPrompt",
    "__end__",
  ])
  .addEdge("humanPrompt", "generatePrd")
  .compile();

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

const bizPhaseGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("generatePrd", generatePrdNode)
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

const techPhaseGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("generatePrd", generatePrdNode)
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

type AssignmentLoopRoute = "createMicroplan" | "__end__";

function routeInsideAssignmentLoop(state: PipelineState): AssignmentLoopRoute {
  const verifyRoute: VerifyRoute = routeAfterVerify(state);
  const route: AssignmentLoopRoute =
    verifyRoute === "createMicroplan" ? "createMicroplan" : "__end__";
  return route;
}

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
// Main pipeline nodes: review, stopCheck, enterTechPhase
// ---------------------------------------------------------------------------

function reviewNode(state: PipelineState): Partial<PipelineState> {
  const payload: ReviewInterruptPayload = {
    prd: state.prd,
    message:
      "PRD is ready for review. Resume when ready to proceed to planning.",
  };
  interrupt(payload);
  const update: Partial<PipelineState> = { status: "prd_reviewed" };
  return update;
}

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
// Level 1: Main pipeline graph — clean DAG of phase subgraphs
// ---------------------------------------------------------------------------

type ModeRoute = "interactivePhase" | "bizPhase";

function routeAfterMode(state: PipelineState): ModeRoute {
  let route: ModeRoute;
  if (state.mode === "interactive") {
    route = "interactivePhase";
  } else {
    route = "bizPhase";
  }
  return route;
}

const graphBuilder = new StateGraph({
  stateSchema: PipelineStateAnnotation,
  input: PipelineInput,
})
  // Phase subgraphs
  .addNode("interactivePhase", interactivePhaseGraph)
  .addNode("bizPhase", bizPhaseGraph)
  .addNode("enterTechPhase", enterTechPhaseNode)
  .addNode("techPhase", techPhaseGraph)
  // Post-PRD nodes
  .addNode("stopCheck", stopCheckNode)
  .addNode("review", reviewNode)
  // Implementation nodes
  .addNode("createPlan", createPlanGraph)
  .addNode("assignmentLoop", assignmentLoopGraph)
  .addNode("finalVerify", finalVerifyGraph)

  // Mode routing at start
  .addConditionalEdges("__start__", routeAfterMode, [
    "interactivePhase",
    "bizPhase",
  ])
  // Interactive path: interactivePhase → stopCheck
  .addEdge("interactivePhase", "stopCheck")
  // Autonomous path: bizPhase → enterTechPhase → techPhase → stopCheck
  .addEdge("bizPhase", "enterTechPhase")
  .addEdge("enterTechPhase", "techPhase")
  .addEdge("techPhase", "stopCheck")
  // stopCheck gate
  .addConditionalEdges("stopCheck", routeStopCheck, ["review", "createPlan"])
  .addEdge("review", "createPlan")
  // Implementation loop
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
