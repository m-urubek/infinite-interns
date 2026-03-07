import { Annotation } from "@langchain/langgraph";

import type {
  AgentModuleKey,
  Assignment,
  Clarification,
  ParseKey,
  ParsedOutput,
} from "./types.js";

export type {
  AgentModuleKey,
  Assignment,
  Clarification,
  ParseKey,
  ParsedOutput,
};

export const MAX_CLARIFICATION_ROUNDS: number = 5;
export const MAX_IMPLEMENTATION_RETRIES: number = 3;
export const MAX_PIPELINE_RETRIES: number = 2;

// Helper: "last write wins" reducer - new value replaces old
function lastValue<T>(_prev: T, next: T): T {
  return next;
}

// Input schema - only fields callers must provide (shown in Studio)
// task and projectDir have NO defaults = Required
// buildCommands, stopAfterPrd have defaults = Optional
export const PipelineInput = Annotation.Root({
  task: Annotation<string>(),
  projectDir: Annotation<string>(),
  buildCommands: Annotation<Array<string>>({
    reducer: lastValue,
    default: (): Array<string> => [] as Array<string>,
  }),
  stopAfterPrd: Annotation<boolean>({
    reducer: lastValue,
    default: (): boolean => false,
  }),
});

// Full state schema - inputs + computed fields
export const PipelineStateAnnotation = Annotation.Root({
  // Inputs (required - no defaults)
  task: Annotation<string>(),
  projectDir: Annotation<string>(),
  // Inputs (optional - have defaults)
  buildCommands: Annotation<Array<string>>({
    reducer: lastValue,
    default: (): Array<string> => [] as Array<string>,
  }),
  stopAfterPrd: Annotation<boolean>({
    reducer: lastValue,
    default: (): boolean => false,
  }),

  // Computed state (all have defaults)
  prd: Annotation<string>({ reducer: lastValue, default: (): string => "" }),
  analysisResult: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),
  clarifications: Annotation<Array<Clarification>>({
    reducer: lastValue,
    default: (): Array<Clarification> => [] as Array<Clarification>,
  }),
  clarificationRound: Annotation<number>({
    reducer: lastValue,
    default: (): number => 0,
  }),
  needsClarification: Annotation<boolean>({
    reducer: lastValue,
    default: (): false => false,
  }),

  assignments: Annotation<Array<Assignment>>({
    reducer: lastValue,
    default: (): Array<Assignment> => [] as Array<Assignment>,
  }),
  currentAssignmentIndex: Annotation<number>({
    reducer: lastValue,
    default: (): number => 0,
  }),

  microplan: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),
  implementationResult: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),
  implementationAttempt: Annotation<number>({
    reducer: lastValue,
    default: (): number => 0,
  }),
  verificationPassed: Annotation<boolean>({
    reducer: lastValue,
    default: (): false => false,
  }),
  verificationFeedback: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),

  finalVerificationPassed: Annotation<boolean>({
    reducer: lastValue,
    default: (): false => false,
  }),
  pipelineRetries: Annotation<number>({
    reducer: lastValue,
    default: (): number => 0,
  }),

  status: Annotation<string>({
    reducer: lastValue,
    default: (): string => "pending",
  }),

  // Shared with AgentRetryAnnotation — the subgraph reads inputs and writes result
  initialMessage: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),
  parseKey: Annotation<ParseKey>({
    reducer: lastValue,
    default: (): ParseKey => "analysis" as ParseKey,
  }),
  maxInSessionAttempts: Annotation<number>({
    reducer: lastValue,
    default: (): number => 3,
  }),
  maxSessionAttempts: Annotation<number>({
    reducer: lastValue,
    default: (): number => 2,
  }),
  result: Annotation<ParsedOutput | null>({
    reducer: lastValue,
    default: (): null => null,
  }),
});

export type PipelineState = typeof PipelineStateAnnotation.State;

// ---------------------------------------------------------------------------
// Routing functions (pure domain logic, exported for testing)
// ---------------------------------------------------------------------------

export type StopCheckRoute = "review" | "createPlan";

export function routeStopCheck(state: PipelineState): StopCheckRoute {
  let route: StopCheckRoute;
  if (state.stopAfterPrd) {
    route = "review";
  } else {
    route = "createPlan";
  }
  return route;
}

export type VerifyRoute = "createMicroplan" | "finalVerify";

export function routeAfterVerify(state: PipelineState): VerifyRoute {
  let route: VerifyRoute;
  if (
    !state.verificationPassed &&
    state.implementationAttempt < MAX_IMPLEMENTATION_RETRIES
  ) {
    // Verification failed but retries remain — retry current assignment
    route = "createMicroplan";
  } else if (!state.verificationPassed) {
    // Retries exhausted — skip to finalVerify to avoid infinite loop
    route = "finalVerify";
  } else if (state.currentAssignmentIndex < state.assignments.length) {
    // Verification passed and more assignments remain
    route = "createMicroplan";
  } else {
    // All assignments done
    route = "finalVerify";
  }
  return route;
}

export type FinalVerifyRoute = "createPlan" | "__end__";

export function routeAfterFinalVerify(state: PipelineState): FinalVerifyRoute {
  let route: FinalVerifyRoute;
  if (
    !state.finalVerificationPassed &&
    state.pipelineRetries < MAX_PIPELINE_RETRIES
  ) {
    route = "createPlan";
  } else {
    route = "__end__";
  }
  return route;
}
