import * as Langgraph from "@langchain/langgraph";
import * as Deepagents from "deepagents";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig, type DocumentationConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type MicroDocumenterOutput } from "./micro-documenter-types.js";
import { type ControllerOutput } from "../../nodes/controller/controller-types.js";
import * as Zod from "zod";

export const microDocumenterAgentOutputSchema = Zod.z.object({
  filesModified: Zod.z.array(Zod.z.string()).describe("List of documentation file paths that were modified"),
  summary: Zod.z.string().describe("Brief summary of documentation changes made"),
  noChangesNeeded: Zod.z.boolean().describe("Whether no documentation changes were needed for this task"),
});

const systemPrompt: NonNullable<string> = `You are a micro documentation agent with FULL filesystem access — you can read, write, edit files, and execute shell commands.

Your job is to update documentation after each verified implementation task. You review what was implemented and determine if the documentation needs updating with new findings, implementation details, or corrections.

Approach:
1. Read the current task description and what was implemented.
2. Review existing documentation files in the docs folder.
3. Determine if documentation needs updating:
   - New API endpoints or interfaces that need documenting
   - Architecture decisions made during implementation
   - Updated behavior or configuration options
   - Replace <!-- CURRENTLY IMPLEMENTING --> tags with actual details where applicable
4. If updates are needed, make them. If not, report that no changes were needed.

Rules:
- Only update documentation files — do NOT modify production code or test files.
- Keep updates focused on the current task — don't do a full documentation overhaul.
- Preserve existing documentation structure and conventions.
- If the task was a minor fix or config change, it may not need documentation updates.
- Set noChangesNeeded to true if no documentation updates were warranted.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the micro documenter
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  Deepagents.LocalShellBackend,
  null,
  systemPrompt,
  microDocumenterAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads controller output and documentation config
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const controllerOutput: NonNullable<ControllerOutput> =
    state.controllerState.output ??
    (() => {
      throw new Error("Controller output is null or undefined");
    })();

  const docConfig: NonNullable<DocumentationConfig> =
    state.documentationConfig ??
    (() => {
      throw new Error("Documentation config is null or undefined");
    })();

  const message: NonNullable<string> = `A task has been implemented and verified. Review the implementation and update documentation if needed.

<task>
${controllerOutput.currentTask.description}
</task>

<relevant-files>
${controllerOutput.currentTask.relevantFiles.join("\n")}
</relevant-files>

<prd>
${controllerOutput.prd}
</prd>

<documentation-config>
Docs folder path: ${docConfig.docsFolderPath}
Index path: ${docConfig.indexPath}
</documentation-config>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.microDocumenter ?? null;
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
// Node: processMicroDocumentation — extracts the micro documenter output
// ---------------------------------------------------------------------------

function processMicroDocumentation(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<MicroDocumenterOutput> = microDocumenterAgentOutputSchema.parse(invokeAgentOutput.result);

  state.microDocumenterState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    microDocumenterState: state.microDocumenterState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the micro documenter subgraph
//
// Flow: __start__ -> setup -> invokeMicroDocumenter -> processMicroDocumentation -> __end__
// ---------------------------------------------------------------------------

export const microDocumenterGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeMicroDocumenter", invokeGraph)
  .addNode("processMicroDocumentation", processMicroDocumentation)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeMicroDocumenter")
  .addEdge("invokeMicroDocumenter", "processMicroDocumentation")
  .addEdge("processMicroDocumentation", "__end__")
  .compile();
