export type FinalDocumenterOutput = {
  filesModified: NonNullable<Array<string>>;
  summary: NonNullable<string>;
};

export type FinalDocumenterState = {
  output: FinalDocumenterOutput | null | undefined;
};
