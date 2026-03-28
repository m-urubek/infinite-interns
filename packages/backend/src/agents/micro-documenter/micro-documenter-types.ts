export type MicroDocumenterOutput = {
  filesModified: NonNullable<Array<string>>;
  summary: NonNullable<string>;
  noChangesNeeded: NonNullable<boolean>;
};

export type MicroDocumenterState = {
  output: MicroDocumenterOutput | null | undefined;
};
