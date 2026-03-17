import * as GoogleGenai from "@langchain/google-genai";
import { type ModelConfig } from "./agent-config-types";

type ThinkingLevel = NonNullable<"MEDIUM">;

const THINKING_LEVEL: NonNullable<ThinkingLevel> = "MEDIUM";

export function createModelFromConfig(
  config: NonNullable<ModelConfig>
): NonNullable<GoogleGenai.ChatGoogleGenerativeAI> {
  const model: NonNullable<GoogleGenai.ChatGoogleGenerativeAI> = new GoogleGenai.ChatGoogleGenerativeAI({
    model: config.model,
    temperature: config.temperature,
    ...(config.thinkingEnabled && {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: THINKING_LEVEL,
      },
    }),
  });
  return model;
}
