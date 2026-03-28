import { type MainPipelineState, type ClarifyingQuestions } from "../../main-pipeline-graph/main-pipeline-types";
import { type PrdAnalyzerOutput } from "../../agents/prd-analyzer/prd-analyzer-types";
import { type TechnicalPrdAnalyzerOutput } from "../../agents/technical-prd-analyzer/technical-prd-analyzer-types";
import { type AnalysisMode } from "../../shared/agent-config-types";
import {
  type AnalysisControllerOutput,
  type AnalysisControllerRoute,
  type AnalysisPhase,
  type AnalysisControllerInternal,
} from "./analysis-controller-types";
import * as Util from "../../shared/util";

function applyOutput(
  state: NonNullable<MainPipelineState>,
  prd: NonNullable<string>,
  clarifications: ClarifyingQuestions | null | undefined,
  questions: NonNullable<Array<string>>,
  nextTarget: NonNullable<AnalysisControllerRoute>
): NonNullable<Partial<MainPipelineState>> {
  const output: NonNullable<AnalysisControllerOutput> = {
    prd: prd,
    clarifications: clarifications,
    assignment: state.assignment,
    questions: questions,
    nextTarget: nextTarget,
  };

  state.analysisControllerState.output = output;

  const update: NonNullable<Partial<MainPipelineState>> = {
    analysisControllerState: state.analysisControllerState,
  };
  return update;
}

export function analysisControllerNode(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const internal: NonNullable<AnalysisControllerInternal> = state.analysisControllerState.internal;

  // -----------------------------------------------------------------------
  // First invocation: route to PRD generator
  // -----------------------------------------------------------------------

  if (!internal.prdGenerated) {
    internal.prdGenerated = true;
    internal.currentPhase = "prdGeneration" as NonNullable<AnalysisPhase>;

    const firstUpdate: NonNullable<Partial<MainPipelineState>> = applyOutput(
      state,
      "",
      state.answerClarificationsState.output?.clarifications ?? null,
      [],
      "prdGeneratorGraph" as NonNullable<AnalysisControllerRoute>
    );
    return firstUpdate;
  }

  // -----------------------------------------------------------------------
  // After PRD generation: collect the PRD from prdGeneratorState
  // -----------------------------------------------------------------------

  const prd: NonNullable<string> = state.prdGeneratorState.output.prd;
  const clarifications: ClarifyingQuestions | null | undefined =
    state.answerClarificationsState.output?.clarifications ??
    state.businessClarificationAnswererState.output?.clarifications ??
    state.technicalClarificationAnswererState.output?.clarifications ??
    null;

  // -----------------------------------------------------------------------
  // Phase: businessAnalysis
  // -----------------------------------------------------------------------

  if (internal.currentPhase === "prdGeneration" || internal.currentPhase === "businessAnalysis") {
    const businessMode: NonNullable<AnalysisMode> = state.businessClarificationsMode;

    if (businessMode !== "disabled") {
      // If we haven't entered business analysis yet, route to the business analyzer
      if (internal.currentPhase === "prdGeneration") {
        internal.currentPhase = "businessAnalysis" as NonNullable<AnalysisPhase>;

        const toAnalyzerUpdate: NonNullable<Partial<MainPipelineState>> = applyOutput(
          state,
          prd,
          clarifications,
          [],
          "prdAnalyzerGraph" as NonNullable<AnalysisControllerRoute>
        );
        return toAnalyzerUpdate;
      }

      // We are in businessAnalysis phase — check analyzer result
      const analyzerOutput: PrdAnalyzerOutput | null | undefined = state.prdAnalyzerState.output;

      if (Util.isNotNullOrUndf(analyzerOutput) && analyzerOutput.needsClarification) {
        const businessRoundLimitReached: NonNullable<boolean> =
          internal.businessRound >= state.businessClarificationRounds;

        if (!businessRoundLimitReached) {
          internal.businessRound++;

          let businessNextTarget: NonNullable<AnalysisControllerRoute>;
          if (businessMode === "interactive") {
            businessNextTarget = "answerClarificationsNode" as NonNullable<AnalysisControllerRoute>;
          } else {
            businessNextTarget = "businessClarificationAnswererGraph" as NonNullable<AnalysisControllerRoute>;
          }

          const businessClarUpdate: NonNullable<Partial<MainPipelineState>> = applyOutput(
            state,
            prd,
            clarifications,
            analyzerOutput.questions,
            businessNextTarget
          );
          return businessClarUpdate;
        }
      }
    }

    // Business analysis done (or disabled) — advance to technical
    internal.currentPhase = "technicalAnalysis" as NonNullable<AnalysisPhase>;
  }

  // -----------------------------------------------------------------------
  // Phase: technicalAnalysis
  // -----------------------------------------------------------------------

  if (internal.currentPhase === "technicalAnalysis") {
    const technicalMode: NonNullable<AnalysisMode> = state.technicalClarificationsMode;

    if (technicalMode !== "disabled") {
      // Check if we need to route to the technical analyzer first
      const technicalAnalyzerOutput: TechnicalPrdAnalyzerOutput | null | undefined =
        state.technicalPrdAnalyzerState.output;

      if (!Util.isNotNullOrUndf(technicalAnalyzerOutput)) {
        // Haven't run technical analyzer yet — route to it
        const toTechAnalyzerUpdate: NonNullable<Partial<MainPipelineState>> = applyOutput(
          state,
          prd,
          clarifications,
          [],
          "technicalPrdAnalyzerGraph" as NonNullable<AnalysisControllerRoute>
        );
        return toTechAnalyzerUpdate;
      }

      // Technical analyzer has run — check if clarification is needed
      if (technicalAnalyzerOutput.needsClarification) {
        const technicalRoundLimitReached: NonNullable<boolean> =
          internal.technicalRound >= state.technicalClarificationRounds;

        if (!technicalRoundLimitReached) {
          internal.technicalRound++;

          let technicalNextTarget: NonNullable<AnalysisControllerRoute>;
          if (technicalMode === "interactive") {
            technicalNextTarget = "answerClarificationsNode" as NonNullable<AnalysisControllerRoute>;
          } else {
            technicalNextTarget = "technicalClarificationAnswererGraph" as NonNullable<AnalysisControllerRoute>;
          }

          const techClarUpdate: NonNullable<Partial<MainPipelineState>> = applyOutput(
            state,
            prd,
            clarifications,
            technicalAnalyzerOutput.questions,
            technicalNextTarget
          );
          return techClarUpdate;
        }
      }
    }

    // Technical analysis done (or disabled) — advance to done
    internal.currentPhase = "done" as NonNullable<AnalysisPhase>;
  }

  // -----------------------------------------------------------------------
  // Phase: done — route to initial documenter (if docs enabled) or planner
  // -----------------------------------------------------------------------

  const docsEnabled: NonNullable<boolean> = state.documentationConfig?.enabled ?? false;
  const doneTarget: NonNullable<AnalysisControllerRoute> = docsEnabled
    ? ("initialDocumenterGraph" as NonNullable<AnalysisControllerRoute>)
    : ("plannerGraph" as NonNullable<AnalysisControllerRoute>);

  const doneUpdate: NonNullable<Partial<MainPipelineState>> = applyOutput(state, prd, clarifications, [], doneTarget);
  return doneUpdate;
}
