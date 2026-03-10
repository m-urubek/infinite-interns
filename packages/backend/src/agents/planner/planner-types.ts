export type PlannerTask = {
  title: NonNullable<string>;
  description: NonNullable<string>;
  relevantFiles: NonNullable<Array<string>>;
};

export type PlannerOutput = {
  tasks: NonNullable<Array<PlannerTask>>;
  buildCommand: NonNullable<string>;
};

export type PlannerState = {
  output: PlannerOutput | null | undefined;
};
