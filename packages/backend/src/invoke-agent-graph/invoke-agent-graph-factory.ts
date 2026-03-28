import * as Langgraph from "@langchain/langgraph";
import * as Util from "../shared/util";
import type { InvokeAgentInput, InvokeAgentInternal, Message } from "./invoke-agent-types";
import * as InvokeAgentInternalUtility from "./invoke-agent-internal-utility";
import type { InvokeAgentInternalOutput } from "./invoke-agent-internal-utility";
import { type ZodObject, type ZodRawShape } from "zod";
import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type BackendProtocol } from "deepagents";
import * as MainPipelineAnnotations from "../main-pipeline-graph/main-pipeline-annotations";
import { type MainPipelineState } from "../main-pipeline-graph/main-pipeline-types";
import * as ModelFactory from "../shared/model-factory";
import * as GeminiFlashModel from "../shared/gemini-flash-model";
import * as RateLimiterModule from "../shared/rate-limiter";
import { type RateLimitsConfig } from "../shared/agent-config-types";

let sharedRateLimiter: RateLimiterModule.RateLimiter | null | undefined = null;

function getOrCreateRateLimiter(
  config: RateLimitsConfig | null | undefined
): RateLimiterModule.RateLimiter | null | undefined {
  if (Util.isNotNullOrUndf(config) && !Util.isNotNullOrUndf(sharedRateLimiter)) {
    sharedRateLimiter = RateLimiterModule.createRateLimiter(config);
  }
  const result: RateLimiterModule.RateLimiter | null | undefined = Util.isNotNullOrUndf(config)
    ? sharedRateLimiter
    : null;
  return result;
}

function resolveModel(
  inputModelConfig: InvokeAgentInput["modelConfig"],
  fallbackModel: BaseChatModel | null | undefined
): NonNullable<BaseChatModel> {
  if (Util.isNotNullOrUndf(inputModelConfig)) {
    const resolved: NonNullable<BaseChatModel> = ModelFactory.createModelFromConfig(inputModelConfig);
    return resolved;
  }
  if (Util.isNotNullOrUndf(fallbackModel)) {
    return fallbackModel;
  }
  return GeminiFlashModel.geminiFlashLLMMedium;
}

export function createInvokeAgentGraph(
  // eslint-disable-next-line local/enforce-explicit-types
  backendClass: new (options: { rootDir: string }) => BackendProtocol,
  model: BaseChatModel | null | undefined,
  systemPrompt: NonNullable<string>,
  responseZod: NonNullable<ZodObject<ZodRawShape>>,
  maxInSessionAttempts: NonNullable<number>,
  maxSessionAttempts: NonNullable<number>
) {
  function buildEffectiveSystemPrompt(customRules: string | null | undefined): NonNullable<string> {
    if (!Util.isNotNullOrEmpty(customRules)) {
      return systemPrompt;
    }
    const effectivePrompt: NonNullable<string> = systemPrompt + "\n\n## Custom Rules\n\n" + customRules;
    return effectivePrompt;
  }

  async function firstInvokeNode(
    state: NonNullable<MainPipelineState>
  ): NonNullable<Promise<Partial<MainPipelineState>>> {
    const input: NonNullable<InvokeAgentInput> = state.invokeAgentState.input;

    const backend: NonNullable<BackendProtocol> = new backendClass({ rootDir: state.projectDir });
    const resolvedModel: NonNullable<BaseChatModel> = resolveModel(input.modelConfig, model);
    const effectiveSystemPrompt: NonNullable<string> = buildEffectiveSystemPrompt(input.customRules);

    const messages: NonNullable<Array<Message>> = input.conversationHistory ?? [];
    messages.push({
      role: "user",
      content: input.userMessage,
    });

    const rateLimiter: RateLimiterModule.RateLimiter | null | undefined = getOrCreateRateLimiter(
      state.rateLimitsConfig
    );
    if (Util.isNotNullOrUndf(rateLimiter)) {
      await rateLimiter.waitForAvailability();
    }

    const agentOutput: NonNullable<InvokeAgentInternalOutput> = await InvokeAgentInternalUtility.invokeAgent(
      messages,
      resolvedModel,
      backend,
      effectiveSystemPrompt,
      responseZod
    );

    if (agentOutput.success) {
      if (!Util.isNotNullOrUndf(agentOutput.response)) {
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
    const resolvedModel: NonNullable<BaseChatModel> = resolveModel(input.modelConfig, model);
    const effectiveSystemPrompt: NonNullable<string> = buildEffectiveSystemPrompt(input.customRules);

    const effectiveMaxInSession: NonNullable<number> = input.retryConfig?.maxInSessionAttempts ?? maxInSessionAttempts;
    const effectiveMaxSessions: NonNullable<number> = input.retryConfig?.maxSessionAttempts ?? maxSessionAttempts;

    internalState.currentInSessionAttempt = Util.applyDefault(internalState.currentInSessionAttempt, 2); // second message
    internalState.currentSessionAttempt = Util.applyDefault(internalState.currentSessionAttempt, 1); // first session

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

      await Util.sleep(5000);

      const rateLimiter: RateLimiterModule.RateLimiter | null | undefined = getOrCreateRateLimiter(
        state.rateLimitsConfig
      );
      if (Util.isNotNullOrUndf(rateLimiter)) {
        await rateLimiter.waitForAvailability();
      }

      const backend: NonNullable<BackendProtocol> = new backendClass({ rootDir: state.projectDir });
      const agentOutput: NonNullable<InvokeAgentInternalOutput> = await InvokeAgentInternalUtility.invokeAgent(
        messages,
        resolvedModel,
        backend,
        effectiveSystemPrompt,
        responseZod
      );

      if (agentOutput.success) {
        if (!Util.isNotNullOrUndf(agentOutput.response)) {
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

      if (internalState.currentInSessionAttempt > effectiveMaxInSession) {
        internalState.currentInSessionAttempt = 1;
        internalState.currentSessionAttempt++;

        if (internalState.currentSessionAttempt > effectiveMaxSessions) {
          throw new Error(
            `Max session attempts (${effectiveMaxSessions.toString()}) reached. Last error: ${agentOutput.errorMessage ?? "unknown"}`
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
