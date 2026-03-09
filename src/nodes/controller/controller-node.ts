import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";
import { type PlannerOutput, type PlannerTask } from "../../agents/planner/planner-types";
import { type BuilderOutput } from "../builder/builder-types";
import { type VerifierOutput } from "../../agents/verifier/verifier-types";
import { type ControllerOutput } from "./controller-types";
import * as SharedUtility from "../../shared/shared-utility";

const MAX_BUILDER_ATTEMPTS: NonNullable<number> = 7;
const MAX_VERIFIER_ATTEMPTS: NonNullable<number> = 7;

function buildTasksSummary(tasks: NonNullable<Array<PlannerTask>>): NonNullable<string> {
  const lines: NonNullable<Array<string>> = tasks.map(
    (task: NonNullable<PlannerTask>, index: NonNullable<number>): NonNullable<string> => {
      const line: NonNullable<string> = `${(index + 1).toString()}. ${task.title}`;
      return line;
    }
  );
  const result: NonNullable<string> = lines.join("\n");
  return result;
}

export function controllerNode(state: NonNullable<MainPipelineState>): NonNullable<Partial<MainPipelineState>> {
  const plannerOutput: NonNullable<PlannerOutput> =
    state.plannerState.output ??
    (() => {
      throw new Error("Planner output is null or undefined");
    })();

  const tasks: NonNullable<Array<PlannerTask>> = plannerOutput.tasks;
  const buildCommand: NonNullable<string> = plannerOutput.buildCommand;

  const prd: NonNullable<string> =
    state.prdAnalyzerState.output?.prd ??
    (() => {
      throw new Error("PRD is null or undefined");
    })();

  const builderOutput: BuilderOutput | null | undefined = state.builderState.output;
  const verifierOutput: VerifierOutput | null | undefined = state.verifierState.output;

  // -----------------------------------------------------------------------
  // Step 1: Process the outcome from the previous cycle iteration
  // -----------------------------------------------------------------------

  if (SharedUtility.isNotNullOrUndf(verifierOutput)) {
    if (verifierOutput.success) {
      state.controllerState.internal.currentTaskIndex++;
      state.controllerState.internal.builderAttempts = 0;
      state.controllerState.internal.verifierAttempts = 0;
    } else {
      state.controllerState.internal.verifierAttempts++;
      if (state.controllerState.internal.verifierAttempts >= MAX_VERIFIER_ATTEMPTS) {
        throw new Error(
          `Verifier retry limit (${MAX_VERIFIER_ATTEMPTS.toString()}) reached for task ${state.controllerState.internal.currentTaskIndex.toString()}. Last failure: ${verifierOutput.failureDescription ?? "unknown"}`
        );
      }
    }
  } else if (SharedUtility.isNotNullOrUndf(builderOutput) && !builderOutput.success) {
    state.controllerState.internal.builderAttempts++;
    if (state.controllerState.internal.builderAttempts >= MAX_BUILDER_ATTEMPTS) {
      throw new Error(
        `Builder retry limit (${MAX_BUILDER_ATTEMPTS.toString()}) reached for task ${state.controllerState.internal.currentTaskIndex.toString()}. Last error: ${builderOutput.errorOutput ?? "unknown"}`
      );
    }
  }

  // -----------------------------------------------------------------------
  // Step 2: Check if all tasks are done
  // -----------------------------------------------------------------------

  const currentTaskIndex: NonNullable<number> = state.controllerState.internal.currentTaskIndex;

  if (currentTaskIndex >= tasks.length) {
    state.controllerState.internal.allTasksDone = true;

    state.builderState.output = null;
    state.verifierState.output = null;

    const doneUpdate: NonNullable<Partial<MainPipelineState>> = {
      controllerState: state.controllerState,
      builderState: state.builderState,
      verifierState: state.verifierState,
    };
    return doneUpdate;
  }

  // -----------------------------------------------------------------------
  // Step 3: Set up the implementer for the current task
  // -----------------------------------------------------------------------

  const currentTask: NonNullable<PlannerTask> =
    tasks[currentTaskIndex] ??
    (() => {
      throw new Error(`Task at index ${currentTaskIndex.toString()} is undefined`);
    })();

  const allTasksSummary: NonNullable<string> = buildTasksSummary(tasks);

  let isCorrection: NonNullable<boolean> = false;
  let correctionError: string | null | undefined = null;

  if (SharedUtility.isNotNullOrUndf(verifierOutput) && !verifierOutput.success) {
    isCorrection = true;
    correctionError = `Verification failed: ${verifierOutput.failureDescription ?? "unknown issue"}`;
  } else if (SharedUtility.isNotNullOrUndf(builderOutput) && !builderOutput.success) {
    isCorrection = true;
    correctionError = `Build failed:\n${builderOutput.errorOutput ?? "unknown error"}`;
  }

  const controllerOutput: NonNullable<ControllerOutput> = {
    currentTaskIndex: currentTaskIndex,
    currentTask: currentTask,
    buildCommand: buildCommand,
    prd: prd,
    allTasksSummary: allTasksSummary,
    isCorrection: isCorrection,
    correctionError: correctionError,
  };

  state.controllerState.output = controllerOutput;

  state.builderState.output = null;
  state.verifierState.output = null;

  const taskUpdate: NonNullable<Partial<MainPipelineState>> = {
    controllerState: state.controllerState,
    builderState: state.builderState,
    verifierState: state.verifierState,
  };
  return taskUpdate;
}
