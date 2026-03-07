import { Annotation } from "@langchain/langgraph";

import type {
  ParseKey,
  ParsedOutput,
  Assignment,
  Clarification,
} from "./types.js";
import { generatorSchema } from "./agents/prd-generator.js";
import { analysisSchema } from "./agents/prd-analyzer.js";
import { answersSchema } from "./agents/clarification-answerer.js";
import { planSchema } from "./agents/planner.js";
import { microplanSchema } from "./agents/microplanner.js";
import { implementationSchema } from "./agents/implementer.js";
import { verificationSchema } from "./agents/verifier.js";
import { finalVerificationSchema } from "./agents/final-verifier.js";

export type { ParseKey, ParsedOutput };

// ---------------------------------------------------------------------------
// Parse key registry
// Each key maps to a parse function that validates agent output.
// String keys are serializable — safe for LangGraph checkpointing.
// ---------------------------------------------------------------------------

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ParseFn = (raw: string) => ParseResult<ParsedOutput>;

type AnalysisParseResult = ParseResult<{
  needsClarification: boolean;
  analysisResult: string;
}>;

type ClarificationsParseResult = ParseResult<Array<Clarification>>;

type PlanParseResult = ParseResult<Array<Assignment>>;

type MicroplanParseResult = ParseResult<Record<string, unknown>>;

type ImplementationParseResult = ParseResult<Record<string, unknown>>;

type VerifyParseResult = ParseResult<{ passed: boolean; feedback: string }>;

type FinalVerifyParseResult = ParseResult<{
  passed: boolean;
  feedback: string;
}>;

type PrdParseResult = ParseResult<Record<string, unknown>>;

function parsePrd(raw: string): PrdParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = generatorSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: PrdParseResult = {
        ok: false,
        error: `Invalid PRD format: ${result.error.message}`,
      } as PrdParseResult;
      return failureResponse;
    }
    const successResponse: PrdParseResult = {
      ok: true,
      data: result.data,
    } as PrdParseResult;
    return successResponse;
  } catch {
    const errorResponse: PrdParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as PrdParseResult;
    return errorResponse;
  }
}

function parseAnalysis(raw: string): AnalysisParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = analysisSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: AnalysisParseResult = {
        ok: false,
        error: `Invalid analysis format: ${result.error.message}`,
      } as AnalysisParseResult;
      return failureResponse;
    }
    const successResponse: AnalysisParseResult = {
      ok: true,
      data: {
        needsClarification: result.data.needsClarification,
        analysisResult: raw,
      },
    } as AnalysisParseResult;
    return successResponse;
  } catch {
    const errorResponse: AnalysisParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as AnalysisParseResult;
    return errorResponse;
  }
}

function parseClarifications(raw: string): ClarificationsParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = answersSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: ClarificationsParseResult = {
        ok: false,
        error: `Invalid clarifications format: ${result.error.message}`,
      } as ClarificationsParseResult;
      return failureResponse;
    }
    const successResponse: ClarificationsParseResult = {
      ok: true,
      data: result.data.answers,
    } as ClarificationsParseResult;
    return successResponse;
  } catch {
    const errorResponse: ClarificationsParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as ClarificationsParseResult;
    return errorResponse;
  }
}

function parsePlan(raw: string): PlanParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = planSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: PlanParseResult = {
        ok: false,
        error: `Invalid plan format: ${result.error.message}`,
      } as PlanParseResult;
      return failureResponse;
    }
    const successResponse: PlanParseResult = {
      ok: true,
      data: result.data.assignments,
    } as PlanParseResult;
    return successResponse;
  } catch {
    const errorResponse: PlanParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as PlanParseResult;
    return errorResponse;
  }
}

function parseMicroplan(raw: string): MicroplanParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = microplanSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: MicroplanParseResult = {
        ok: false,
        error: `Invalid microplan format: ${result.error.message}`,
      } as MicroplanParseResult;
      return failureResponse;
    }
    const successResponse: MicroplanParseResult = {
      ok: true,
      data: result.data,
    } as MicroplanParseResult;
    return successResponse;
  } catch {
    const errorResponse: MicroplanParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as MicroplanParseResult;
    return errorResponse;
  }
}

function parseImplementation(raw: string): ImplementationParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = implementationSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: ImplementationParseResult = {
        ok: false,
        error: `Invalid implementation format: ${result.error.message}`,
      } as ImplementationParseResult;
      return failureResponse;
    }
    const successResponse: ImplementationParseResult = {
      ok: true,
      data: result.data,
    } as ImplementationParseResult;
    return successResponse;
  } catch {
    const errorResponse: ImplementationParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as ImplementationParseResult;
    return errorResponse;
  }
}

