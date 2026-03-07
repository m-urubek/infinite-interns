import { createDeepAgent, DeepAgent } from "deepagents";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyBackend } from "../backends/read-only-backend.js";
import { z } from "zod";
import { providerStrategy } from "langchain";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey } from "../pipeline-state.js";

export const generatorSchema = z.object({
  precision: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "In %, how much of the PRD content is directly specified or directly implied by the assignment or the answers to the clarifying questions. In other words, how much of the PRD content is not guessed or is not filled gaps.",
    ),
  reasoning: z.string().describe("The PRD"),
});

const PROMPT: string = `You are a Product Requirements Document (PRD) generator. Your role is to take a task description and produce a comprehensive, well-structured PRD.

IMPORTANT: You are a PLANNING agent. Do NOT create or modify any files. Your job is to ANALYZE the codebase using read_file, glob, and grep tools, then GENERATE a PRD document as your final text response.

Instructions:
1. Use read_file and glob tools to explore the existing codebase structure and understand the project context.
2. If clarifications have been provided in the conversation, incorporate them into the PRD.

Write the PRD with these sections:
- Overview: Clear summary of what needs to be built and why.
- Requirements: Detailed functional and non-functional requirements. Each must be specific, measurable, testable.
- Acceptance Criteria: Concrete verifiable criteria. Use Given/When/Then where appropriate.
- Constraints: Technical constraints, compatibility, performance targets.
- Out of Scope: What is NOT included.

Rules:
- Write clear, unambiguous requirements
- Each requirement should be independently testable
- Do NOT invent requirements beyond what the task describes
- If the task is ambiguous, document assumptions in Constraints
- Return the full PRD as your FINAL MESSAGE (do not write it to a file)`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(generatorSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: prdGeneratorGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

function prdGeneratorNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const generatorResult: Record<string, unknown> = state.result as Record<
      string,
      unknown
    >;
    const prd: string =
      typeof generatorResult["reasoning"] === "string"
        ? generatorResult["reasoning"]
        : JSON.stringify(generatorResult);

    const update: Partial<PipelineState> = {
      prd,
      analysisResult: "",
      needsClarification: false,
      assignments: [],
      result: null,
      status: "prd_generated",
    };
    return update;
  }

  let message: string = `Task: ${state.task}`;

  if (state.clarifications.length > 0) {
    message += `\n\nPrevious clarifications:\n${JSON.stringify(state.clarifications, null, 2)}`;
  }

  const parseKey: ParseKey = "prd";

  const setup: Partial<PipelineState> = {
    initialMessage: message,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "generating_prd",
  };
  return setup;
}

type PrdGeneratorGraphRoute = "invokePrdGenerator" | "__end__";

function routeInsidePrdGeneratorGraph(
  state: PipelineState,
): PrdGeneratorGraphRoute {
  let route: PrdGeneratorGraphRoute;
  if (state.status === "generating_prd") {
    route = "invokePrdGenerator";
  } else {
    route = "__end__";
  }
  return route;
}

export const prdGeneratorGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("prdGenerator", prdGeneratorNode)
  .addNode("invokePrdGenerator", invokeGraph)
  .addEdge("__start__", "prdGenerator")
  .addConditionalEdges("prdGenerator", routeInsidePrdGeneratorGraph, [
    "invokePrdGenerator",
    "__end__",
  ])
  .addEdge("invokePrdGenerator", "prdGenerator")
  .compile();
