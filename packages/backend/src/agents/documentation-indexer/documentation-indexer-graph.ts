import * as Langgraph from "@langchain/langgraph";
import * as Deepagents from "deepagents";
import * as InvokeAgentGraphFactory from "../../invoke-agent-graph/invoke-agent-graph-factory.js";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types.js";
import { type AgentConfig, type DocumentationConfig } from "../../shared/agent-config-types.js";
import { type InvokeAgentOutput } from "../../invoke-agent-graph/invoke-agent-types.js";
import * as MainPipelineAnnotations from "../../main-pipeline-graph/main-pipeline-annotations.js";
import { type DocumentationIndexerOutput } from "./documentation-indexer-types.js";
import * as Zod from "zod";

export const documentationIndexerAgentOutputSchema = Zod.z.object({
  indexContent: Zod.z.string().describe("The full content of the generated documentation index"),
  indexPath: Zod.z.string().describe("The file path where the index was written"),
  summary: Zod.z.string().describe("Brief summary of the documentation index"),
});

const systemPrompt: NonNullable<string> = `You are a documentation indexer agent with FULL filesystem access — you can read, write, edit files, and execute shell commands.

Your job is to create or update a master documentation index that serves as a structured map of all documentation files in the project. This index is created after the final verification of the entire implementation.

Approach:
1. Scan the documentation folder to find all documentation files.
2. Read each documentation file to understand its contents and purpose.
3. Create a well-structured index at the configured index path that includes:
   - A table of contents with links to each documentation file
   - Brief descriptions of each document's contents
   - Logical grouping of related documents
   - Cross-references between related topics
4. Write the index file.

Rules:
- The index should be a Markdown file with clear structure and navigation.
- Include relative links to all documentation files.
- Group documents logically (e.g., API docs, architecture docs, guides).
- Keep descriptions concise but informative.
- If an existing index exists, update it rather than replacing it entirely.
- Do NOT modify any documentation content — only create/update the index file.`;

// ---------------------------------------------------------------------------
// Invoke agent graph for the documentation indexer
// ---------------------------------------------------------------------------

const invokeGraph = InvokeAgentGraphFactory.createInvokeAgentGraph(
  Deepagents.LocalShellBackend,
  null,
  systemPrompt,
  documentationIndexerAgentOutputSchema,
  3,
  3
);

// ---------------------------------------------------------------------------
// Node: setup — reads documentation config
// ---------------------------------------------------------------------------

function setup(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const docConfig: NonNullable<DocumentationConfig> =
    state.documentationConfig ??
    (() => {
      throw new Error("Documentation config is null or undefined");
    })();

  const message: NonNullable<string> = `All implementation tasks have been completed and verified. Create or update the master documentation index.

<assignment>
${state.assignment}
</assignment>

<documentation-config>
Docs folder path: ${docConfig.docsFolderPath}
Index path: ${docConfig.indexPath}
</documentation-config>`;

  const agentConfig: AgentConfig | null | undefined = state.agentConfigs?.documentationIndexer ?? null;
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
// Node: processDocumentationIndex — extracts the documentation indexer output
// ---------------------------------------------------------------------------

function processDocumentationIndex(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const invokeAgentOutput: NonNullable<InvokeAgentOutput> =
    state.invokeAgentState.output ??
    (() => {
      throw new Error("Invoke agent output is null or undefined");
    })();

  const parsed: NonNullable<DocumentationIndexerOutput> = documentationIndexerAgentOutputSchema.parse(
    invokeAgentOutput.result
  );

  state.documentationIndexerState.output = parsed;

  const update: NonNullable<Partial<MainPipelineState>> = {
    documentationIndexerState: state.documentationIndexerState,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Compile the documentation indexer subgraph
//
// Flow: __start__ -> setup -> invokeDocumentationIndexer -> processDocumentationIndex -> __end__
// ---------------------------------------------------------------------------

export const documentationIndexerGraph = new Langgraph.StateGraph({
  stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
})
  .addNode("setup", setup)
  .addNode("invokeDocumentationIndexer", invokeGraph)
  .addNode("processDocumentationIndex", processDocumentationIndex)
  .addEdge("__start__", "setup")
  .addEdge("setup", "invokeDocumentationIndexer")
  .addEdge("invokeDocumentationIndexer", "processDocumentationIndex")
  .addEdge("processDocumentationIndex", "__end__")
  .compile();
