export type InitialDocumenterOutput = {
  filesCreated: NonNullable<Array<string>>;
  filesModified: NonNullable<Array<string>>;
  summary: NonNullable<string>;
};

export type InitialDocumenterState = {
  output: InitialDocumenterOutput | null | undefined;
};
