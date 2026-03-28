import * as Langgraph from "@langchain/langgraph";
import * as Deepagents from "deepagents";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig, type DocumentationConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type FinalDocumenterOutput } from "./final-documenter-types.js";
import * as Zod from "zod";

export const finalDocumenterAgentOutputSchema = Zod.z.object({
  filesModified: Zod.z.array(Zod.z.string()).describe("List of documentation file paths that were modified"),
  summary: Zod.z.string().describe("Brief summary of final documentation cleanup"),
});

const systemPrompt: NonNullable<string> = `You are a final documentation agent with FULL filesystem access — you can read, write, edit files, and execute shell commands.

Your job is to finalize all documentation after the entire implementation is complete. You remove "currently implementing" tags, polish documentation, ensure consistency, and make final improvements.

Approach:
1. Scan all documentation files in the docs folder.
2. Remove all <!-- CURRENTLY IMPLEMENTING --> tags and replace them with actual, finalized content based on the completed implementation.
3. Review documentation for:
   - Accuracy: Ensure documentation matches the actual implementation
   - Completeness: Fill in any gaps or placeholder sections
   - Consistency: Ensure consistent formatting, terminology, and style
   - Quality: Fix typos, improve clarity, and enhance readability
4. Make any necessary corrections or improvements.

Rules:
- Only modify documentation files — do NOT modify production code or test files.
- Remove ALL <!-- CURRENTLY IMPLEMENTING --> tags — none should remain after this step.
- Keep the existing documentation structure intact.
- Do not remove existing accurate documentation — only improve it.
- Ensure all documentation reflects the final state of the implementation.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the final documenter
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  Deepagents.LocalShellBackend,
  null,
  systemPrompt,
  finalDocumenterAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads documentation indexer output and documentation config
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const docConfig: NonNullable<DocumentationConfig> =
    state.documentationConfig ??
    (() => {
      throw new Error("Documentation config is null or undefined");
    })();

  const indexSummary: NonNullable<string> = state.documentationIndexerState.output?.summary ?? "No index available.";

  const message: NonNullable<string> = `The implementation is complete and the documentation index has been created. Finalize all documentation by removing "currently implementing" tags and polishing the content.

<assignment>
${state.assignment}
</assignment>

<documentation-index-summary>
${indexSummary}
</documentation-index-summary>

<documentation-config>
Docs folder path: ${docConfig.docsFolderPath}
Index path: ${docConfig.indexPath}
</documentation-config>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.finalDocumenter ?? null;
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
// Node: processFinalDocumentation — extracts the final documenter output
// ---------------------------------------------------------------------------

function processFinalDocumentation(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<FinalDocumenterOutput> = finalDocumenterAgentOutputSchema.parse(invokeAgentOutput.result);

  state.finalDocumenterState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    finalDocumenterState: state.finalDocumenterState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the final documenter subgraph
//
// Flow: __start__ -> setup -> invokeFinalDocumenter -> processFinalDocumentation -> __end__
// ---------------------------------------------------------------------------

export const finalDocumenterGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeFinalDocumenter", invokeGraph)
  .addNode("processFinalDocumentation", processFinalDocumentation)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeFinalDocumenter")
  .addEdge("invokeFinalDocumenter", "processFinalDocumentation")
  .addEdge("processFinalDocumentation", "__end__")
  .compile();
