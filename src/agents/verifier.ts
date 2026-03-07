import { createDeepAgent, DeepAgent } from "deepagents";
import { providerStrategy } from "langchain";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyShellBackend } from "../backends/read-only-shell-backend.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey, Assignment } from "../pipeline-state.js";
import { z } from "zod";

export const verificationSchema = z.object({
  passed: z.boolean().describe("Whether verification passed"),
  issues: z
    .array(
      z.object({
        severity: z.enum(["error", "warning"]).describe("Issue severity"),
        file: z.string().describe("File path where issue was found"),
        description: z.string().describe("Description of the issue"),
      }),
    )
    .describe("List of issues found"),
  buildPassed: z.boolean().describe("Whether build commands passed"),
  buildOutput: z.string().describe("Captured build output (truncated if long)"),
});

const PROMPT: string = `You are a verification agent. Review code changes from an implementer and verify they meet the assignment requirements.

IMPORTANT: You are a VERIFICATION agent. Do NOT create or modify any files. Only read and execute build commands.

Instructions:
1. Read each changed file and review the implementation.
2. Run build commands if provided using execute.
3. Check code quality and requirements compliance.

Verification Checklist:
- Does the code follow project conventions?
- Are there obvious bugs or logic errors?
- Are edge cases handled?
- Are types used correctly?
- Does the implementation match the assignment description?
- Are all specified features implemented?
- Do build commands pass?

Set passed to true ONLY if there are NO error-severity issues AND builds pass.`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyShellBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(verificationSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: verifyGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

type VerifyResult = { passed: boolean; feedback: string };

function verifyNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const verify: VerifyResult = state.result as VerifyResult;

    let nextIndex: number = state.currentAssignmentIndex;
    let nextAttempt: number = state.implementationAttempt;

    if (verify.passed) {
      nextIndex = state.currentAssignmentIndex + 1;
      nextAttempt = 0;
    }

    const processed: Partial<PipelineState> = {
      verificationPassed: verify.passed,
      verificationFeedback: verify.feedback,
      currentAssignmentIndex: nextIndex,
      implementationAttempt: nextAttempt,
      result: null,
      status: "verified",
    };
    return processed;
  }

  const maybeAssignment: Assignment | undefined =
    state.assignments[state.currentAssignmentIndex];
  if (!maybeAssignment) {
    throw new Error(`No assignment at index ${state.currentAssignmentIndex}`);
  }
  const currentAssignment: Assignment = maybeAssignment;

  let initialMessage: string = `Verify this implementation.

Assignment:
${JSON.stringify(currentAssignment, null, 2)}

Implementation Result:
${state.implementationResult}`;

  if (state.buildCommands.length > 0) {
    initialMessage += `\n\nBuild commands to run:\n${state.buildCommands.join("\n")}`;
  }

  const parseKey: ParseKey = "verify";

  const setup: Partial<PipelineState> = {
    initialMessage,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "verifying",
  };
  return setup;
}

type VerifyGraphRoute = "invokeVerify" | "__end__";

function routeInsideVerifyGraph(state: PipelineState): VerifyGraphRoute {
  let route: VerifyGraphRoute;
  if (state.status === "verifying") {
    route = "invokeVerify";
  } else {
    route = "__end__";
  }
  return route;
}

export const verifierGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("verify", verifyNode)
  .addNode("invokeVerify", invokeGraph)
  .addEdge("__start__", "verify")
  .addConditionalEdges("verify", routeInsideVerifyGraph, [
    "invokeVerify",
    "__end__",
  ])
  .addEdge("invokeVerify", "verify")
  .compile();
