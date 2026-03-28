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

import * as TestsGeneratorGraph from "../../agents/tests-generator/tests-generator-graph";

describe("testsGeneratorGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores test generation results in testsGeneratorState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        testsAdded: true,
        testFiles: ["src/__tests__/models/user.test.ts"],
        summary: "Added unit tests for user model validation",
      },
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
            description: "Create user model with validation",
            relevantFiles: ["src/models/user.ts"],
          },
          buildCommand: "npm run build",
          prd: "Full PRD document",
          allTasksSummary: "1. Add user model",
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

    const result = await TestsGeneratorGraph.testsGeneratorGraph.invoke(state);

    expect(result.testsGeneratorState.output?.testsAdded).toBe(true);
    expect(result.testsGeneratorState.output?.testFiles).toHaveLength(1);
    expect(result.testsGeneratorState.output?.testFiles[0]).toBe("src/__tests__/models/user.test.ts");
    expect(result.testsGeneratorState.output?.summary).toBe("Added unit tests for user model validation");
  });

  it("handles case when no tests are needed", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        testsAdded: false,
        testFiles: [],
        summary: "Config-only change, no tests needed",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: {
            title: "Update config",
            description: "Update environment config",
            relevantFiles: ["src/config.ts"],
          },
          buildCommand: "npm run build",
          prd: "Config PRD",
          allTasksSummary: "1. Update config",
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

    const result = await TestsGeneratorGraph.testsGeneratorGraph.invoke(state);

    expect(result.testsGeneratorState.output?.testsAdded).toBe(false);
    expect(result.testsGeneratorState.output?.testFiles).toHaveLength(0);
  });

  it("includes task description and PRD in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        testsAdded: false,
        testFiles: [],
        summary: "No tests needed",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: {
            title: "Add feature",
            description: "Add feature X to module Y",
            relevantFiles: ["src/features/x.ts"],
          },
          buildCommand: "npm run build",
          prd: "Feature X PRD",
          allTasksSummary: "1. Add feature",
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

    await TestsGeneratorGraph.testsGeneratorGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Add feature X to module Y");
    expect(userMessage).toContain("Feature X PRD");
    expect(userMessage).toContain("npm run build");
  });

  it("throws when controller output is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      controllerState: {
        output: null,
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

    await expect(TestsGeneratorGraph.testsGeneratorGraph.invoke(state)).rejects.toThrow(
      "Controller output is null or undefined"
    );
  });
});
