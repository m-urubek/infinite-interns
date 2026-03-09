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
vi.mock("../../shared/util.js", async (): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual("../../shared/util.js");
  const mod = {
    ...actual,
    sleep: () => Promise.resolve(),
  };
  return mod;
});

import * as FinalVerifierGraph from "../../agents/final-verifier/final-verifier-graph";

describe("finalVerifierGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("outputs success with empty problems array", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { success: true, problems: [] },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build an app",
      prdAnalyzerState: {
        output: {
          needsClarification: false,
          questions: [],
          confidence: 9,
          reasoning: "Complete",
          prd: "Final PRD",
          clarifications: null,
        },
      },
    });

    const result = await FinalVerifierGraph.finalVerifierGraph.invoke(state);

    expect(result.finalVerifierState.output?.success).toBe(true);
    expect(result.finalVerifierState.output?.problems).toHaveLength(0);
  });

  it("outputs failure with problems and suggested follow-up", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        success: false,
        problems: ["Missing error handling in API routes", "No unit tests for user model"],
        suggestedFollowUpPrompt: "Add error handling to all API routes and write unit tests for the user model",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build an app",
      prdAnalyzerState: {
        output: {
          needsClarification: false,
          questions: [],
          confidence: 9,
          reasoning: "Complete",
          prd: "Final PRD",
          clarifications: null,
        },
      },
    });

    const result = await FinalVerifierGraph.finalVerifierGraph.invoke(state);

    expect(result.finalVerifierState.output?.success).toBe(false);
    expect(result.finalVerifierState.output?.problems).toHaveLength(2);
    expect(result.finalVerifierState.output?.problems[0]).toBe("Missing error handling in API routes");
    expect(result.finalVerifierState.output?.suggestedFollowUpPrompt).toContain("Add error handling");
  });
});
