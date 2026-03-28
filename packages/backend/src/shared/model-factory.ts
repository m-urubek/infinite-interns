import * as GoogleGenai from "@langchain/google-genai";
import * as OpenAI from "@langchain/openai";
import * as DeepSeek from "@langchain/deepseek";
import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type ModelConfig, type ModelProvider } from "./agent-config-types";

type ThinkingLevel = NonNullable<"MEDIUM">;

const THINKING_LEVEL: NonNullable<ThinkingLevel> = "MEDIUM";

function createGoogleModel(config: NonNullable<ModelConfig>): NonNullable<BaseChatModel> {
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

function createOpenAIModel(config: NonNullable<ModelConfig>): NonNullable<BaseChatModel> {
  const model: NonNullable<OpenAI.ChatOpenAI> = new OpenAI.ChatOpenAI({
    model: config.model,
    temperature: config.temperature,
  });
  return model;
}

function createDeepSeekModel(config: NonNullable<ModelConfig>): NonNullable<BaseChatModel> {
  const model: NonNullable<DeepSeek.ChatDeepSeek> = new DeepSeek.ChatDeepSeek({
    model: config.model,
    temperature: config.temperature,
  });
  return model;
}

export function createModelFromConfig(config: NonNullable<ModelConfig>): NonNullable<BaseChatModel> {
  const provider: NonNullable<ModelProvider> = config.provider ?? "google";

  if (provider === "openai") {
    const openaiModel: NonNullable<BaseChatModel> = createOpenAIModel(config);
    return openaiModel;
  }

  if (provider === "deepseek") {
    const deepseekModel: NonNullable<BaseChatModel> = createDeepSeekModel(config);
    return deepseekModel;
  }

  const googleModel: NonNullable<BaseChatModel> = createGoogleModel(config);
  return googleModel;
}
