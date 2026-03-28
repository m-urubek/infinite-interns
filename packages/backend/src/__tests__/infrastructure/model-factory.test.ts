import { type ModelConfig } from "../../shared/agent-config-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@langchain/google-genai", (): any => {
  class MockChatGoogleGenerativeAI {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: any) {
      this.config = config;
    }
  }
  // eslint-disable-next-line local/enforce-explicit-types
  const mod: { ChatGoogleGenerativeAI: typeof MockChatGoogleGenerativeAI } = {
    ChatGoogleGenerativeAI: MockChatGoogleGenerativeAI,
  };
  return mod;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@langchain/openai", (): any => {
  class MockChatOpenAI {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: any) {
      this.config = config;
    }
  }
  // eslint-disable-next-line local/enforce-explicit-types
  const mod: { ChatOpenAI: typeof MockChatOpenAI } = { ChatOpenAI: MockChatOpenAI };
  return mod;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@langchain/deepseek", (): any => {
  class MockChatDeepSeek {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: any) {
      this.config = config;
    }
  }
  // eslint-disable-next-line local/enforce-explicit-types
  const mod: { ChatDeepSeek: typeof MockChatDeepSeek } = { ChatDeepSeek: MockChatDeepSeek };
  return mod;
});

import * as ModelFactory from "../../shared/model-factory";
import * as GoogleGenai from "@langchain/google-genai";
import * as OpenAI from "@langchain/openai";
import * as DeepSeek from "@langchain/deepseek";

describe("createModelFromConfig", () => {
  it("creates a Google model when provider is 'google'", () => {
    const config: ModelConfig = {
      model: "gemini-3-flash-preview",
      temperature: 0.5,
      thinkingEnabled: false,
      provider: "google",
    };
    const result = ModelFactory.createModelFromConfig(config);
    expect(result).toBeInstanceOf(GoogleGenai.ChatGoogleGenerativeAI);
  });

  it("creates a Google model when provider is null (backward compat)", () => {
    const config: ModelConfig = {
      model: "gemini-3-flash-preview",
      temperature: 0.5,
      thinkingEnabled: false,
      provider: null,
    };
    const result = ModelFactory.createModelFromConfig(config);
    expect(result).toBeInstanceOf(GoogleGenai.ChatGoogleGenerativeAI);
  });

  it("creates a Google model when provider is undefined (backward compat)", () => {
    const config: ModelConfig = {
      model: "gemini-3-flash-preview",
      temperature: 0.5,
      thinkingEnabled: false,
      provider: undefined,
    };
    const result = ModelFactory.createModelFromConfig(config);
    expect(result).toBeInstanceOf(GoogleGenai.ChatGoogleGenerativeAI);
  });

  it("creates an OpenAI model when provider is 'openai'", () => {
    const config: ModelConfig = {
      model: "gpt-4o",
      temperature: 0.7,
      thinkingEnabled: false,
      provider: "openai",
    };
    const result = ModelFactory.createModelFromConfig(config);
    expect(result).toBeInstanceOf(OpenAI.ChatOpenAI);
  });

  it("creates a DeepSeek model when provider is 'deepseek'", () => {
    const config: ModelConfig = {
      model: "deepseek-chat",
      temperature: 0.3,
      thinkingEnabled: false,
      provider: "deepseek",
    };
    const result = ModelFactory.createModelFromConfig(config);
    expect(result).toBeInstanceOf(DeepSeek.ChatDeepSeek);
  });

  it("applies thinkingConfig only for Google provider", () => {
    const googleConfig: ModelConfig = {
      model: "gemini-3-flash-preview",
      temperature: 0.5,
      thinkingEnabled: true,
      provider: "google",
    };
    const googleResult = ModelFactory.createModelFromConfig(googleConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleModelConfig = (googleResult as any).config;
    expect(googleModelConfig.thinkingConfig).toBeDefined();
    expect(googleModelConfig.thinkingConfig.includeThoughts).toBe(true);
    expect(googleModelConfig.thinkingConfig.thinkingLevel).toBe("MEDIUM");

    const openaiConfig: ModelConfig = {
      model: "gpt-4o",
      temperature: 0.5,
      thinkingEnabled: true,
      provider: "openai",
    };
    const openaiResult = ModelFactory.createModelFromConfig(openaiConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openaiModelConfig = (openaiResult as any).config;
    expect(openaiModelConfig.thinkingConfig).toBeUndefined();
  });

  it("does not include thinkingConfig when thinkingEnabled is false for Google", () => {
    const config: ModelConfig = {
      model: "gemini-3-flash-preview",
      temperature: 0.5,
      thinkingEnabled: false,
      provider: "google",
    };
    const result = ModelFactory.createModelFromConfig(config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelConfig = (result as any).config;
    expect(modelConfig.thinkingConfig).toBeUndefined();
  });

  it("passes model name and temperature to each provider", () => {
    const googleConfig: ModelConfig = {
      model: "gemini-3-flash-preview",
      temperature: 0.1,
      thinkingEnabled: false,
      provider: "google",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleModelConfig = (ModelFactory.createModelFromConfig(googleConfig) as any).config;
    expect(googleModelConfig.model).toBe("gemini-3-flash-preview");
    expect(googleModelConfig.temperature).toBe(0.1);

    const openaiConfig: ModelConfig = {
      model: "gpt-4o",
      temperature: 0.9,
      thinkingEnabled: false,
      provider: "openai",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openaiModelConfig = (ModelFactory.createModelFromConfig(openaiConfig) as any).config;
    expect(openaiModelConfig.model).toBe("gpt-4o");
    expect(openaiModelConfig.temperature).toBe(0.9);

    const deepseekConfig: ModelConfig = {
      model: "deepseek-chat",
      temperature: 0.5,
      thinkingEnabled: false,
      provider: "deepseek",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deepseekModelConfig = (ModelFactory.createModelFromConfig(deepseekConfig) as any).config;
    expect(deepseekModelConfig.model).toBe("deepseek-chat");
    expect(deepseekModelConfig.temperature).toBe(0.5);
  });
});
