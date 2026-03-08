import type z from "zod";
import { type ZodRawShape } from "zod";

export type InvokeAgentState = {
  input: NonNullable<InvokeAgentInput>;
  output: InvokeAgentOutput | null | undefined;
  internal: NonNullable<InvokeAgentInternal>;
};

export type InvokeAgentInput = {
  /** Previous messages in the conversation NOT including the current user prompt. */
  conversationHistory: Array<Message> | null | undefined;
  userMessage: NonNullable<string>;
};

export type InvokeAgentInternal = {
  succeeded: boolean | null | undefined;
  errorMessage: string | null | undefined;
  currentSessionAttempt: number | null | undefined;
  currentInSessionAttempt: number | null | undefined;
};

export type InvokeAgentOutput = {
  result: z.infer<z.ZodObject<ZodRawShape>> | null | undefined;
};

type MessageRole = NonNullable<"user" | "assistant" | "system">;

export type Message = {
  role: NonNullable<MessageRole>;
  content: NonNullable<string>;
};
