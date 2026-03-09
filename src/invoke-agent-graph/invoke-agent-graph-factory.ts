import * as Langgraph from "@langchain/langgraph";
import * as SharedUtility from "../shared/shared-utility";
import type { InvokeAgentInput, InvokeAgentInternal, Message } from "./invoke-agent-types";
import * as InvokeAgentInternalUtility from "./invoke-agent-internal-utility";
import type { InvokeAgentInternalOutput } from "./invoke-agent-internal-utility";
import { type ZodObject, type ZodRawShape } from "zod";
import { type ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { type BackendProtocol } from "deepagents";
import * as MainPipelineAnnotations from "../main-pipeline-graph/main-pipeline-annotations";
import { type MainPipelineState } from "../main-pipeline-graph/main-pipeline-types";

export function createInvokeAgentGraph(
  // eslint-disable-next-line local/enforce-explicit-types
  backendClass: new (options: { rootDir: string }) => BackendProtocol,
  model: NonNullable<ChatGoogleGenerativeAI>,
  systemPrompt: NonNullable<string>,
  responseZod: NonNullable<ZodObject<ZodRawShape>>,
  maxInSessionAttempts: NonNullable<number>,
  maxSessionAttempts: NonNullable<number>
) {
  async function firstInvokeNode(
    state: NonNullable<MainPipelineState>
  ): NonNullable<Promise<Partial<MainPipelineState>>> {
    const input: NonNullable<InvokeAgentInput> = state.invokeAgentState.input;

    const backend: NonNullable<BackendProtocol> = new backendClass({ rootDir: state.projectDir });

    const messages: NonNullable<Array<Message>> = input.conversationHistory ?? [];
    messages.push({
      role: "user",
      content: input.userMessage,
    });

    const agentOutput: NonNullable<InvokeAgentInternalOutput> = await InvokeAgentInternalUtility.invokeAgent(
      messages,
      model,
      backend,
      systemPrompt,
      responseZod
    );

    if (agentOutput.success) {
      if (!SharedUtility.isNotNullOrUndf(agentOutput.response)) {
        throw new Error("Failed to generate response - response is null or undefined");
      }
      state.invokeAgentState.output = {
        result: agentOutput.response,
      };
    }

    state.invokeAgentState.internal.succeeded = agentOutput.success;
    state.invokeAgentState.internal.errorMessage = agentOutput.errorMessage;

    const update: NonNullable<Partial<MainPipelineState>> = {
      invokeAgentState: state.invokeAgentState,
    };
    return update;
  }

  async function repeatNode(state: NonNullable<MainPipelineState>): NonNullable<Promise<Partial<MainPipelineState>>> {
    const internalState: NonNullable<InvokeAgentInternal> = state.invokeAgentState.internal;
    const input: NonNullable<InvokeAgentInput> = state.invokeAgentState.input;

    internalState.currentInSessionAttempt = SharedUtility.applyDefault(internalState.currentInSessionAttempt, 2); // second message
    internalState.currentSessionAttempt = SharedUtility.applyDefault(internalState.currentSessionAttempt, 1); // first session

    const messages: NonNullable<Array<Message>> = [...(input.conversationHistory ?? [])];
    messages.push({ role: "user", content: input.userMessage });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      messages.push({
        role: "user",
        content:
          "A problem occurred while processing your response. Do appropriate correction and try again. Details about the problem: " +
          (internalState.errorMessage ??
            (() => {
              throw new Error("Error message is null or undefined");
            })()),
      });

      await SharedUtility.sleep(5000);

      const backend: NonNullable<BackendProtocol> = new backendClass({ rootDir: state.projectDir });
      const agentOutput: NonNullable<InvokeAgentInternalOutput> = await InvokeAgentInternalUtility.invokeAgent(
        messages,
        model,
        backend,
        systemPrompt,
        responseZod
      );

      if (agentOutput.success) {
        if (!SharedUtility.isNotNullOrUndf(agentOutput.response)) {
          throw new Error("Failed to generate response - response is null or undefined");
        }
        state.invokeAgentState.output = {
          result: agentOutput.response,
        };
        state.invokeAgentState.internal.succeeded = true;
        const update: NonNullable<Partial<MainPipelineState>> = { invokeAgentState: state.invokeAgentState };
        return update;
      }

      internalState.errorMessage = agentOutput.errorMessage;
      internalState.currentInSessionAttempt++;

      if (internalState.currentInSessionAttempt > maxInSessionAttempts) {
        internalState.currentInSessionAttempt = 1;
        internalState.currentSessionAttempt++;

        if (internalState.currentSessionAttempt > maxSessionAttempts) {
          throw new Error(
            `Max session attempts (${maxSessionAttempts.toString()}) reached. Last error: ${agentOutput.errorMessage ?? "unknown"}`
          );
        }

        messages.length = 0;
        messages.push({ role: "user", content: input.userMessage });
      }
    }
  }

  type RepeatOrEndRoute = "repeatNode" | "__end__";
  function correctedOrFatal(state: NonNullable<MainPipelineState>): NonNullable<RepeatOrEndRoute> {
    let resultRoute: NonNullable<RepeatOrEndRoute>;
    if (state.invokeAgentState.internal.succeeded) {
      resultRoute = "__end__" as NonNullable<RepeatOrEndRoute>;
    } else {
      resultRoute = "repeatNode" as NonNullable<RepeatOrEndRoute>;
    }
    return resultRoute;
  }

  const invokeAgentGrapg = new Langgraph.StateGraph({
    stateSchema: MainPipelineAnnotations.mainPipelineStateAnnotation,
  })
    .addNode("firstInvokeNode", firstInvokeNode)
    .addNode("repeatNode", repeatNode)
    .addEdge("__start__", "firstInvokeNode")
    .addConditionalEdges("firstInvokeNode", correctedOrFatal, ["repeatNode", "__end__"])
    .addEdge("repeatNode", "__end__")
    .compile();

  return invokeAgentGrapg;
}
