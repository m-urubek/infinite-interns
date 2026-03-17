import { type InvokeAgentInternalOutput } from "../../invoke-agent-graph/invoke-agent-internal-utility";
import * as MockStateFactory from "../helpers/mock-state-factory";

vi.mock("../../shared/gemini-flash-model.js", () => ({
  geminiFlashLLMMedium: {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("deepagents", async (): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual("deepagents");
  const mod = {
    ...actual,
    LocalShellBackend: class {
      constructor() {}
    },
  };
  return mod;
});

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

import * as ImplementerGraph from "../../agents/implementer/implementer-graph";

describe("implementerGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("handles new task implementation with prd and build command in message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { summary: "Implemented user model with validation" },
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
          prd: "Full PRD document",
          allTasksSummary: "1. Add user model\n2. Add auth",
          isCorrection: false,
          correctionError: null,
        },
        internal: {
          currentTaskIndex: 0,
          failedAttempts: 0,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });

    const result = await ImplementerGraph.implementerGraph.invoke(state);

    expect(result.implementerState.output?.summary).toBe("Implemented user model with validation");

    // Verify message includes prd and task for non-correction
    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Full PRD document");
    expect(userMessage).toContain("Create user model");
    expect(userMessage).toContain("npm run build");
    expect(userMessage).toContain("other-tasks-summary");
  });

  it("handles correction path with error in message and no prd", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { summary: "Fixed type error in user model" },
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
          prd: "Full PRD",
          allTasksSummary: "1. Add user model",
          isCorrection: true,
          correctionError: "Build failed: Type error on line 5",
        },
        internal: {
          currentTaskIndex: 0,
          failedAttempts: 1,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });

    const result = await ImplementerGraph.implementerGraph.invoke(state);

    expect(result.implementerState.output?.summary).toBe("Fixed type error in user model");

    // Verify correction message includes error but not prd
    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Build failed: Type error on line 5");
    expect(userMessage).not.toContain("<prd>");
    expect(userMessage).not.toContain("other-tasks-summary");
  });
});
