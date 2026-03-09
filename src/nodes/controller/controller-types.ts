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
  builderAttempts: NonNullable<number>;
  verifierAttempts: NonNullable<number>;
  allTasksDone: NonNullable<boolean>;
};

export type ControllerState = {
  output: ControllerOutput | null | undefined;
  internal: NonNullable<ControllerInternal>;
};
