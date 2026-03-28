export type MicroplannerOutput = {
  microPlan: NonNullable<string>;
  existingPatternsToReuse: NonNullable<Array<string>>;
  filesToReference: NonNullable<Array<string>>;
};

export type MicroplannerState = {
  output: MicroplannerOutput | null | undefined;
};
