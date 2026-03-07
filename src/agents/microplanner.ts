import { createDeepAgent, DeepAgent } from "deepagents";
import { providerStrategy } from "langchain";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyBackend } from "../backends/read-only-backend.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey, Assignment } from "../pipeline-state.js";
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";

export const microplanSchema = z.object({
  steps: z
    .array(
      z.object({
        description: z
          .string()
          .describe("What to do - specific enough to implement"),
        file: z.string().describe("Path to the file"),
        action: z
          .enum(["modify", "create", "delete"])
          .describe("Type of file operation"),
      }),
    )
    .describe("Ordered implementation steps"),
  considerations: z
    .array(z.string())
    .describe("Potential pitfalls and edge cases"),
  filesToRead: z
    .array(z.string())
    .describe("Files the implementer should read first"),
});

const PROMPT: string = `You are a microplanner. Take a single assignment and produce a concrete, step-by-step coding plan that an implementer agent can follow.

IMPORTANT: You are a PLANNING agent. Do NOT create or modify any files.

Instructions:
1. Read all relevant source files to understand existing code patterns, imports, types, and related functionality.
2. If this is a retry after failed verification, address ALL issues from the previous verification feedback.

Guidelines:
- Be SPECIFIC: name exact functions, classes, types, variables
- Be CONCRETE: describe actual changes, not abstract goals
- Do NOT include actual code -- describe what to write
- Follow existing code patterns
- Consider imports/exports that need updating
- Order steps logically`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(microplanSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: createMicroplanGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

function createMicroplanNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const microplanResult: Record<string, unknown> = state.result as Record<
      string,
      unknown
    >;
    const microplan: string = JSON.stringify(microplanResult);

    const update: Partial<PipelineState> = {
      microplan,
      result: null,
      status: "microplan_created",
    };
    return update;
  }

  const maybeAssignment: Assignment | undefined =
    state.assignments[state.currentAssignmentIndex];
  if (!maybeAssignment) {
    throw new Error(`No assignment at index ${state.currentAssignmentIndex}`);
  }
  const currentAssignment: Assignment = maybeAssignment;

  let message: string = `Create a microplan for this assignment:\n\n${JSON.stringify(currentAssignment, null, 2)}`;

  if (!state.verificationPassed && state.verificationFeedback !== "") {
    message += `\n\nPrevious verification failed with feedback:\n${state.verificationFeedback}\n\nAddress ALL issues in your microplan.`;
  }

  const parseKey: ParseKey = "microplan";

  const setup: Partial<PipelineState> = {
    initialMessage: message,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "creating_microplan",
  };
  return setup;
}

type CreateMicroplanGraphRoute = "invokeCreateMicroplan" | "__end__";

function routeInsideCreateMicroplanGraph(
  state: PipelineState,
): CreateMicroplanGraphRoute {
  let route: CreateMicroplanGraphRoute;
  if (state.status === "creating_microplan") {
    route = "invokeCreateMicroplan";
  } else {
    route = "__end__";
  }
  return route;
}

export const microplannerGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("createMicroplan", createMicroplanNode)
  .addNode("invokeCreateMicroplan", invokeGraph)
  .addEdge("__start__", "createMicroplan")
  .addConditionalEdges("createMicroplan", routeInsideCreateMicroplanGraph, [
    "invokeCreateMicroplan",
    "__end__",
  ])
  .addEdge("invokeCreateMicroplan", "createMicroplan")
  .compile();
