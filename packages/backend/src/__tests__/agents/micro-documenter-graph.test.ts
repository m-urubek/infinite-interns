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

import * as MicroDocumenterGraph from "../../agents/micro-documenter/micro-documenter-graph";

describe("microDocumenterGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores micro documentation results in microDocumenterState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesModified: ["docs/api.md"],
        summary: "Updated API documentation with new endpoint",
        noChangesNeeded: false,
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: {
            title: "Add user endpoint",
            description: "Create GET /users endpoint",
            relevantFiles: ["src/routes/users.ts"],
          },
          buildCommand: "npm run build",
          prd: "User API PRD",
          allTasksSummary: "1. Add user endpoint",
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

    const result = await MicroDocumenterGraph.microDocumenterGraph.invoke(state);

    expect(result.microDocumenterState.output?.filesModified).toHaveLength(1);
    expect(result.microDocumenterState.output?.noChangesNeeded).toBe(false);
    expect(result.microDocumenterState.output?.summary).toBe("Updated API documentation with new endpoint");
  });

  it("handles case when no documentation changes needed", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesModified: [],
        summary: "Config change only, no documentation updates needed",
        noChangesNeeded: true,
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
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

    const result = await MicroDocumenterGraph.microDocumenterGraph.invoke(state);

    expect(result.microDocumenterState.output?.noChangesNeeded).toBe(true);
    expect(result.microDocumenterState.output?.filesModified).toHaveLength(0);
  });

  it("includes task description and docs config in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesModified: [],
        summary: "No changes",
        noChangesNeeded: true,
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
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

    await MicroDocumenterGraph.microDocumenterGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Add feature X to module Y");
    expect(userMessage).toContain("Feature X PRD");
    expect(userMessage).toContain("docs/");
  });

  it("throws when controller output is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
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

    await expect(MicroDocumenterGraph.microDocumenterGraph.invoke(state)).rejects.toThrow(
      "Controller output is null or undefined"
    );
  });

  it("throws when documentation config is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      documentationConfig: null,
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: {
            title: "Task",
            description: "Desc",
            relevantFiles: [],
          },
          buildCommand: "npm run build",
          prd: "PRD",
          allTasksSummary: "1. Task",
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

    await expect(MicroDocumenterGraph.microDocumenterGraph.invoke(state)).rejects.toThrow(
      "Documentation config is null or undefined"
    );
  });
});
