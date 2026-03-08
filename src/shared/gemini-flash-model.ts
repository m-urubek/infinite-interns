import * as GoogleGenai from "@langchain/google-genai";

export const geminiFlashLLMMedium: NonNullable<GoogleGenai.ChatGoogleGenerativeAI> =
  new GoogleGenai.ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0.5,
  });
