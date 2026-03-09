export type FinalVerifierOutput = {
  success: NonNullable<boolean>;
  problems: NonNullable<Array<string>>;
  suggestedFollowUpPrompt?: string | null | undefined;
};

export type FinalVerifierState = {
  output: FinalVerifierOutput | null | undefined;
};
