import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyShellBackend from "../../backends/read-only-shell-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type VerifierOutput } from "./verifier-types.js";
import { type ControllerOutput } from "../../nodes/controller/controller-types.js";
import * as Zod from "zod";

export const verifierAgentOutputSchema = Zod.z.object({
  success: Zod.z.boolean().describe("Whether the implementation satisfies the task requirements"),
  failureDescription: Zod.z
    .string()
    .optional()
    .describe(
      "If success is false, describe what is wrong and what needs to be fixed. Be specific about file paths, expected behavior, and actual behavior. Omit this field if success is true."
    ),
});

const systemPrompt: NonNullable<string> = `You are a verification agent. You have read-only filesystem access and can execute shell commands (but cannot write files).

Your job is to verify that a specific implementation task was completed correctly.

Verification approach:
1. Read the modified and created files to verify the changes match the task requirements.
2. Check that the implementation follows the project's conventions and patterns.
3. Optionally run tests or other verification commands to validate behavior.
4. Verify there are no obvious bugs, missing edge cases, or incomplete implementations.

Rules:
- Be pragmatic — verify the substance of the implementation, not cosmetic details.
- Focus on whether the task requirements are met, not on style preferences.
- If the implementation is functionally correct but could be improved, mark it as success.
- Only mark as failure if there are genuine functional issues or missing requirements.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the verifier
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyShellBackend.ReadOnlyShellBackend,
  null,
  systemPrompt,
  verifierAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads controller output and constructs the verification prompt
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const controllerOutput: NonNullable<ControllerOutput> =
    state.controllerState.output ??
    (() => {
      throw new Error("Controller output is null or undefined");
    })();

  const message: NonNullable<string> = `Verify that the following task has been correctly implemented in the codebase. Read the relevant files, check the implementation, and optionally run verification commands.

<task>
${controllerOutput.currentTask.description}
</task>

<relevant-files>
${controllerOutput.currentTask.relevantFiles.join("\n")}
</relevant-files>

<prd>
${controllerOutput.prd}
</prd>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.verifier ?? null;
  state.invokeAgentState.input = {
    conversationHistory: null,
    userMessage: message,
    modelConfig: agentConfig?.modelConfig ?? null,
    retryConfig: agentConfig?.retryConfig ?? null,
  };
  const update: NonNullable<Partial<MainPipelineState>> = { invokeAgentState: state.invokeAgentState };
  return update;
}

// ---------------------------------------------------------------------------
// Node: processVerification — extracts the verifier output
// ---------------------------------------------------------------------------

function processVerification(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<VerifierOutput> = verifierAgentOutputSchema.parse(invokeAgentOutput.result);

  state.verifierState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    verifierState: state.verifierState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the verifier subgraph
//
// Flow: __start__ -> setup -> invokeVerifier -> processVerification -> __end__
// ---------------------------------------------------------------------------

export const verifierGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeVerifier", invokeGraph)
  .addNode("processVerification", processVerification)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeVerifier")
  .addEdge("invokeVerifier", "processVerification")
  .addEdge("processVerification", "__end__")
  .compile();
