export type DocumentationIndexerOutput = {
  indexContent: NonNullable<string>;
  indexPath: NonNullable<string>;
  summary: NonNullable<string>;
};

export type DocumentationIndexerState = {
  output: DocumentationIndexerOutput | null | undefined;
};
