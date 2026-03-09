export type BuilderOutput = {
  success: NonNullable<boolean>;
  errorOutput: string | null | undefined;
};

export type BuilderState = {
  output: BuilderOutput | null | undefined;
};
