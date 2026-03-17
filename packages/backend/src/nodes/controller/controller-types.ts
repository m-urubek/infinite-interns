import { type PlannerTask } from "../../agents/planner/planner-types";

export type ControllerOutput = {
  currentTaskIndex: NonNullable<number>;
  currentTask: NonNullable<PlannerTask>;
  buildCommand: NonNullable<string>;
  prd: NonNullable<string>;
  allTasksSummary: NonNullable<string>;
  isCorrection: NonNullable<boolean>;
  correctionError: string | null | undefined;
};

export type ControllerInternal = {
  currentTaskIndex: NonNullable<number>;
  /**
   * Unified failed-attempt counter for the current task.
   * Both build failures and verification failures increment this counter.
   * Resets to 0 when a task succeeds (verifier passes → advance to next task).
   */
  failedAttempts: NonNullable<number>;
  allTasksDone: NonNullable<boolean>;
  cycleCount: NonNullable<number>;
  lastBuilderOutputCycle: NonNullable<number>;
  lastVerifierOutputCycle: NonNullable<number>;
};

export type ControllerState = {
  output: ControllerOutput | null | undefined;
  internal: NonNullable<ControllerInternal>;
};