function parseVerify(raw: string): VerifyParseResult {
  type Issue = {
    description: string;
    file: string;
    severity: "error" | "warning";
  };
  try {
    const parsed = JSON.parse(raw);
    const result = verificationSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: VerifyParseResult = {
        ok: false,
        error: `Invalid verify format: ${result.error.message}`,
      } as VerifyParseResult;
      return failureResponse;
    }
    const issuesValue: Array<Issue> = result.data.issues;
    const feedbackValue: string = result.data.passed
      ? ""
      : JSON.stringify(issuesValue, null, 2);
    const successResponse: VerifyParseResult = {
      ok: true,
      data: { passed: result.data.passed, feedback: feedbackValue },
    } as VerifyParseResult;
    return successResponse;
  } catch {
    const errorResponse: VerifyParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as VerifyParseResult;
    return errorResponse;
  }
}

function parseFinalVerify(raw: string): FinalVerifyParseResult {
  try {
    const parsed = JSON.parse(raw);
    const result = finalVerificationSchema.safeParse(parsed);
    if (!result.success) {
      const failureResponse: FinalVerifyParseResult = {
        ok: false,
        error: `Invalid final verify format: ${result.error.message}`,
      } as FinalVerifyParseResult;
      return failureResponse;
    }
    const feedbackValue: string = result.data.feedback;
    const successResponse: FinalVerifyParseResult = {
      ok: true,
      data: { passed: result.data.passed, feedback: feedbackValue },
    } as FinalVerifyParseResult;
    return successResponse;
  } catch {
    const errorResponse: FinalVerifyParseResult = {
      ok: false,
      error: `Response is not valid JSON: ${raw.slice(0, 100)}`,
    } as FinalVerifyParseResult;
    return errorResponse;
  }
}

const PARSE_REGISTRY: Record<ParseKey, ParseFn> = {
  prd: parsePrd,
  analysis: parseAnalysis,
  clarifications: parseClarifications,
  plan: parsePlan,
  microplan: parseMicroplan,
  implementation: parseImplementation,
  verify: parseVerify,
  finalVerify: parseFinalVerify,
};

export function resolveParseFn(key: ParseKey): ParseFn {
  const fn: ParseFn = PARSE_REGISTRY[key];
  return fn;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type MessageRole = "user" | "assistant" | "system";

export type SerializableMessage = {
  role: MessageRole;
  content: string;
};

// Helper: "last write wins" reducer
function lastValue<T>(_prev: T, next: T): T {
  return next;
}

// Input — caller provides these
export const AgentRetryInput = Annotation.Root({
  projectDir: Annotation<string>(),
  initialMessage: Annotation<string>(),
  parseKey: Annotation<ParseKey>(),
  maxInSessionAttempts: Annotation<number>(),
  maxSessionAttempts: Annotation<number>(),
});

// Full state — input fields + internal tracking fields
export const AgentRetryAnnotation = Annotation.Root({
  // Input fields
  projectDir: Annotation<string>(),
  initialMessage: Annotation<string>(),
  parseKey: Annotation<ParseKey>(),
  maxInSessionAttempts: Annotation<number>(),
  maxSessionAttempts: Annotation<number>(),

  // Internal tracking
  conversationHistory: Annotation<Array<SerializableMessage>>({
    reducer: lastValue,
    default: (): Array<SerializableMessage> => [] as Array<SerializableMessage>,
  }),
  rawOutput: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),
  lastError: Annotation<string>({
    reducer: lastValue,
    default: (): string => "",
  }),
  inSessionAttempts: Annotation<number>({
    reducer: lastValue,
    default: (): number => 0,
  }),
  sessionAttempts: Annotation<number>({
    reducer: lastValue,
    default: (): number => 0,
  }),

  // Output
  result: Annotation<ParsedOutput | null>({
    reducer: lastValue,
    default: (): null => null,
  }),
});

export type AgentRetryState = typeof AgentRetryAnnotation.State;

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type ValidationRoute = "handleRepeat" | "__end__";
export type HandleRepeatRoute =
  | "appendCorrection"
  | "resetSession"
  | "exhausted";

export function routeAfterValidation(state: AgentRetryState): ValidationRoute {
  let route: ValidationRoute;
  if (state.result !== null) {
    route = "__end__";
  } else {
    route = "handleRepeat";
  }
  return route;
}

export function routeAfterHandleRepeat(
  state: AgentRetryState,
): HandleRepeatRoute {
  let route: HandleRepeatRoute;
  if (state.inSessionAttempts < state.maxInSessionAttempts) {
    route = "appendCorrection";
  } else if (state.sessionAttempts < state.maxSessionAttempts) {
    route = "resetSession";
  } else {
    route = "exhausted";
  }
  return route;
}
