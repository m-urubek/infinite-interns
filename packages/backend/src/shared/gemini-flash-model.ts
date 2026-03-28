import * as GoogleGenai from "@langchain/google-genai";
import { type BaseChatModel } from "@langchain/core/language_models/chat_models";

export const geminiFlashLLMMedium: NonNullable<BaseChatModel> = new GoogleGenai.ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0.5,
});
