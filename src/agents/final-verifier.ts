import { createDeepAgent, DeepAgent } from "deepagents";
import { providerStrategy } from "langchain";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyShellBackend } from "../backends/read-only-shell-backend.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type { PipelineState, ParseKey } from "../pipeline-state.js";
import { z } from "zod";

export const finalVerificationSchema = z.object({
  passed: z.boolean().describe("Whether final verification passed"),
  commitMessage: z
    .string()
    .describe("Conventional commit message, e.g. feat: add user auth"),
  feedback: z
    .string()
    .describe("Specific actionable feedback (empty string if passed)"),
  unmetRequirements: z
    .array(z.string())
    .describe("List of unmet requirements (empty if passed)"),
});

const PROMPT: string = `You are the final verification agent. Review ALL changes made during the pipeline against the PRD.

IMPORTANT: You are a VERIFICATION agent. Do NOT create or modify any files. Only read and execute commands.

Instructions:
1. Use execute to run "git diff" to see all changes.
2. Systematically verify each requirement in the PRD.
3. Run all build commands provided.
4. Assess overall code quality and architecture.

Verification Process:
- Go through each requirement in the PRD -- is it implemented correctly?
- Check each acceptance criterion
- Run build commands and verify no errors
- Review overall architecture for integration issues

If the diff is empty, that's a failure. Always provide a commitMessage.`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyShellBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(finalVerificationSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: finalVerifyGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

type VerifyResult = { passed: boolean; feedback: string };

function finalVerifyNode(state: PipelineState): Partial<PipelineState> {
  if (state.result !== null) {
    const verify: VerifyResult = state.result as VerifyResult;
    const pipelineRetries: number = state.pipelineRetries;

    const processed: Partial<PipelineState> = {
      finalVerificationPassed: verify.passed,
      verificationFeedback: verify.feedback,
      pipelineRetries: verify.passed ? pipelineRetries : pipelineRetries + 1,
      result: null,
      status: verify.passed ? "completed" : "final_verification_failed",
    };
    return processed;
  }

  let initialMessage: string = `Perform final verification against the PRD.

PRD:
${state.prd}`;

  if (state.buildCommands.length > 0) {
    initialMessage += `\n\nBuild commands to run:\n${state.buildCommands.join("\n")}`;
  }

  const parseKey: ParseKey = "finalVerify";

  const setup: Partial<PipelineState> = {
    initialMessage,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "final_verifying",
  };
  return setup;
}

type FinalVerifyGraphRoute = "invokeFinalVerify" | "__end__";

function routeInsideFinalVerifyGraph(
  state: PipelineState,
): FinalVerifyGraphRoute {
  let route: FinalVerifyGraphRoute;
  if (state.status === "final_verifying") {
    route = "invokeFinalVerify";
  } else {
    route = "__end__";
  }
  return route;
}

export const finalVerifyGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("finalVerify", finalVerifyNode)
  .addNode("invokeFinalVerify", invokeGraph)
  .addEdge("__start__", "finalVerify")
  .addConditionalEdges("finalVerify", routeInsideFinalVerifyGraph, [
    "invokeFinalVerify",
    "__end__",
  ])
  .addEdge("invokeFinalVerify", "finalVerify")
  .compile();
