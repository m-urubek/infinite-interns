import { createDeepAgent, DeepAgent } from "deepagents";
import { providerStrategy } from "langchain";
import { StateGraph } from "@langchain/langgraph";
import { llm } from "../gemini-flash-model.js";
import { ReadOnlyShellBackend } from "../backends/read-only-shell-backend.js";
import { createInvokeAgentGraph } from "../agent-invoke.graph.js";
import { PipelineStateAnnotation } from "../pipeline-state.js";
import type {
  PipelineState,
  ParseKey,
  Clarification,
} from "../pipeline-state.js";
import { z } from "zod";
import { analysisSchema as prdAnalysisSchema } from "./prd-analyzer.js";

export const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        question: z.string().describe("The original question"),
        answer: z.string().describe("The answer based on codebase evidence"),
        confident: z.boolean().describe("Whether the answer is confident"),
      }),
    )
    .describe("List of answered questions"),
});

const PROMPT: string = `You are a technical analyst answering questions about a project's codebase and technical capabilities. You receive questions from a PRD analyzer and must answer them using evidence from the codebase.

IMPORTANT: You are an ANALYSIS agent. Do NOT create or modify any files.

Primary Directive: Minimal Scope
Your answers shape what gets built. Steer toward the SIMPLEST implementation.
- YAGNI -- if a feature wasn't asked for, don't suggest it
- Prefer the straightforward approach over the "proper" or "scalable" one
- Match existing codebase conventions
- When asked about edge cases not covered by business requirements, answer: "Not in scope per current requirements"

Instructions:
1. For each question, use read_file, glob, and grep to find evidence in the codebase.
2. If you need info about external libraries/APIs, use execute with curl.
3. Answer factually based on what you find.

Rules:
- Base every answer on concrete evidence
- If you can't determine the answer, say so and set confident to false
- Keep answers concise but specific (include file paths, function names)`;

export function create(projectDir: string): DeepAgent {
  const agent: DeepAgent = createDeepAgent({
    model: llm,
    backend: new ReadOnlyShellBackend({ rootDir: projectDir }),
    systemPrompt: PROMPT,
    responseFormat: providerStrategy(answersSchema),
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Subgraph: answerClarificationsGraph
// ---------------------------------------------------------------------------

const invokeGraph = createInvokeAgentGraph(create);

function answerClarificationsNode(
  state: PipelineState,
): Partial<PipelineState> {
  if (state.result !== null) {
    const answers: Array<Clarification> = state.result as Array<Clarification>;
    const clarificationRound: number = state.clarificationRound + 1;
    const processed: Partial<PipelineState> = {
      clarifications: [...state.clarifications, ...answers],
      clarificationRound,
      result: null,
      status: "clarifications_answered",
    };
    return processed;
  }

  type QuestionItem = { question: string; reason: string };
  let questions: Array<QuestionItem> = [];
  try {
    const parsed = JSON.parse(state.analysisResult);
    const result = prdAnalysisSchema.safeParse(parsed);
    if (result.success) {
      questions = result.data.questions;
    }
  } catch {
    questions = [];
  }

  const initialMessage: string = `Answer these questions about the codebase:\n\n${JSON.stringify(questions, null, 2)}`;
  const parseKey: ParseKey = "clarifications";

  const setup: Partial<PipelineState> = {
    initialMessage,
    parseKey,
    maxInSessionAttempts: 3,
    maxSessionAttempts: 2,
    result: null,
    status: "answering_clarifications",
  };
  return setup;
}

type AnswerClarificationsGraphRoute = "invokeAnswerClarifications" | "__end__";

function routeInsideAnswerClarificationsGraph(
  state: PipelineState,
): AnswerClarificationsGraphRoute {
  let route: AnswerClarificationsGraphRoute;
  if (state.status === "answering_clarifications") {
    route = "invokeAnswerClarifications";
  } else {
    route = "__end__";
  }
  return route;
}

export const answerClarificationsGraph = new StateGraph({
  stateSchema: PipelineStateAnnotation,
})
  .addNode("answerClarifications", answerClarificationsNode)
  .addNode("invokeAnswerClarifications", invokeGraph)
  .addEdge("__start__", "answerClarifications")
  .addConditionalEdges(
    "answerClarifications",
    routeInsideAnswerClarificationsGraph,
    ["invokeAnswerClarifications", "__end__"],
  )
  .addEdge("invokeAnswerClarifications", "answerClarifications")
  .compile();
