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

import * as MicroplannerGraph from "../../agents/microplanner/microplanner-graph";

describe("microplannerGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores microPlan, patterns, and files in microplannerState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        microPlan: "Step 1: Read user model. Step 2: Add validation.",
        existingPatternsToReuse: ["Zod validation in src/schemas/", "Error handling in src/utils/errors.ts"],
        filesToReference: ["src/models/base.ts", "src/schemas/user.ts"],
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

    const result = await MicroplannerGraph.microplannerGraph.invoke(state);

    expect(result.microplannerState.output?.microPlan).toBe("Step 1: Read user model. Step 2: Add validation.");
    expect(result.microplannerState.output?.existingPatternsToReuse).toHaveLength(2);
    expect(result.microplannerState.output?.filesToReference).toHaveLength(2);
    expect(result.microplannerState.output?.filesToReference[0]).toBe("src/models/base.ts");
  });

  it("includes task description and PRD in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        microPlan: "Plan",
        existingPatternsToReuse: [],
        filesToReference: [],
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      controllerState: {
        output: {
          currentTaskIndex: 1,
          currentTask: {
            title: "Add auth middleware",
            description: "Create JWT auth middleware",
            relevantFiles: ["src/middleware/auth.ts"],
          },
          buildCommand: "npm run build",
          prd: "Auth PRD content",
          allTasksSummary: "1. Add user model\n2. Add auth middleware",
          isCorrection: false,
          correctionError: null,
        },
        internal: {
          currentTaskIndex: 1,
          failedAttempts: 0,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });

    await MicroplannerGraph.microplannerGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Create JWT auth middleware");
    expect(userMessage).toContain("Auth PRD content");
    expect(userMessage).toContain("npm run build");
    expect(userMessage).toContain("task #2");
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

    await expect(MicroplannerGraph.microplannerGraph.invoke(state)).rejects.toThrow(
      "Controller output is null or undefined"
    );
  });
});
