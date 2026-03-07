/**
 * Direct test runner for the pipeline graph.
 * Run this file directly with tsx for normal Node.js debugging
 * (breakpoints, step-through, watch variables - everything works).
 *
 * Usage: npx tsx src/debug-run.ts
 * Debug: Use "Debug Pipeline (direct)" launch config in VS Code
 */
/* eslint-disable no-undef */

import * as readline from "readline";
import {
  Command,
  INTERRUPT,
  isInterrupted,
  MemorySaver,
} from "@langchain/langgraph";
import { graphBuilder } from "./pipeline.js";

// ---------------------------------------------------------------------------
// Types for interrupt payloads
// ---------------------------------------------------------------------------

type QuestionItem = { question: string; reason: string };
type HumanAnswer = { question: string; answer: string };
type HumanAnswers = Array<HumanAnswer>;
type HumanInterruptPayload = { questions: Array<QuestionItem> };
type ReviewInterruptPayload = { prd: string; message: string };
type InterruptPayload = HumanInterruptPayload | ReviewInterruptPayload;
type InterruptEntry = { value: unknown };
type GraphConfig = { configurable: { thread_id: string } };
type InterruptHandlerResult = HumanAnswers | string;

// ---------------------------------------------------------------------------
// Stdin helpers
// ---------------------------------------------------------------------------

type ResolveString = (value: string) => void;
type ResolveVoid = (value: void) => void;

function askLine(prompt: string): Promise<string> {
  const rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const p: Promise<string> = new Promise((resolve: ResolveString): void => {
    rl.question(prompt, (answer: string): void => {
      rl.close();
      resolve(answer);
    });
  });
  return p;
}

function pressEnter(prompt: string): Promise<void> {
  const rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const p: Promise<void> = new Promise((resolve: ResolveVoid): void => {
    rl.question(prompt, (): void => {
      rl.close();
      resolve();
    });
  });
  return p;
}

// ---------------------------------------------------------------------------
// Interrupt handler — reads from stdin and returns resume value
// ---------------------------------------------------------------------------

async function handleInterrupt(
  value: unknown,
): Promise<InterruptHandlerResult> {
  const payload: InterruptPayload = value as InterruptPayload;

  if ("questions" in payload) {
    // humanPrompt interrupt: ask each question via stdin
    const humanPayload: HumanInterruptPayload = payload;
    const answers: HumanAnswers = [];
    for (const q of humanPayload.questions) {
      const answer: string = await askLine(
        `\n${q.question}\n(reason: ${q.reason})\nYour answer: `,
      );
      const entry: HumanAnswer = { question: q.question, answer };
      answers.push(entry);
    }
    const questionsResult: InterruptHandlerResult =
      answers as InterruptHandlerResult;
    return questionsResult;
  }

  // review interrupt: show PRD and wait for user to press Enter
  const reviewPayload: ReviewInterruptPayload = payload;
  console.log("\n=== PRD FOR REVIEW ===\n");
  console.log(reviewPayload.prd);
  console.log("\n=== END PRD ===");
  console.log(reviewPayload.message);
  await pressEnter("\nPress Enter to continue to planning...");
  const reviewResult: InterruptHandlerResult =
    "continue" as InterruptHandlerResult;
  return reviewResult;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const input: {
  task: string;
  projectDir: string;
  buildCommands: Array<string>;
} = {
  task: "Create a typescript react app that lets me manage todos.",
  projectDir: "/mnt/d/TodoApp",
  buildCommands: ["npm run build"],
};

console.log("Starting pipeline with input:", JSON.stringify(input, null, 2));
console.log("---");

try {
  const checkpointer: MemorySaver = new MemorySaver();
  const graph = graphBuilder.compile({ checkpointer });
  const config: GraphConfig = {
    configurable: { thread_id: "debug-run-1" },
  };

  let result: unknown = await graph.invoke(input, config);

  while (isInterrupted(result)) {
    const interrupts: Array<InterruptEntry> = (
      result as Record<typeof INTERRUPT, Array<InterruptEntry>>
    )[INTERRUPT];
    const firstInterrupt: InterruptEntry | undefined = interrupts[0];
    if (!firstInterrupt) {
      break;
    }
    const resumeValue: unknown = await handleInterrupt(firstInterrupt.value);
    result = await graph.invoke(new Command({ resume: resumeValue }), config);
  }

  console.log("---");
  console.log(
    "Pipeline completed. Final state:",
    JSON.stringify(result, null, 2),
  );
} catch (err) {
  console.error("Pipeline failed:", err);
  process.exit(1);
}
