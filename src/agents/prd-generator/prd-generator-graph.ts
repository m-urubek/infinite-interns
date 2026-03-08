import * as Langgraph from "@langchain/langgraph";
import * as GeminiFlashModel from "../../shared/gemini-flash-model.js";
import * as ReadOnlyBackend from "../../backends/read-only-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import * as SharedUtility from "../../shared/shared-utility.js";
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
      "In %, how much of the PRD content is directly specified or directly implied by the assignment or the answers to the clarifying questions. In other words, how much of the PRD content is not guessed or is not filled gaps."
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
  ReadOnlyBackend.ReadOnlyBackend, //backendClass: NonNullable<new (...args: NonNullable<Array<unknown>>) => NonNullable<BackendProtocol>>,
  GeminiFlashModel.geminiFlashLLMMedium, //model: NonNullable<ChatGoogleGenerativeAI>,
  systemPrompt, // systemPrompt: NonNullable<string>,
  prdGeneratorAgentOutputSchema, // responseZod: NonNullable<ZodObject<ZodRawShape>>,
  3, // maxInSessionAttempts: NonNullable<number>,
  3 // maxSessionAttempts: NonNullable<number>
);

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const message: NonNullable<string> = `Create a comprehensive PRD document based on my assignment and answered clarifying questions.
<assignment>
  ${state.assignment}
</assignment>
<clarifications>
${SharedUtility.isNotNullOrEmpty(state.prdGeneratorState.input.clarifications) ? JSON.stringify(state.prdGeneratorState.input.clarifications, null, 2) : "No clarifications provided, create the PRD based on the assignment only."}
</clarifications>
`;
  state.invokeAgentState.input = {
    conversationHistory: null,
    userMessage: message,
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
  state.prdGeneratorState.output = {
    prd: prdGeneratorAgentOutputSchema.parse(invokeAgentOutput.result).prd,
    clarifications: state.prdGeneratorState.output.clarifications,
  };
  const update: NonNullable<Partial<MainPipelineState>> = { prdGeneratorState: state.prdGeneratorState };
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
