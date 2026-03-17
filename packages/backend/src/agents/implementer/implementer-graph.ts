import * as Langgraph from "@langchain/langgraph";
import * as Deepagents from "deepagents";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type ImplementerOutput } from "./implementer-types.js";
import { type ControllerOutput } from "../../nodes/controller/controller-types.js";
import * as Zod from "zod";

export const implementerAgentOutputSchema = Zod.z.object({
  summary: Zod.z.string().describe("Brief summary of the changes made during this implementation"),
});

const systemPrompt: NonNullable<string> = `You are a code implementation agent with FULL filesystem access — you can read, write, edit files, and execute shell commands.

When implementing changes:
- Make focused, clean changes within the scope of your task.
- Follow existing code conventions and patterns in the project.
- You have a build command available — run it after making changes to verify your work compiles correctly. The build command is provided in the task description.
- If the build fails, fix the issues until it passes.
- Do NOT modify code outside the scope of your task unless strictly necessary for integration.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the implementer
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  Deepagents.LocalShellBackend,
  null,
  systemPrompt,
  implementerAgentOutputSchema,
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

  let message: NonNullable<string>;

  if (controllerOutput.isCorrection) {
    message = `A previous implementation attempt had issues. Fix the specific problem described below. Focus ONLY on the fix — do not refactor or change anything beyond what's needed to resolve the error.

After making fixes, run the build command to verify everything works.

<build-command>
${controllerOutput.buildCommand}
</build-command>

<task>
${controllerOutput.currentTask.description}
</task>

<relevant-files>
${controllerOutput.currentTask.relevantFiles.join("\n")}
</relevant-files>

<error>
${controllerOutput.correctionError ?? "Unknown error"}
</error>`;
  } else {
    message = `Implement the following task. After making your changes, run the build command to verify everything compiles.

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
The following is the full plan. You are implementing task #${(controllerOutput.currentTaskIndex + 1).toString()}. Do NOT implement the other tasks — they will be handled by separate agents.

${controllerOutput.allTasksSummary}
</other-tasks-summary>`;
  }

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.implementer ?? null;
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
// Node: processImplementation — extracts the implementer output
// ---------------------------------------------------------------------------

function processImplementation(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<ImplementerOutput> = implementerAgentOutputSchema.parse(invokeAgentOutput.result);

  state.implementerState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    implementerState: state.implementerState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the implementer subgraph
//
// Flow: __start__ -> setup -> invokeImplementer -> processImplementation -> __end__
// ---------------------------------------------------------------------------

export const implementerGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeImplementer", invokeGraph)
  .addNode("processImplementation", processImplementation)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeImplementer")
  .addEdge("invokeImplementer", "processImplementation")
  .addEdge("processImplementation", "__end__")
  .compile();
