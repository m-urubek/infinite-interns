import { createDeepAgent, DeepAgent } from "deepagents";
import { providerStrategy } from "langchain";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyBackend } from "../backends/read-only-backend.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey } from "../pipeline-state.js";
import { z } from "zod";

export const analysisSchema = z.object({
  needsClarification: z
    .boolean()
    .describe("Whether clarification is needed from the user"),
  questions: z
    .array(
      z.object({
        question: z.string().describe("The question to ask"),
        reason: z.string().describe("Why this question is important"),
      }),
    )
    .describe("List of clarifying questions"),
  confidence: z.number().min(1).max(10).describe("Confidence level 1-10"),
  reasoning: z.string().describe("Explanation of the analysis"),
});

const PROMPT: string = `You are a critical PRD analyzer. Review a Product Requirements Document and identify gaps, contradictions, ambiguities, and assumptions that need validation.

IMPORTANT: You are an ANALYSIS agent. Do NOT create or modify any files.

Evaluate the PRD for:
- Missing edge cases
- Ambiguous requirements that could be interpreted multiple ways
- Unstated assumptions
- Contradictions between requirements
- Technical feasibility (use tools to check the codebase)
- Missing acceptance criteria
- Scope clarity
- Testability

Set needsClarification to false ONLY when you are confident all requirements are clear and complete. Focus questions on things that genuinely need user input.`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(analysisSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: analyzePrdGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

type AnalysisResult = { needsClarification: boolean; analysisResult: string };

function analyzePrdNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const analysis: AnalysisResult = state.result as AnalysisResult;
    const processed: Partial<PipelineState> = {
      analysisResult: analysis.analysisResult,
      needsClarification: analysis.needsClarification,
      result: null,
      status: "prd_analyzed",
    };
    return processed;
  }

  const initialMessage: string = `Analyze this PRD:\n\n${state.prd}`;
  const parseKey: ParseKey = "analysis";

  const setup: Partial<PipelineState> = {
    initialMessage,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "analyzing_prd",
  };
  return setup;
}

type AnalyzePrdGraphRoute = "invokeAnalyzePrd" | "__end__";

function routeInsideAnalyzePrdGraph(
  state: PipelineState,
): AnalyzePrdGraphRoute {
  let route: AnalyzePrdGraphRoute;
  if (state.status === "analyzing_prd") {
    route = "invokeAnalyzePrd";
  } else {
    route = "__end__";
  }
  return route;
}

export const analyzePrdGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("analyzePrd", analyzePrdNode)
  .addNode("invokeAnalyzePrd", invokeGraph)
  .addEdge("__start__", "analyzePrd")
  .addConditionalEdges("analyzePrd", routeInsideAnalyzePrdGraph, [
    "invokeAnalyzePrd",
    "__end__",
  ])
  .addEdge("invokeAnalyzePrd", "analyzePrd")
  .compile();
