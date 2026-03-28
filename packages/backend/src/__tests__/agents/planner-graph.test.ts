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

import * as PlannerGraph from "../../agents/planner/planner-graph";

describe("plannerGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores tasks and buildCommand in plannerState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        buildCommand: "npm run build",
        tasks: [
          { title: "Add user model", description: "Create the user model", relevantFiles: ["src/models/user.ts"] },
          { title: "Add auth", description: "Create auth middleware", relevantFiles: ["src/middleware/auth.ts"] },
        ],
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build a user system",
      analysisControllerState: {
        output: {
          prd: "PRD for user system",
          clarifications: null,
          assignment: "Build a user system",
          questions: [],
          nextTarget: "plannerGraph",
        },
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await PlannerGraph.plannerGraph.invoke(state);

    expect(result.plannerState.output?.tasks).toHaveLength(2);
    expect(result.plannerState.output?.tasks[0]?.title).toBe("Add user model");
    expect(result.plannerState.output?.buildCommand).toBe("npm run build");
  });

  it("includes user-provided buildCommand in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        buildCommand: "cargo build",
        tasks: [{ title: "Task 1", description: "Do it", relevantFiles: [] }],
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build a Rust app",
      buildCommand: "cargo build",
      analysisControllerState: {
        output: {
          prd: "PRD for Rust app",
          clarifications: null,
          assignment: "Build a Rust app",
          questions: [],
          nextTarget: "plannerGraph",
        },
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    await PlannerGraph.plannerGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("cargo build");
    expect(userMessage).toContain("Use this exact command");
  });

  it("throws when analysis controller output is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: null,
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    await expect(PlannerGraph.plannerGraph.invoke(state)).rejects.toThrow(
      "Analysis controller output is null or undefined"
    );
  });
});
