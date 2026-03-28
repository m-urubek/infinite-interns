import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyShellBackend from "../../backends/read-only-shell-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState, type ClarifyingQuestion } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import * as Util from "../../shared/util.js";
import * as Zod from "zod";

export const technicalClarificationAnswererAgentOutputSchema = Zod.z.object({
  answers: Zod.z
    .array(Zod.z.string().describe("An answer to the corresponding technical clarifying question."))
    .describe("Answers to the technical clarifying questions, in the same order as the questions were provided."),
});

const systemPrompt: NonNullable<string> = `You are a Technical Clarification Answerer. Your role is to automatically answer technical clarifying questions about a Product Requirements Document (PRD) by analyzing the existing codebase and making informed technical decisions.

You have read-only filesystem access and can execute shell commands to explore the codebase.

Instructions:
1. Read each technical clarifying question carefully.
2. Use read_file, glob, grep, and execute tools to explore the codebase for relevant context.
3. Answer each question based on:
   - The existing codebase architecture, patterns, and conventions
   - Technical best practices for the technology stack in use
   - Scalability, security, and performance considerations
   - The most pragmatic technical approach given the project context
4. If a question cannot be confidently answered from the codebase, make a technically sound assumption and clearly state it.

Rules:
- Provide one answer per question, in the same order as the questions
- Be concise but specific — include file paths, function names, or patterns where relevant
- Base answers on evidence from the codebase when possible
- When making assumptions, choose approaches consistent with the existing architecture
- Focus on technical correctness and alignment with existing patterns`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the technical clarification answerer
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyShellBackend.ReadOnlyShellBackend,
  null,
  systemPrompt,
  technicalClarificationAnswererAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads questions from analysisControllerState
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const controllerOutput: typeof state.analysisControllerState.output = state.analysisControllerState.output;
  if (!Util.isNotNullOrUndf(controllerOutput)) {
    throw new Error("Analysis controller output is null or undefined");
  }

  const questions: NonNullable<Array<string>> = controllerOutput.questions;
  const prd: NonNullable<string> = controllerOutput.prd;

  const message: NonNullable<string> = `Answer the following technical clarifying questions about the PRD by analyzing the codebase and making informed technical decisions.

<prd>
${prd}
</prd>

<assignment>
${state.assignment}
</assignment>

<previous-clarifications>
${Util.isNotNullOrEmpty(controllerOutput.clarifications) ? JSON.stringify(controllerOutput.clarifications, null, 2) : "No previous clarifications."}
</previous-clarifications>

<questions>
${questions
  .map((q: NonNullable<string>, i: NonNullable<number>): NonNullable<string> => {
    const line: NonNullable<string> = `${(i + 1).toString()}. ${q}`;
    return line;
  })
  .join("\n")}
</questions>
`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.technicalClarificationAnswerer ?? null;
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
// Node: process — extracts answers and updates clarifications
// ---------------------------------------------------------------------------

function process(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  type AnswererResult = { answers: NonNullable<Array<string>> };
  const parsed: NonNullable<AnswererResult> = technicalClarificationAnswererAgentOutputSchema.parse(
    invokeAgentOutput.result
  );
  const answers: NonNullable<Array<string>> = parsed.answers;

  const controllerOutput: typeof state.analysisControllerState.output = state.analysisControllerState.output;
  if (!Util.isNotNullOrUndf(controllerOutput)) {
    throw new Error("Analysis controller output is null or undefined");
  }

  const questions: NonNullable<Array<string>> = controllerOutput.questions;

  // Build new clarifications from the auto-generated answers
  const newClarifications: NonNullable<Array<ClarifyingQuestion>> = questions.map(
    (question: NonNullable<string>, index: NonNullable<number>): NonNullable<ClarifyingQuestion> => {
      const clarification: NonNullable<ClarifyingQuestion> = {
        question: question,
        answer: answers[index] ?? null,
      };
      return clarification;
    }
  );

  // Merge with existing clarifications
  const existingClarifications: NonNullable<Array<ClarifyingQuestion>> = controllerOutput.clarifications ?? [];
  const allClarifications: NonNullable<Array<ClarifyingQuestion>> = [...existingClarifications, ...newClarifications];

  state.technicalClarificationAnswererState.output = {
    clarifications: allClarifications,
  };

  const update: NonNullable<Partial<MainPipelineState>> = {
    technicalClarificationAnswererState: state.technicalClarificationAnswererState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the technical-clarification-answerer subgraph
//
// Flow: __start__ -> setup -> invokeAnswerer -> process -> __end__
// ---------------------------------------------------------------------------

export const technicalClarificationAnswererGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeAnswerer", invokeGraph)
  .addNode("process", process)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeAnswerer")
  .addEdge("invokeAnswerer", "process")
  .addEdge("process", "__end__")
  .compile();
