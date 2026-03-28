import type z from "zod";
import { type ZodRawShape } from "zod";
import { type ModelConfig, type RetryConfig } from "../shared/agent-config-types";

export type InvokeAgentState = {
  input: NonNullable<InvokeAgentInput>;
  output: InvokeAgentOutput | null | undefined;
  internal: NonNullable<InvokeAgentInternal>;
};

export type InvokeAgentInput = {
  /** Previous messages in the conversation NOT including the current user prompt. */
  conversationHistory: Array<Message> | null | undefined;
  userMessage: NonNullable<string>;
  /** Per-agent model configuration. If null, falls back to the default model. */
  modelConfig: ModelConfig | null | undefined;
  /** Per-agent retry configuration. If null, falls back to the factory defaults. */
  retryConfig: RetryConfig | null | undefined;
  /** Per-agent custom rules appended to the system prompt. If null, no custom rules are added. */
  customRules: string | null | undefined;
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
