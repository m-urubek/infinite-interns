import { createDeepAgent, DeepAgent } from "deepagents";
import { providerStrategy } from "langchain";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyBackend } from "../backends/read-only-backend.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey, Assignment } from "../pipeline-state.js";
import { z } from "zod";

export const planSchema = z.object({
  assignments: z
    .array(
      z.object({
        id: z.string().describe("Kebab-case identifier"),
        title: z.string().describe("Human-readable title"),
        description: z
          .string()
          .describe("Detailed description of what to implement"),
        dependsOn: z
          .array(z.string())
          .describe("IDs of assignments this depends on"),
        estimatedFiles: z
          .array(z.string())
          .describe("Files expected to be created/modified"),
      }),
    )
    .describe("Ordered list of implementation assignments"),
});

const PROMPT: string = `You are an implementation planner. Read a PRD and divide the work into sequential assignments that can be implemented one at a time.

IMPORTANT: You are a PLANNING agent. Do NOT create or modify any files.

Instructions:
1. Use tools to explore the codebase structure, dependencies, build system, and existing patterns.
2. Divide the work into ordered assignments.

Assignment Design Principles:
- Self-contained: each assignment produces a non-breaking state
- Sequential: later assignments build on earlier ones
- Right-sized: roughly one commit's worth of work
- No circular dependencies
- Clear boundaries

Rules:
- First assignment must have no dependencies
- Consider natural implementation order (infrastructure before features, models before controllers)
- Each description must be detailed enough for an independent agent to implement`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(planSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: createPlanGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

function createPlanNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const assignments: Array<Assignment> = state.result as Array<Assignment>;
    const processed: Partial<PipelineState> = {
      assignments,
      currentAssignmentIndex: 0,
      implementationAttempt: 0,
      result: null,
      status: "plan_created",
    };
    return processed;
  }

  const initialMessage: string = `Create an implementation plan for this PRD:\n\n${state.prd}`;
  const parseKey: ParseKey = "plan";

  const setup: Partial<PipelineState> = {
    initialMessage,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "creating_plan",
  };
  return setup;
}

type CreatePlanGraphRoute = "invokeCreatePlan" | "__end__";

function routeInsideCreatePlanGraph(
  state: PipelineState,
): CreatePlanGraphRoute {
  let route: CreatePlanGraphRoute;
  if (state.status === "creating_plan") {
    route = "invokeCreatePlan";
  } else {
    route = "__end__";
  }
  return route;
}

export const createPlanGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("createPlan", createPlanNode)
  .addNode("invokeCreatePlan", invokeGraph)
  .addEdge("__start__", "createPlan")
  .addConditionalEdges("createPlan", routeInsideCreatePlanGraph, [
    "invokeCreatePlan",
    "__end__",
  ])
  .addEdge("invokeCreatePlan", "createPlan")
  .compile();
