import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyShellBackend from "../../backends/read-only-shell-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type MicroplannerOutput } from "./microplanner-types.js";
import { type ControllerOutput } from "../../nodes/controller/controller-types.js";
import * as Zod from "zod";

export const microplannerAgentOutputSchema = Zod.z.object({
  microPlan: Zod.z.string().describe("A focused, step-by-step micro-plan for implementing the current task"),
  existingPatternsToReuse: Zod.z
    .array(Zod.z.string())
    .describe(
      "Existing patterns, utilities, abstractions, and conventions found in the codebase that should be reused"
    ),
  filesToReference: Zod.z
    .array(Zod.z.string())
    .describe("File paths the implementer should read to understand existing patterns before making changes"),
});

const systemPrompt: NonNullable<string> = `You are a micro-planning agent with read-only filesystem access and shell execution capability. You can read files, search the codebase, and run commands — but you cannot write or edit files.

Your job is to analyze the codebase and create a focused micro-plan for a single implementation task. The implementer agent will follow your plan to make the actual code changes.

Approach:
1. Read the relevant files listed in the task description to understand the current code structure.
2. Search the codebase for existing patterns, utilities, abstractions, and conventions that should be reused.
3. Identify files the implementer should read before making changes.
4. Create a step-by-step micro-plan that:
   - Specifies exactly which files to create or modify.
   - References existing patterns to follow (e.g., "follow the pattern in src/models/user.ts").
   - Lists existing utilities or helpers to reuse instead of reinventing.
   - Warns about potential pitfalls or integration points.
   - Keeps the scope tight — only what's needed for this single task.

Rules:
- Do NOT suggest changes outside the scope of the current task.
- Always prefer reusing existing abstractions over creating new ones.
- Be specific about file paths and function names.
- Your plan should be actionable — the implementer should be able to follow it step by step.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the microplanner
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyShellBackend.ReadOnlyShellBackend,
  null,
  systemPrompt,
  microplannerAgentOutputSchema,
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

  const message: NonNullable<string> = `Analyze the codebase and create a micro-plan for the following implementation task. Find existing patterns, utilities, and conventions that the implementer should reuse.

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
</prd>

<other-tasks-summary>
The following is the full plan. You are micro-planning for task #${(controllerOutput.currentTaskIndex + 1).toString()}. Do NOT plan for the other tasks.

${controllerOutput.allTasksSummary}
</other-tasks-summary>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.microplanner ?? null;
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
// Node: processMicroplanning — extracts the microplanner output
// ---------------------------------------------------------------------------

function processMicroplanning(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<MicroplannerOutput> = microplannerAgentOutputSchema.parse(invokeAgentOutput.result);

  state.microplannerState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    microplannerState: state.microplannerState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the microplanner subgraph
//
// Flow: __start__ -> setup -> invokeMicroplanner -> processMicroplanning -> __end__
// ---------------------------------------------------------------------------

export const microplannerGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeMicroplanner", invokeGraph)
  .addNode("processMicroplanning", processMicroplanning)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeMicroplanner")
  .addEdge("invokeMicroplanner", "processMicroplanning")
  .addEdge("processMicroplanning", "__end__")
  .compile();
