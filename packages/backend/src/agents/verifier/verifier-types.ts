export type VerifierOutput = {
  success: NonNullable<boolean>;
  failureDescription?: string | null | undefined;
};

export type VerifierState = {
  output: VerifierOutput | null | undefined;
};
