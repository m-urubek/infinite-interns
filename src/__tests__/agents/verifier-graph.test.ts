import { type InvokeAgentInternalOutput } from "../../invoke-agent-graph/invoke-agent-internal-utility";
import * as MockStateFactory from "../helpers/mock-state-factory";

vi.mock("../../shared/gemini-flash-model.js", () => ({
  geminiFlashLLMMedium: {},
}));

vi.mock("../../backends/read-only-shell-backend.js", () => ({
  ReadOnlyShellBackend: class {
    constructor() {}
  },
}));

const invokeAgentMock = vi.fn();

vi.mock("../../invoke-agent-graph/invoke-agent-internal-utility.js", () => ({
  invokeAgent: (...args: NonNullable<Array<unknown>>) => invokeAgentMock(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("../../shared/shared-utility.js", async (): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual("../../shared/shared-utility.js");
  const mod = {
    ...actual,
    sleep: () => Promise.resolve(),
  };
  return mod;
});

import * as VerifierGraph from "../../agents/verifier/verifier-graph";

describe("verifierGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("outputs success=true when verification passes", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { success: true },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: {
            title: "Add user model",
            description: "Create user model",
            relevantFiles: ["src/models/user.ts"],
          },
          buildCommand: "npm run build",
          prd: "Test PRD",
          allTasksSummary: "1. Add user model",
          isCorrection: false,
          correctionError: null,
        },
        internal: { currentTaskIndex: 0, builderAttempts: 0, verifierAttempts: 0, allTasksDone: false },
      },
    });

    const result = await VerifierGraph.verifierGraph.invoke(state);

    expect(result.verifierState.output?.success).toBe(true);
  });

  it("outputs failure with description when verification fails", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { success: false, failureDescription: "Missing input validation for email field" },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: {
            title: "Add user model",
            description: "Create user model",
            relevantFiles: ["src/models/user.ts"],
          },
          buildCommand: "npm run build",
          prd: "Test PRD",
          allTasksSummary: "1. Add user model",
          isCorrection: false,
          correctionError: null,
        },
        internal: { currentTaskIndex: 0, builderAttempts: 0, verifierAttempts: 0, allTasksDone: false },
      },
    });

    const result = await VerifierGraph.verifierGraph.invoke(state);

    expect(result.verifierState.output?.success).toBe(false);
    expect(result.verifierState.output?.failureDescription).toBe("Missing input validation for email field");
  });
});
