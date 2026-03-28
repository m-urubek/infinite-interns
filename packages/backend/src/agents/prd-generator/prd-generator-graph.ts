import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyBackend from "../../backends/read-only-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import * as Util from "../../shared/util.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
// eslint-disable-next-line local/enforce-namespace-imports
import { z } from "zod";

export const prdGeneratorAgentOutputSchema = z.object({
  precision: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Self-assessment: what percentage of the PRD content was EXPLICITLY stated or DIRECTLY implied by the user's assignment and clarification answers, versus decided by you to fill gaps? Filling gaps is expected and good — but be honest about how much you filled. If the user said 'todo app in React' and you decided on localStorage, styling approach, specific UX flows — those are your decisions, not the user's. A vague one-sentence assignment with no clarifications should score low (e.g. 10-30%) because most decisions were yours."
    ),

  prd: z.string().describe("The PRD"),
});

const systemPrompt: NonNullable<string> = `You are a Product Requirements Document (PRD) generator. Your role is to take a task description and produce a comprehensive, well-structured PRD.

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

// export function createPrdGeneratorAgent(projectDir: string): DeepAgent {
//   const agent: NonNullable<DeepAgent> = createDeepAgent({
//     model: geminiFlashLLMMedium,
//     backend: new ReadOnlyBackend({ rootDir: projectDir }),
//     systemPrompt: PROMPT,
//     responseFormat: providerStrategy(prdGeneratorAgentOutputSchema),
//   });
//   return agent;
// }

// ---------------------------------------------------------------------------
// Subgraph: prdGeneratorGraph
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyBackend.ReadOnlyBackend,
  null,
  systemPrompt,
  prdGeneratorAgentOutputSchema,
  3,
  3
);

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const clarifications = state.analysisControllerState.output?.clarifications;

  const message: NonNullable<string> = `Create a comprehensive PRD document based on my assignment and answered clarifying questions.
<assignment>
  ${state.assignment}
</assignment>
<clarifications>
${Util.isNotNullOrEmpty(clarifications) ? JSON.stringify(clarifications, null, 2) : "No clarifications provided, create the PRD based on the assignment only."}
</clarifications>
`;
  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.prdGenerator ?? null;
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

function process(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const prd: NonNullable<string> = prdGeneratorAgentOutputSchema.parse(invokeAgentOutput.result).prd;

  state.prdGeneratorState.output = {
    prd: prd,
    clarifications: state.analysisControllerState.output?.clarifications ?? null,
  };

  const update: NonNullable<Partial<MainPipelineState>> = {
    prdGeneratorState: state.prdGeneratorState,
  };
  return update;
}

export const prdGeneratorGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokePrdGenerator", invokeGraph)
  .addNode("process", process)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokePrdGenerator")
  .addEdge("invokePrdGenerator", "process")
  .addEdge("process", "__end__")
  .compile();
