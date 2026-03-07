import { createDeepAgent, DeepAgent, LocalShellBackend } from "deepagents";
import { providerStrategy } from "langchain";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey, Assignment } from "../pipeline-state.js";
import { z } from "zod";

export const implementationSchema = z.object({
  filesModified: z.array(z.string()).describe("List of files that were edited"),
  filesCreated: z.array(z.string()).describe("List of new files created"),
  summary: z.string().describe("Brief summary of what was implemented"),
  deviations: z
    .array(
      z.object({
        step: z.string().describe("Which microplan step was deviated from"),
        reason: z.string().describe("Why the deviation was necessary"),
      }),
    )
    .describe("Any deviations from the microplan"),
});

const PROMPT: string = `You are an implementer agent. Write code following a microplan to complete a single assignment.

You have FULL ACCESS to the filesystem. Use write_file, edit_file, and execute tools to implement the code.

Instructions:
1. Read files listed in the microplan's filesToRead array using read_file.
2. Follow the microplan step by step, implementing each change.
3. Use write_file to create new files or edit_file to modify existing files.
4. Use execute to run build/compile commands if available.

Implementation Guidelines:
- Follow the microplan step order
- Write clean, well-structured, readable code
- Follow existing project conventions
- Use proper TypeScript types (no any)
- Handle errors appropriately
- Update imports when modifying exports`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new LocalShellBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(implementationSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: implementGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

function implementNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const implementationResult: string = JSON.stringify(state.result);

    const implementationAttempt: number = state.implementationAttempt + 1;

    const update: Partial<PipelineState> = {
      implementationResult,
      implementationAttempt,
      result: null,
      status: "implemented",
    };
    return update;
  }

  const maybeAssignment: Assignment | undefined =
    state.assignments[state.currentAssignmentIndex];
  if (!maybeAssignment) {
    throw new Error(`No assignment at index ${state.currentAssignmentIndex}`);
  }
  const currentAssignment: Assignment = maybeAssignment;

  const message: string = `Implement this assignment following the microplan.

Assignment:
${JSON.stringify(currentAssignment, null, 2)}

Microplan:
${state.microplan}

PRD Context:
${state.prd}`;

  const parseKey: ParseKey = "implementation" as ParseKey;

  const setup: Partial<PipelineState> = {
    initialMessage: message,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 1,
    result: null,
    status: "implementing",
  };
  return setup;
}

type ImplementGraphRoute = "invokeImplement" | "__end__";

function routeInsideImplementGraph(state: PipelineState): ImplementGraphRoute {
  let route: ImplementGraphRoute;
  if (state.status === "implementing") {
    route = "invokeImplement";
  } else {
    route = "__end__";
  }
  return route;
}

export const implementGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("implement", implementNode)
  .addNode("invokeImplement", invokeGraph)
  .addEdge("__start__", "implement")
  .addConditionalEdges("implement", routeInsideImplementGraph, [
    "invokeImplement",
    "__end__",
  ])
  .addEdge("invokeImplement", "implement")
  .compile();
