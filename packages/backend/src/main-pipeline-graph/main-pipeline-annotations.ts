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
import { type AnalysisControllerState } from "../nodes/analysis-controller/analysis-controller-types";
import { type TechnicalPrdAnalyzerState } from "../agents/technical-prd-analyzer/technical-prd-analyzer-types";
import { type BusinessClarificationAnswererState } from "../agents/business-clarification-answerer/business-clarification-answerer-types";
import { type TechnicalClarificationAnswererState } from "../agents/technical-clarification-answerer/technical-clarification-answerer-types";
import { type MicroplannerState } from "../agents/microplanner/microplanner-types";
import { type TestsGeneratorState } from "../agents/tests-generator/tests-generator-types";
import { type InitialDocumenterState } from "../agents/initial-documenter/initial-documenter-types";
import { type MicroDocumenterState } from "../agents/micro-documenter/micro-documenter-types";
import { type DocumentationIndexerState } from "../agents/documentation-indexer/documentation-indexer-types";
import { type FinalDocumenterState } from "../agents/final-documenter/final-documenter-types";
import {
  type AgentConfigs,
  type AnalysisMode,
  type DocumentationConfig,
  type RateLimitsConfig,
} from "../shared/agent-config-types";

export const mainPipelineInputAnnotation = Langgraph.Annotation.Root({
  assignment: Langgraph.Annotation<string>(),
  projectDir: Langgraph.Annotation<string>(),
  buildCommand: Langgraph.Annotation<string | null | undefined>(),
  finalVerifierEnabled: Langgraph.Annotation<boolean>(),
  businessClarificationRounds: Langgraph.Annotation<number>({
    reducer: Util.lastValue,
    default: (): NonNullable<number> => 5,
  }),
  technicalClarificationRounds: Langgraph.Annotation<number>({
    reducer: Util.lastValue,
    default: (): NonNullable<number> => 5,
  }),
  maxImplementationAttempts: Langgraph.Annotation<number>({
    reducer: Util.lastValue,
    default: (): NonNullable<number> => 7,
  }),
  businessClarificationsMode: Langgraph.Annotation<AnalysisMode>({
    reducer: Util.lastValue,
    default: (): NonNullable<AnalysisMode> => "interactive",
  }),
  technicalClarificationsMode: Langgraph.Annotation<AnalysisMode>({
    reducer: Util.lastValue,
    default: (): NonNullable<AnalysisMode> => "disabled",
  }),
  microplannerEnabled: Langgraph.Annotation<boolean>({
    reducer: Util.lastValue,
    default: (): NonNullable<boolean> => true,
  }),
  builderEnabled: Langgraph.Annotation<boolean>({
    reducer: Util.lastValue,
    default: (): NonNullable<boolean> => true,
  }),
  microVerifierEnabled: Langgraph.Annotation<boolean>({
    reducer: Util.lastValue,
    default: (): NonNullable<boolean> => true,
  }),
  documentationConfig: Langgraph.Annotation<DocumentationConfig | null | undefined>({
    reducer: Util.lastValue,
    default: (): null => null,
  }),
  rateLimitsConfig: Langgraph.Annotation<RateLimitsConfig | null | undefined>({
    reducer: Util.lastValue,
    default: (): null => null,
  }),
  agentConfigs: Langgraph.Annotation<AgentConfigs | null | undefined>({
    reducer: Util.lastValue,
    default: (): null => null,
  }),
});

export const mainPipelineStateAnnotation = Langgraph.Annotation.Root({
  ...mainPipelineInputAnnotation.spec,

  invokeAgentState: Langgraph.Annotation<InvokeAgentState>({
    reducer: Util.lastValue,
    default: (): NonNullable<InvokeAgentState> => ({
      input: { conversationHistory: null, userMessage: "", modelConfig: null, retryConfig: null, customRules: null },
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
        failedAttempts: 0,
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

  analysisControllerState: Langgraph.Annotation<AnalysisControllerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<AnalysisControllerState> => ({
      output: null,
      internal: {
        currentPhase: "prdGeneration",
        businessRound: 0,
        technicalRound: 0,
        prdGenerated: false,
      },
    }),
  }),

  technicalPrdAnalyzerState: Langgraph.Annotation<TechnicalPrdAnalyzerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<TechnicalPrdAnalyzerState> => ({
      output: null,
    }),
  }),

  businessClarificationAnswererState: Langgraph.Annotation<BusinessClarificationAnswererState>({
    reducer: Util.lastValue,
    default: (): NonNullable<BusinessClarificationAnswererState> => ({
      output: null,
    }),
  }),

  technicalClarificationAnswererState: Langgraph.Annotation<TechnicalClarificationAnswererState>({
    reducer: Util.lastValue,
    default: (): NonNullable<TechnicalClarificationAnswererState> => ({
      output: null,
    }),
  }),

  microplannerState: Langgraph.Annotation<MicroplannerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<MicroplannerState> => ({
      output: null,
    }),
  }),

  testsGeneratorState: Langgraph.Annotation<TestsGeneratorState>({
    reducer: Util.lastValue,
    default: (): NonNullable<TestsGeneratorState> => ({
      output: null,
    }),
  }),

  initialDocumenterState: Langgraph.Annotation<InitialDocumenterState>({
    reducer: Util.lastValue,
    default: (): NonNullable<InitialDocumenterState> => ({
      output: null,
    }),
  }),

  microDocumenterState: Langgraph.Annotation<MicroDocumenterState>({
    reducer: Util.lastValue,
    default: (): NonNullable<MicroDocumenterState> => ({
      output: null,
    }),
  }),

  documentationIndexerState: Langgraph.Annotation<DocumentationIndexerState>({
    reducer: Util.lastValue,
    default: (): NonNullable<DocumentationIndexerState> => ({
      output: null,
    }),
  }),

  finalDocumenterState: Langgraph.Annotation<FinalDocumenterState>({
    reducer: Util.lastValue,
    default: (): NonNullable<FinalDocumenterState> => ({
      output: null,
    }),
  }),
});
