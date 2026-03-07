import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const llm: ChatGoogleGenerativeAI = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0.5,
});
