export type TestsGeneratorOutput = {
  testsAdded: NonNullable<boolean>;
  testFiles: NonNullable<Array<string>>;
  summary: NonNullable<string>;
};

export type TestsGeneratorState = {
  output: TestsGeneratorOutput | null | undefined;
};
