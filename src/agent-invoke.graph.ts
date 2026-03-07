/**
 * AgentRetry subgraph
 *
 * Invokes an agent, validates structured output, and retries on failure.
 *
 * flowchart TD
 *   __start__ --> invokeAgent
 *   invokeAgent --> parseOutput
 *   parseOutput --> validation
 *   validation -->|valid| __end__
 *   validation -->|invalid| handleRepeat
 *   handleRepeat -->|inSessionAttempts < MAX| appendCorrection --> invokeAgent
 *   handleRepeat -->|sessionAttempts < MAX| resetSession --> invokeAgent
 *   handleRepeat -->|all exhausted| __end__ throws
 */

import { StateGraph } from "@langchain/langgraph";
import {
  AgentRetryAnnotation,
  AgentRetryInput,
  resolveParseFn,
  routeAfterValidation,
  routeAfterHandleRepeat,
} from "./agent-invoke-state.js";
import type {
  AgentRetryState,
  ParseFn,
  ParseResult,
  SerializableMessage,
} from "./agent-invoke-state.js";
import type { ParsedOutput } from "./types.js";
import type { createDeepAgentFunction } from "./agent-types.js";
import { DeepAgent } from "deepagents";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type AgentMessage = {
  role?: string;
  content: unknown;
};

type AgentResult = {
  messages: Array<AgentMessage>;
  structuredResponse?: unknown;
};

function extractRaw(result: AgentResult): string {
  if (
    result.structuredResponse !== undefined &&
    result.structuredResponse !== null
  ) {
    const structured: string = JSON.stringify(result.structuredResponse);
    return structured;
  }
  const lastMsg: AgentMessage | undefined = result.messages.at(-1);
  if (!lastMsg) {
    const empty: string = "";
    return empty;
  }
  const content: unknown = lastMsg.content;
  const response: string =
    typeof content === "string" ? content : JSON.stringify(content);
  return response;
}

type MessageRole = "user" | "assistant" | "system";

function toSerializable(
  messages: Array<AgentMessage>,
): Array<SerializableMessage> {
  const result: Array<SerializableMessage> = messages.map(
    (m: AgentMessage): SerializableMessage => {
      const role: MessageRole =
        m.role === "user" || m.role === "system" ? m.role : "assistant";
      const content: string =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      const msg: SerializableMessage = { role, content };
      return msg;
    },
  );
  return result;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

type InvokeAgentNodeFn = (
  state: AgentRetryState,
) => Promise<Partial<AgentRetryState>>;

function createInvokeAgentNode(
  factory: createDeepAgentFunction,
): InvokeAgentNodeFn {
  const invokeAgentNode: InvokeAgentNodeFn = async (
    state: AgentRetryState,
  ): Promise<Partial<AgentRetryState>> => {
    const agent: DeepAgent = factory(state.projectDir);

    const messages: Array<SerializableMessage> =
      state.conversationHistory.length === 0
        ? [{ role: "user", content: state.initialMessage }]
        : state.conversationHistory;

    const rawResult = await agent.invoke({ messages });
    const result: AgentResult = rawResult as AgentResult;
    const rawOutput: string = extractRaw(result);
    const conversationHistory: Array<SerializableMessage> = toSerializable(
      result.messages,
    );

    const update: Partial<AgentRetryState> = {
      rawOutput,
      conversationHistory,
    };
    return update;
  };
  return invokeAgentNode;
}

function parseOutputNode(state: AgentRetryState): Partial<AgentRetryState> {
  const parseFn: ParseFn = resolveParseFn(state.parseKey);
  const parsed: ParseResult<ParsedOutput> = parseFn(state.rawOutput);

  if (parsed.ok) {
    const successUpdate: Partial<AgentRetryState> = { result: parsed.data };
    return successUpdate;
  }

  const failUpdate: Partial<AgentRetryState> = { lastError: parsed.error };
  return failUpdate;
}

// Routing decision node — increments counters so routeAfterHandleRepeat
// can read them as plain state, keeping routing functions pure.
function handleRepeatNode(state: AgentRetryState): Partial<AgentRetryState> {
  const willResetSession: boolean =
    state.inSessionAttempts >= state.maxInSessionAttempts &&
    state.sessionAttempts < state.maxSessionAttempts;

  if (willResetSession) {
    const resetUpdate: Partial<AgentRetryState> = {
      sessionAttempts: state.sessionAttempts + 1,
      inSessionAttempts: 0,
    };
    return resetUpdate;
  }

  // Either going to appendCorrection or exhausted — either way increment in-session count
  const incrementUpdate: Partial<AgentRetryState> = {
    inSessionAttempts: state.inSessionAttempts + 1,
  };
  return incrementUpdate;
}

function appendCorrectionNode(
  state: AgentRetryState,
): Partial<AgentRetryState> {
  const correctionMsg: SerializableMessage = {
    role: "user",
    content: `Your previous response was invalid and could not be used. Error: ${state.lastError}\n\nPlease correct your response and provide the properly formatted output.`,
  };
  const conversationHistory: Array<SerializableMessage> = [
    ...state.conversationHistory,
    correctionMsg,
  ];
  const update: Partial<AgentRetryState> = { conversationHistory };
  return update;
}

function resetSessionNode(state: AgentRetryState): Partial<AgentRetryState> {
  const conversationHistory: Array<SerializableMessage> = [
    { role: "user", content: state.initialMessage },
  ];
  const update: Partial<AgentRetryState> = { conversationHistory };
  return update;
}

// ---------------------------------------------------------------------------
// Exhaustion — throws when all retry attempts are spent.
// Used as a subgraph node so the error propagates to the parent pipeline.
// ---------------------------------------------------------------------------

function exhaustedNode(state: AgentRetryState): Partial<AgentRetryState> {
  const errorMsg: string = `Agent exhausted all retries (${state.maxSessionAttempts + 1} sessions × ${state.maxInSessionAttempts} in-session attempts). Last error: ${state.lastError}`;
  throw new Error(errorMsg);
}

export function createInvokeAgentGraph(factory: createDeepAgentFunction) {
  const invokeAgentNode: InvokeAgentNodeFn = createInvokeAgentNode(factory);

  const graph = new StateGraph({
    stateSchema: AgentRetryAnnotation,
    input: AgentRetryInput,
  })
    .addNode("invokeAgent", invokeAgentNode)
    .addNode("parseOutput", parseOutputNode)
    .addNode("handleRepeat", handleRepeatNode)
    .addNode("appendCorrection", appendCorrectionNode)
    .addNode("resetSession", resetSessionNode)
    .addNode("exhausted", exhaustedNode)
    .addEdge("__start__", "invokeAgent")
    .addEdge("invokeAgent", "parseOutput")
    .addConditionalEdges("parseOutput", routeAfterValidation, [
      "handleRepeat",
      "__end__",
    ])
    .addConditionalEdges("handleRepeat", routeAfterHandleRepeat, [
      "appendCorrection",
      "resetSession",
      "exhausted",
    ])
    .addEdge("appendCorrection", "invokeAgent")
    .addEdge("resetSession", "invokeAgent")
    // exhaustedNode always throws, so this edge is never followed at runtime.
    // It exists to give the graph a single terminal node (__end__), which is
    // required for LangGraph Studio's xray rendering to compute a valid
    // lastNode() when this subgraph is nested inside other subgraphs.
    .addEdge("exhausted", "__end__")
    .compile();
  return graph;
}
