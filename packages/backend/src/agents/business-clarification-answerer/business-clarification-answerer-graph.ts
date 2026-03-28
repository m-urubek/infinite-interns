import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyShellBackend from "../../backends/read-only-shell-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState, type ClarifyingQuestion } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import * as Util from "../../shared/util.js";
import * as Zod from "zod";

export const businessClarificationAnswererAgentOutputSchema = Zod.z.object({
  answers: Zod.z
    .array(Zod.z.string().describe("An answer to the corresponding clarifying question."))
    .describe("Answers to the clarifying questions, in the same order as the questions were provided."),
});

const systemPrompt: NonNullable<string> = `You are a Business Clarification Answerer. Your role is to automatically answer business-related clarifying questions about a Product Requirements Document (PRD) by analyzing the existing codebase and making reasonable business assumptions.

You have read-only filesystem access and can execute shell commands to explore the codebase.

Instructions:
1. Read each clarifying question carefully.
2. Use read_file, glob, grep, and execute tools to explore the codebase for relevant context.
3. Answer each question based on:
   - Patterns and conventions found in the existing codebase
   - Industry best practices
   - The most pragmatic approach given the project context
4. If a question cannot be confidently answered from the codebase, make a reasonable assumption and clearly state it in your answer.

Rules:
- Provide one answer per question, in the same order as the questions
- Be concise but specific — avoid vague answers
- Base answers on evidence from the codebase when possible
- When making assumptions, choose the simplest approach that satisfies the requirement`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the business clarification answerer
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyShellBackend.ReadOnlyShellBackend,
  null,
  systemPrompt,
  businessClarificationAnswererAgentOutputSchema,
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

  const message: NonNullable<string> = `Answer the following business clarifying questions about the PRD by analyzing the codebase and making reasonable assumptions.

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

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.businessClarificationAnswerer ?? null;
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
  const parsed: NonNullable<AnswererResult> = businessClarificationAnswererAgentOutputSchema.parse(
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

  state.businessClarificationAnswererState.output = {
    clarifications: allClarifications,
  };

  const update: NonNullable<Partial<MainPipelineState>> = {
    businessClarificationAnswererState: state.businessClarificationAnswererState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the business-clarification-answerer subgraph
//
// Flow: __start__ -> setup -> invokeAnswerer -> process -> __end__
// ---------------------------------------------------------------------------

export const businessClarificationAnswererGraph = new Langgraph.StateGraph({
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
