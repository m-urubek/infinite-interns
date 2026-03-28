import * as Langgraph from "@langchain/langgraph";
import * as Deepagents from "deepagents";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig, type DocumentationConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type InitialDocumenterOutput } from "./initial-documenter-types.js";
import * as Util from "../../shared/util.js";
import * as Zod from "zod";

export const initialDocumenterAgentOutputSchema = Zod.z.object({
  filesCreated: Zod.z.array(Zod.z.string()).describe("List of documentation file paths that were created"),
  filesModified: Zod.z.array(Zod.z.string()).describe("List of documentation file paths that were modified"),
  summary: Zod.z.string().describe("Brief summary of the initial documentation created"),
});

const systemPrompt: NonNullable<string> = `You are an initial documentation agent with FULL filesystem access — you can read, write, edit files, and execute shell commands.

Your job is to create or modify documentation files based on the finalized PRD and clarifications BEFORE implementation begins. You set up the documentation structure that will be refined during and after implementation.

Approach:
1. Read the PRD and clarifications to understand what will be implemented.
2. Check existing documentation in the docs folder to understand the current structure.
3. Create or update documentation files with:
   - Overview of the feature being implemented
   - Architecture decisions and design rationale
   - API documentation (if applicable)
   - Mark sections that will be finalized after implementation with <!-- CURRENTLY IMPLEMENTING --> tags
4. Create any necessary documentation folder structure.

Rules:
- Place documentation files in the configured docs folder path.
- Use <!-- CURRENTLY IMPLEMENTING --> tags for sections that need post-implementation updates.
- Follow existing documentation conventions if any are present.
- Keep documentation clear, concise, and well-structured.
- Do NOT implement any production code — only create/modify documentation files.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the initial documenter
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  Deepagents.LocalShellBackend,
  null,
  systemPrompt,
  initialDocumenterAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads analysis controller output and documentation config
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  if (!Util.isNotNullOrUndf(state.analysisControllerState.output)) {
    throw new Error("Analysis controller output is null or undefined");
  }

  const prd: NonNullable<string> = state.analysisControllerState.output.prd;
  const docConfig: NonNullable<DocumentationConfig> =
    state.documentationConfig ??
    (() => {
      throw new Error("Documentation config is null or undefined");
    })();

  const clarificationsJson: NonNullable<string> = Util.isNotNullOrEmpty(
    state.analysisControllerState.output.clarifications
  )
    ? JSON.stringify(state.analysisControllerState.output.clarifications, null, 2)
    : "No clarifications were needed.";

  const message: NonNullable<string> = `Create initial documentation for the feature described in the PRD. This documentation will be refined during and after implementation.

<assignment>
${state.assignment}
</assignment>

<clarifications>
${clarificationsJson}
</clarifications>

<prd>
${prd}
</prd>

<documentation-config>
Docs folder path: ${docConfig.docsFolderPath}
Index path: ${docConfig.indexPath}
</documentation-config>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.initialDocumenter ?? null;
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
// Node: processInitialDocumentation — extracts the initial documenter output
// ---------------------------------------------------------------------------

function processInitialDocumentation(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<InitialDocumenterOutput> = initialDocumenterAgentOutputSchema.parse(
    invokeAgentOutput.result
  );

  state.initialDocumenterState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    initialDocumenterState: state.initialDocumenterState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the initial documenter subgraph
//
// Flow: __start__ -> setup -> invokeInitialDocumenter -> processInitialDocumentation -> __end__
// ---------------------------------------------------------------------------

export const initialDocumenterGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeInitialDocumenter", invokeGraph)
  .addNode("processInitialDocumentation", processInitialDocumentation)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeInitialDocumenter")
  .addEdge("invokeInitialDocumenter", "processInitialDocumentation")
  .addEdge("processInitialDocumentation", "__end__")
  .compile();
