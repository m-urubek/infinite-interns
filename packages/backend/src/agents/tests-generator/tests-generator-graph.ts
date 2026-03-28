import * as Langgraph from "@langchain/langgraph";
import * as Deepagents from "deepagents";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type TestsGeneratorOutput } from "./tests-generator-types.js";
import { type ControllerOutput } from "../../nodes/controller/controller-types.js";
import * as Zod from "zod";

export const testsGeneratorAgentOutputSchema = Zod.z.object({
  testsAdded: Zod.z.boolean().describe("Whether any tests were added or modified"),
  testFiles: Zod.z.array(Zod.z.string()).describe("List of test file paths that were created or modified"),
  summary: Zod.z.string().describe("Brief summary of what tests were added or why no tests were needed"),
});

const systemPrompt: NonNullable<string> = `You are a test generation agent with FULL filesystem access — you can read, write, edit files, and execute shell commands.

After a task has been implemented and verified, your job is to determine if the new code warrants unit tests or enhancement to existing tests. If so, implement them.

Approach:
1. Read the implemented code and understand what was changed or added.
2. Check existing test files to understand the project's testing patterns and conventions.
3. Determine if tests are needed:
   - New functionality usually needs tests.
   - Bug fixes benefit from regression tests.
   - Simple config changes or documentation may not need tests.
4. If tests are warranted, write them following existing test patterns.
5. Run the tests to verify they pass.

Rules:
- Follow the project's existing testing conventions and patterns.
- Do NOT modify production code — only add or modify test files.
- If the codebase uses specific testing frameworks or helpers, reuse them.
- Write focused tests that verify behavior, not implementation details.
- If no tests are needed, set testsAdded to false and explain why in the summary.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the tests generator
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  Deepagents.LocalShellBackend,
  null,
  systemPrompt,
  testsGeneratorAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads controller output and constructs the user message
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const controllerOutput: NonNullable<ControllerOutput> =
    state.controllerState.output ??
    (() => {
      throw new Error("Controller output is null or undefined");
    })();

  const message: NonNullable<string> = `A task has been implemented and verified. Determine if tests are needed and, if so, add them.

<build-command>
${controllerOutput.buildCommand}
</build-command>

<task>
${controllerOutput.currentTask.description}
</task>

<relevant-files>
${controllerOutput.currentTask.relevantFiles.join("\n")}
</relevant-files>

<prd>
${controllerOutput.prd}
</prd>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.testsGenerator ?? null;
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
// Node: processTestsGeneration — extracts the tests generator output
// ---------------------------------------------------------------------------

function processTestsGeneration(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<TestsGeneratorOutput> = testsGeneratorAgentOutputSchema.parse(invokeAgentOutput.result);

  state.testsGeneratorState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    testsGeneratorState: state.testsGeneratorState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the tests generator subgraph
//
// Flow: __start__ -> setup -> invokeTestsGenerator -> processTestsGeneration -> __end__
// ---------------------------------------------------------------------------

export const testsGeneratorGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeTestsGenerator", invokeGraph)
  .addNode("processTestsGeneration", processTestsGeneration)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeTestsGenerator")
  .addEdge("invokeTestsGenerator", "processTestsGeneration")
  .addEdge("processTestsGeneration", "__end__")
  .compile();
