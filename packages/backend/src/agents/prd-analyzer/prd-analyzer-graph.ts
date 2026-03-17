import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyBackend from "../../backends/read-only-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import * as Util from "../../shared/util.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type PrdAnalyzerOutput, type PrdAnalyzerAgentResult } from "./prd-analyzer-types.js";
import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types.js";
import * as Zod from "zod";

export const prdAnalyzerAgentOutputSchema = Zod.z.object({
  needsClarification: Zod.z.boolean().describe("Whether the PRD needs clarification before proceeding."),
  questions: Zod.z
    .array(Zod.z.string().describe("A clarifying question to ask."))
    .describe("List of clarifying questions. Empty if needsClarification is false."),
  confidence: Zod.z
    .number()
    .min(1)
    .max(10)
    .describe("Confidence level (1-10) that the PRD is clear and complete enough to proceed."),
  reasoning: Zod.z.string().describe("Explanation of why clarification is or is not needed."),
});

const systemPrompt: NonNullable<string> = `You are a PRD Analyzer. Your role is to analyze a Product Requirements Document (PRD) and determine if it needs clarification before implementation can begin.

IMPORTANT: You are an ANALYSIS agent. Do NOT create or modify any files. Your job is to ANALYZE the PRD and the codebase using read_file, glob, and grep tools, then provide your assessment.

Instructions:
1. Read and understand the PRD thoroughly.
2. Use read_file, glob, and grep tools to explore the existing codebase and understand the project context.
3. If previous clarifications have been provided, incorporate them into your analysis.
4. Identify any ambiguities, missing requirements, contradictions, or gaps in the PRD.
5. If clarification is needed, output specific questions that would resolve the ambiguities.
6. If the PRD is clear and complete enough, set needsClarification to false.

Rules:
- Be pragmatic - only ask questions that truly matter for implementation
- Do not ask questions about things that can be reasonably inferred
- Focus on questions that would change the implementation approach
- If previous clarifications have already answered a question, do not ask it again
- Consider the existing codebase context when evaluating completeness`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the analyzer
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyBackend.ReadOnlyBackend,
  null,
  systemPrompt,
  prdAnalyzerAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup - prepares the input for the analyzer agent
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const prd: NonNullable<string> = state.prdGeneratorState.output.prd;
  const previousClarifications: ClarifyingQuestions | null | undefined = state.prdGeneratorState.output.clarifications;

  const message: NonNullable<string> = `Analyze the following PRD and determine if any clarifications are needed before implementation can begin. The PRD was generated from my assignment and my assignment together with the clarifications are the source of truth, the PRD mustn't deviate from them very much and definitely not contradict them. The PRD must provide complete solution to my assignment + clarifications.

<prd>
${prd}
</prd>

<my-assignment>
${state.assignment}
</my-assignment>

<previous-clarifications>
${Util.isNotNullOrEmpty(previousClarifications) ? JSON.stringify(previousClarifications, null, 2) : "No previous clarifications."}
</previous-clarifications>
`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.prdAnalyzer ?? null;
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
// Node: processAnalysis - extracts the analyzer output
// ---------------------------------------------------------------------------

function processAnalysis(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const agentResult: NonNullable<PrdAnalyzerAgentResult> = prdAnalyzerAgentOutputSchema.parse(invokeAgentOutput.result);

  const prd: NonNullable<string> = state.prdGeneratorState.output.prd;

  const output: NonNullable<PrdAnalyzerOutput> = {
    needsClarification: agentResult.needsClarification,
    questions: agentResult.questions,
    confidence: agentResult.confidence,
    reasoning: agentResult.reasoning,
    prd: prd,
    clarifications: state.prdGeneratorState.output.clarifications,
  };

  state.prdAnalyzerState.output = output;

  const update: NonNullable<Partial<MainPipelineState>> = {
    prdAnalyzerState: state.prdAnalyzerState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the prd-analyzer subgraph
//
// Flow: __start__ -> setup -> invokeAnalyzer -> processAnalysis -> __end__
//
// The subgraph only analyzes. The main pipeline reads the output
// and handles routing + human interrupt.
// ---------------------------------------------------------------------------

export const prdAnalyzerGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeAnalyzer", invokeGraph)
  .addNode("processAnalysis", processAnalysis)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeAnalyzer")
  .addEdge("invokeAnalyzer", "processAnalysis")
  .addEdge("processAnalysis", "__end__")
  .compile();
