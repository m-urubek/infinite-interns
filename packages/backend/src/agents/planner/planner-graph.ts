import * as Langgraph from "@langchain/langgraph";
import * as ReadOnlyShellBackend from "../../backends/read-only-shell-backend.js";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type PlannerOutput } from "./planner-types.js";
import { type AnalysisControllerOutput } from "../../nodes/analysis-controller/analysis-controller-types.js";
import * as Util from "../../shared/util.js";
import * as Zod from "zod";

export const plannerAgentOutputSchema = Zod.z.object({
  buildCommand: Zod.z
    .string()
    .describe(
      "The command to build/compile the project. Use the user-provided build command if available, otherwise determine the appropriate command by analyzing the codebase (e.g. 'npm run build', 'cargo build', 'make')"
    ),
  tasks: Zod.z
    .array(
      Zod.z.object({
        title: Zod.z.string().describe("Short imperative title, e.g. 'Add user authentication middleware'"),
        description: Zod.z.string().describe("Complete implementation brief for this task (see instructions)"),
        relevantFiles: Zod.z
          .array(Zod.z.string())
          .describe("File paths likely to be created or modified for this task"),
      })
    )
    .describe("Ordered list of sequential tasks that together implement the full PRD"),
});

const systemPrompt: NonNullable<string> = `You are an implementation planner. Given a PRD, divide the work into sequential tasks that can be implemented one at a time by an independent coding agent.

IMPORTANT: You are a PLANNING agent. Do NOT create or modify any files.

## Process

1. Use read_file, glob, grep, and execute to explore the codebase — understand the project structure, dependencies, build system, conventions, and existing patterns.
2. Read the PRD carefully. Identify all deliverables.
3. Determine the project's build command (or use the one provided by the user).
4. Produce an ordered list of tasks.

## Build command

If the user provides a build command, use it exactly. Otherwise, determine the correct build command by examining the project (package.json scripts, Makefile, Cargo.toml, etc.). The build command should compile/check the entire project — it will be run after each task to verify nothing is broken.

## What makes a good task

Each task will be handed to a coding agent that has never seen the other tasks. That agent will receive ONLY the task description and access to the codebase (which will already contain the work of previous tasks). So:

- The description must be **self-contained**: it should specify exactly what to create or change, where, and how — including file paths, function signatures, naming conventions, and any patterns to follow. The implementing agent can explore the codebase, but shouldn't have to reverse-engineer your intent.
- The task must leave the project in a **non-breaking state**: code compiles, tests pass, no dangling imports. Think of it as one clean commit.
- Target a scope that a coding agent can finish in a **single focused session** — roughly 5–15 files touched, one coherent concern. If a task only touches one file and adds a single type alias, it's too small — bundle it with related work. If it rewires half the app, it's too large — split it.
- Tasks are strictly sequential — each task may only depend on tasks that come before it.

## Task ordering

- Infrastructure and foundational pieces first (types, schemas, configs, utilities).
- Then core logic (models, services, business rules).
- Then integration and wiring (routes, controllers, UI hookup).
- Tests and documentation last, bundled with the code they cover when practical.

## Description format

Write each task description as a clear implementation brief. Include:
- What to build or change and why (in the context of the PRD).
- Specific files to create or modify, with expected contents or structure.
- Interfaces, types, or contracts the code must satisfy.
- How it connects to previous tasks (reference by title if needed).
- Any edge cases, validation rules, or constraints from the PRD.

Do NOT include test instructions, review checklists, or meta-commentary — just the implementation brief.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the planner
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  ReadOnlyShellBackend.ReadOnlyShellBackend,
  null,
  systemPrompt,
  plannerAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads the finalized PRD and constructs the user message
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const controllerOutput: NonNullable<AnalysisControllerOutput> =
    state.analysisControllerState.output ??
    (() => {
      throw new Error("Analysis controller output is null or undefined");
    })();
  const prd: NonNullable<string> = controllerOutput.prd;

  const clarificationsJson: NonNullable<string> = Util.isNotNullOrEmpty(controllerOutput.clarifications)
    ? JSON.stringify(controllerOutput.clarifications, null, 2)
    : "No clarifications were needed.";

  const buildCommandNote: NonNullable<string> = Util.isNotNullOrEmpty(state.buildCommand)
    ? `The user has provided a build command: \`${state.buildCommand}\`. Use this exact command.`
    : "No build command was provided. Determine the correct build command by analyzing the project.";

  const message: NonNullable<string> = `Read the following PRD and produce an implementation plan — an ordered list of tasks. Also determine (or confirm) the project's build command.

${buildCommandNote}

<assignment>
${state.assignment}
</assignment>

<clarifications>
${clarificationsJson}
</clarifications>

<prd>
${prd}
</prd>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.planner ?? null;
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
// Node: processPlanning — extracts the planner output
// ---------------------------------------------------------------------------

function processPlanning(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<PlannerOutput> = plannerAgentOutputSchema.parse(invokeAgentOutput.result);

  state.plannerState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    plannerState: state.plannerState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the planner subgraph
//
// Flow: __start__ -> setup -> invokePlanner -> processPlanning -> __end__
// ---------------------------------------------------------------------------

export const plannerGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokePlanner", invokeGraph)
  .addNode("processPlanning", processPlanning)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokePlanner")
  .addEdge("invokePlanner", "processPlanning")
  .addEdge("processPlanning", "__end__")
  .compile();
