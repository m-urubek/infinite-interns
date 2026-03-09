import { type ZodObject, type ZodRawShape } from "zod";
import type z from "zod";
import { type Message } from "./invoke-agent-types";
import { type ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as Deepagents from "deepagents";
import type { BackendProtocol, DeepAgent } from "deepagents";
import * as Langchain from "langchain";
import * as SharedUtility from "../shared/shared-utility";

export type InvokeAgentInternalOutput = {
  response: z.infer<z.ZodObject<ZodRawShape>> | null | undefined;
  success: NonNullable<boolean>;
  errorMessage: string | null | undefined;
};

export async function invokeAgent(
  messages: NonNullable<Array<Message>>,
  model: NonNullable<ChatGoogleGenerativeAI>,
  backend: NonNullable<BackendProtocol>,
  systemPrompt: string | null | undefined,
  responseZod: NonNullable<ZodObject<ZodRawShape>>
): NonNullable<Promise<NonNullable<InvokeAgentInternalOutput>>> {
  let output: NonNullable<InvokeAgentInternalOutput>;

  let structuredResponse: unknown;
  try {
    const agentToInvoke: NonNullable<DeepAgent> = Deepagents.createDeepAgent({
      model: model,
      backend: backend,
      ...(SharedUtility.isNotNullOrEmpty(systemPrompt) && {
        systemPrompt: systemPrompt,
      }),
      responseFormat: Langchain.toolStrategy(responseZod),
    });

    const agentInvocationResult = await agentToInvoke.invoke({ messages });
    structuredResponse = agentInvocationResult.structuredResponse;
  } catch (e: unknown) {
    output = {
      response: null,
      success: false,
      errorMessage: "Unexpected error occurred: " + (e as NonNullable<Error>).message,
    };
    return output;
  }

  if (
    !SharedUtility.isNotNullOrUndf(structuredResponse) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (!SharedUtility.isNotNullOrUndf((structuredResponse as any).length) && (structuredResponse as any).length <= 0)
  ) {
    output = {
      response: null,
      success: false,
      errorMessage: "Response is null or undefined or empty",
    };
    return output;
  }

  type AgentOutput = z.infer<z.ZodObject<ZodRawShape>>;
  let validatedResponse: AgentOutput | null | undefined = null;
  // eslint-disable-next-line local/enforce-explicit-types, @typescript-eslint/no-explicit-any
  const validationResult: z.SafeParseReturnType<any, any> = responseZod.safeParse(structuredResponse);
  if (!SharedUtility.isNotNullOrUndf(validationResult)) {
    output = {
      response: null,
      success: false,
      errorMessage: "Validation of the response format returned null or undefined",
    };
    return output;
  }
  if (!validationResult.success) {
    output = {
      response: null,
      success: false,
      errorMessage: "Response is in invalid format. Error message: " + validationResult.error.message,
    };
    return output;
  } else {
    validatedResponse = validationResult.data;
  }

  if (SharedUtility.isNotNullOrUndf(validatedResponse)) {
    output = {
      response: validatedResponse,
      success: true,
      errorMessage: null,
    };
    return output;
  } else {
    output = {
      response: null,
      success: false,
      errorMessage: "Response is null or undefined",
    };
    return output;
  }
}
