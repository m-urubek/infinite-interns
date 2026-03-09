import * as Langgraph from "@langchain/langgraph";
import * as SharedUtility from "../shared/shared-utility";
import { type InvokeAgentState } from "../invoke-agent-graph/invoke-agent-types";
import { type PrdGeneratorState } from "../agents/prd-generator/prd-generator-types";
import { type PrdAnalyzerState } from "../agents/prd-analyzer/prd-analyzer-types";
import { type AnswerClarificationsState } from "../nodes/answer-clarifications/answer-clarifications-types";
import { type PlannerState } from "../agents/planner/planner-types";
import { type ControllerState } from "../nodes/controller/controller-types";
import { type ImplementerState } from "../agents/implementer/implementer-types";
import { type BuilderState } from "../nodes/builder/builder-types";
import { type VerifierState } from "../agents/verifier/verifier-types";
import { type FinalVerifierState } from "../agents/final-verifier/final-verifier-types";

export const mainPipelineInputAnnotation = Langgraph.Annotation.Root({
  assignment: Langgraph.Annotation<string>(),
  projectDir: Langgraph.Annotation<string>(),
  buildCommand: Langgraph.Annotation<string | null | undefined>(),
});

export const mainPipelineStateAnnotation = Langgraph.Annotation.Root({
  ...mainPipelineInputAnnotation.spec,

  invokeAgentState: Langgraph.Annotation<InvokeAgentState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<InvokeAgentState> => ({
      input: { conversationHistory: null, userMessage: "" },
      output: null,
      internal: {
        succeeded: null,
        errorMessage: null,
        currentSessionAttempt: null,
        currentInSessionAttempt: null,
      },
    }),
  }),

  prdGeneratorState: Langgraph.Annotation<PrdGeneratorState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<PrdGeneratorState> => ({
      output: { prd: "", clarifications: null },
    }),
  }),

  prdAnalyzerState: Langgraph.Annotation<PrdAnalyzerState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<PrdAnalyzerState> => ({
      output: null,
    }),
  }),

  answerClarificationsState: Langgraph.Annotation<AnswerClarificationsState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<AnswerClarificationsState> => ({
      output: null,
      internal: { clarificationRound: 0 },
    }),
  }),

  plannerState: Langgraph.Annotation<PlannerState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<PlannerState> => ({
      output: null,
    }),
  }),

  controllerState: Langgraph.Annotation<ControllerState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<ControllerState> => ({
      output: null,
      internal: {
        currentTaskIndex: 0,
        builderAttempts: 0,
        verifierAttempts: 0,
        allTasksDone: false,
      },
    }),
  }),

  implementerState: Langgraph.Annotation<ImplementerState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<ImplementerState> => ({
      output: null,
    }),
  }),

  builderState: Langgraph.Annotation<BuilderState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<BuilderState> => ({
      output: null,
    }),
  }),

  verifierState: Langgraph.Annotation<VerifierState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<VerifierState> => ({
      output: null,
    }),
  }),

  finalVerifierState: Langgraph.Annotation<FinalVerifierState>({
    reducer: SharedUtility.lastValue,
    default: (): NonNullable<FinalVerifierState> => ({
      output: null,
    }),
  }),
});
