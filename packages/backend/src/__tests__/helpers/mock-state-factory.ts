import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";

type DeepPartialMainPipelineState = {
  [K in keyof MainPipelineState]?: MainPipelineState[K] extends object
    ? Partial<MainPipelineState[K]>
    : MainPipelineState[K];
};

function getDefaultState(): NonNullable<MainPipelineState> {
  const state: NonNullable<MainPipelineState> = {
    assignment: "Test assignment",
    projectDir: "/tmp/test-project",
    buildCommand: null,
    finalVerifierEnabled: true,

    invokeAgentState: {
      input: { conversationHistory: null, userMessage: "" },
      output: null,
      internal: {
        succeeded: null,
        errorMessage: null,
        currentSessionAttempt: null,
        currentInSessionAttempt: null,
      },
    },

    prdGeneratorState: {
      output: { prd: "", clarifications: null },
    },

    prdAnalyzerState: { output: null },

    answerClarificationsState: {
      output: null,
      internal: { clarificationRound: 0 },
    },

    plannerState: { output: null },

    controllerState: {
      output: null,
      internal: {
        currentTaskIndex: 0,
        builderAttempts: 0,
        verifierAttempts: 0,
        allTasksDone: false,
        cycleCount: 0,
        lastBuilderOutputCycle: -1,
        lastVerifierOutputCycle: -1,
      },
    },

    implementerState: { output: null },
    builderState: { output: null },
    verifierState: { output: null },
    finalVerifierState: { output: null },
  };
  return state;
}

export function createMockState(overrides?: NonNullable<DeepPartialMainPipelineState>): NonNullable<MainPipelineState> {
  const base: NonNullable<MainPipelineState> = getDefaultState();

  if (!overrides) {
    return base;
  }

  for (const key of Object.keys(overrides) as NonNullable<Array<keyof MainPipelineState>>) {
    const overrideValue: unknown = overrides[key];
    if (overrideValue === null || overrideValue === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (base as any)[key] = overrideValue;
    } else if (typeof overrideValue === "object" && typeof base[key] === "object" && base[key] !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (base as any)[key] = { ...(base[key] as any), ...(overrideValue as any) };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (base as any)[key] = overrideValue;
    }
  }

  return base;
}
