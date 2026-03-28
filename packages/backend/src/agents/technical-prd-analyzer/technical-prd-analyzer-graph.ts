import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyBackend from "../../backends/read-only-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import {
  type TechnicalPrdAnalyzerOutput,
  type TechnicalPrdAnalyzerAgentResult,
} from "./technical-prd-analyzer-types.js";
import { type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types.js";
import * as Util from "../../shared/util.js";
import * as Zod from "zod";

export const technicalPrdAnalyzerAgentOutputSchema = Zod.z.object({
  needsClarification: Zod.z.boolean().describe("Whether the PRD needs technical clarification before proceeding."),
  questions: Zod.z
    .array(Zod.z.string().describe("A technical clarifying question to ask."))
    .describe("List of technical clarifying questions. Empty if needsClarification is false."),
  confidence: Zod.z
    .number()
    .min(1)
    .max(10)
    .describe("Confidence level (1-10) that the PRD is technically sound and complete enough to proceed."),
  reasoning: Zod.z.string().describe("Explanation of why technical clarification is or is not needed."),
});

const systemPrompt: NonNullable<string> = `You are a Technical PRD Analyzer. Your role is to analyze a Product Requirements Document (PRD) from a technical perspective and determine if technical clarifications are needed before implementation can begin.

IMPORTANT: You are an ANALYSIS agent. Do NOT create or modify any files. Your job is to ANALYZE the PRD and the codebase using read_file, glob, and grep tools, then provide your technical assessment.

Focus your analysis on:
1. Architecture and system design implications
2. Scalability concerns and performance requirements
3. Security considerations and potential vulnerabilities
4. Integration points with existing systems and APIs
5. Data modeling and storage requirements
6. Technical debt and compatibility with existing codebase patterns
7. Infrastructure requirements and deployment considerations

Instructions:
1. Read and understand the PRD thoroughly from a technical perspective.
2. Use read_file, glob, and grep tools to explore the existing codebase and understand the technical context.
3. If previous clarifications have been provided, incorporate them into your analysis.
4. Identify any technical ambiguities, missing architectural decisions, or gaps in the PRD.
5. If technical clarification is needed, output specific technical questions that would resolve the ambiguities.
6. If the PRD is technically sound and complete enough, set needsClarification to false.

Rules:
- Focus exclusively on TECHNICAL concerns — business requirements are handled separately
- Be pragmatic — only ask questions that would materially change the implementation approach
- Do not ask questions about things that can be reasonably inferred from the codebase
- If previous clarifications have already answered a question, do not ask it again
- Consider the existing codebase patterns, conventions, and architecture when evaluating completeness`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the technical analyzer
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyBackend.ReadOnlyBackend,
  null,
  systemPrompt,
  technicalPrdAnalyzerAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup - prepares the input for the technical analyzer agent
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  if (!Util.isNotNullOrUndf(state.analysisControllerState.output)) {
    throw new Error("Analysis controller output is null or undefined");
  }
  const prd: NonNullable<string> = state.analysisControllerState.output.prd;
  const previousClarifications: ClarifyingQuestions | null | undefined =
    state.analysisControllerState.output.clarifications;

  const message: NonNullable<string> = `Analyze the following PRD from a TECHNICAL perspective and determine if any technical clarifications are needed before implementation can begin. Focus on architecture, scalability, security, integration points, and performance.

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

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.technicalPrdAnalyzer ?? null;
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
// Node: processAnalysis - extracts the technical analyzer output
// ---------------------------------------------------------------------------

function processAnalysis(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const agentResult: NonNullable<TechnicalPrdAnalyzerAgentResult> = technicalPrdAnalyzerAgentOutputSchema.parse(
    invokeAgentOutput.result
  );

  if (!Util.isNotNullOrUndf(state.analysisControllerState.output)) {
    throw new Error("Analysis controller output is null or undefined");
  }
  const prd: NonNullable<string> = state.analysisControllerState.output.prd;

  const output: NonNullable<TechnicalPrdAnalyzerOutput> = {
    needsClarification: agentResult.needsClarification,
    questions: agentResult.questions,
    confidence: agentResult.confidence,
    reasoning: agentResult.reasoning,
    prd: prd,
    clarifications: state.analysisControllerState.output.clarifications,
  };

  state.technicalPrdAnalyzerState.output = output;

  const update: NonNullable<Partial<MainPipelineState>> = {
    technicalPrdAnalyzerState: state.technicalPrdAnalyzerState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the technical-prd-analyzer subgraph
//
// Flow: __start__ -> setup -> invokeAnalyzer -> processAnalysis -> __end__
// ---------------------------------------------------------------------------

export const technicalPrdAnalyzerGraph = new Langgraph.StateGraph({
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
