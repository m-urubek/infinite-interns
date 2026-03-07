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
    .describe("Whether business clarification is needed"),
  questions: z
    .array(
      z.object({
        question: z.string().describe("The business question to ask"),
        reason: z.string().describe("Why this is a business concern"),
      }),
    )
    .describe("List of business clarifying questions (max 5)"),
});

const PROMPT: string = `You are a business requirements analyst. Review a PRD and identify ONLY high-level business requirement gaps that need stakeholder input.

IMPORTANT: You are an ANALYSIS agent. Do NOT create or modify any files.

What to ask about (DO ask):
- Missing or ambiguous business rules
- Unclear user-facing behavior or UX expectations
- Undefined scope boundaries
- Conflicting business requirements
- Missing acceptance criteria for business outcomes

What NOT to ask about (NEVER ask):
- Technical implementation details
- Code structure, API design, database schema
- Error handling, retry logic, caching, performance optimization
- Testing strategies

Keep questions SHORT and conversational. At most 5 questions. If the PRD has clear business requirements, set needsClarification to false immediately.`;

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
// Subgraph: businessAnalyzeGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

type AnalysisResult = { needsClarification: boolean; analysisResult: string };

function businessAnalyzeNode(state: PipelineState): Partial<PipelineState> {
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

type BusinessAnalyzeGraphRoute = "invokeBusinessAnalyze" | "__end__";

function routeInsideBusinessAnalyzeGraph(
  state: PipelineState,
): BusinessAnalyzeGraphRoute {
  let route: BusinessAnalyzeGraphRoute;
  if (state.status === "analyzing_prd") {
    route = "invokeBusinessAnalyze";
  } else {
    route = "__end__";
  }
  return route;
}

export const businessAnalyzeGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("businessAnalyze", businessAnalyzeNode)
  .addNode("invokeBusinessAnalyze", invokeGraph)
  .addEdge("__start__", "businessAnalyze")
  .addConditionalEdges("businessAnalyze", routeInsideBusinessAnalyzeGraph, [
    "invokeBusinessAnalyze",
    "__end__",
  ])
  .addEdge("invokeBusinessAnalyze", "businessAnalyze")
  .compile();
