import * as Langgraph from "@langchain/langgraph";
import * as Util from "../shared/util";
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
    reducer: Util.lastValue,
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
    reducer: Util.lastValue,
    default: (): NonNullable<PrdGeneratorState> => ({
      output: { prd: "", clarifications: null },
    }),
  }),

  prdAnalyzerState: Langgraph.Annotation<PrdAnalyzerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<PrdAnalyzerState> => ({
      output: null,
    }),
  }),

  answerClarificationsState: Langgraph.Annotation<AnswerClarificationsState>({
    reducer: Util.lastValue,
    default: (): NonNullable<AnswerClarificationsState> => ({
      output: null,
      internal: { clarificationRound: 0 },
    }),
  }),

  plannerState: Langgraph.Annotation<PlannerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<PlannerState> => ({
      output: null,
    }),
  }),

  controllerState: Langgraph.Annotation<ControllerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<ControllerState> => ({
      output: null,
      internal: {
        currentTaskIndex: 0,
        builderAttempts: 0,
        verifierAttempts: 0,
        allTasksDone: false,
        cycleCount: 0,
        lastBuilderOutputCycle: -1,
        lastVerifierOutputCycle: -1,
      },
    }),
  }),

  implementerState: Langgraph.Annotation<ImplementerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<ImplementerState> => ({
      output: null,
    }),
  }),

  builderState: Langgraph.Annotation<BuilderState>({
    reducer: Util.lastValue,
    default: (): NonNullable<BuilderState> => ({
      output: null,
    }),
  }),

  verifierState: Langgraph.Annotation<VerifierState>({
    reducer: Util.lastValue,
    default: (): NonNullable<VerifierState> => ({
      output: null,
    }),
  }),

  finalVerifierState: Langgraph.Annotation<FinalVerifierState>({
    reducer: Util.lastValue,
    default: (): NonNullable<FinalVerifierState> => ({
      output: null,
    }),
  }),
});
