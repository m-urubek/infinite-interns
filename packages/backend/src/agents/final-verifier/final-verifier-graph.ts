import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyShellBackend from "../../backends/read-only-shell-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type FinalVerifierOutput } from "./final-verifier-types.js";
import * as Util from "../../shared/util.js";
import * as Zod from "zod";

export const finalVerifierAgentOutputSchema = Zod.z.object({
  success: Zod.z
    .boolean()
    .describe("Whether the full implementation satisfies the PRD, assignment, and clarifications"),
  problems: Zod.z
    .array(Zod.z.string())
    .describe("List of remaining problems or unmet requirements. Empty array if success is true."),
  suggestedFollowUpPrompt: Zod.z
    .string()
    .optional()
    .describe(
      "If success is false, a suggested prompt the user could use to start a new orchestration run to address the remaining issues. Omit this field if success is true."
    ),
});

const systemPrompt: NonNullable<string> = `You are a final verification agent. You have read-only filesystem access and can execute shell commands (but cannot write files).

Your job is to holistically verify that the entire implementation — across all completed tasks — satisfies the full functionality requested by the combination of PRD, original assignment, and clarifications.

Verification approach:
1. Read relevant files to verify all requirements from the PRD are met.
2. Run tests and verification commands to validate behavior.
3. Check for integration issues between components implemented by different tasks.
4. Verify non-functional requirements (if specified in the PRD).
5. Ensure the build succeeds and the project is in a clean state.

Rules:
- This is a holistic check — look at the big picture, not individual task completeness.
- If verification fails, provide a clear, actionable list of remaining problems.
- Also provide a suggested prompt the user could use to start a new orchestration run to fix the issues.
- Do NOT attempt to fix anything — just report what's wrong.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the final verifier
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyShellBackend.ReadOnlyShellBackend,
  null,
  systemPrompt,
  finalVerifierAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads the PRD, assignment, and clarifications
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  if (!Util.isNotNullOrUndf(state.analysisControllerState.output)) {
    throw new Error("Analysis controller output is null or undefined");
  }
  const prd: NonNullable<string> = state.analysisControllerState.output.prd;

  const clarificationsJson: NonNullable<string> = Util.isNotNullOrEmpty(
    state.analysisControllerState.output.clarifications
  )
    ? JSON.stringify(state.analysisControllerState.output.clarifications, null, 2)
    : "No clarifications were needed.";

  const message: NonNullable<string> = `All implementation tasks have been completed. Perform a final holistic verification that the codebase now satisfies the full requirements.

<assignment>
${state.assignment}
</assignment>

<clarifications>
${clarificationsJson}
</clarifications>

<prd>
${prd}
</prd>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.finalVerifier ?? null;
  state.invokeAgentState.input = {
    conversationHistory: null,
    userMessage: message,
    modelConfig: agentConfig?.modelConfig ?? null,
    retryConfig: agentConfig?.retryConfig ?? null,
    customRules: agentConfig?.customRules ?? null,
  };
  const update: NonNullable<Partial<MainPipelineState>> = { invokeAgentState: state.invokeAgentState };
  return update;
}

// ---------------------------------------------------------------------------
// Node: processFinalVerification — extracts the final verifier output
// ---------------------------------------------------------------------------

function processFinalVerification(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<FinalVerifierOutput> = finalVerifierAgentOutputSchema.parse(invokeAgentOutput.result);

  state.finalVerifierState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    finalVerifierState: state.finalVerifierState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the final verifier subgraph
//
// Flow: __start__ -> setup -> invokeFinalVerifier -> processFinalVerification -> __end__
// ---------------------------------------------------------------------------

export const finalVerifierGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeFinalVerifier", invokeGraph)
  .addNode("processFinalVerification", processFinalVerification)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeFinalVerifier")
  .addEdge("invokeFinalVerifier", "processFinalVerification")
  .addEdge("processFinalVerification", "__end__")
  .compile();
