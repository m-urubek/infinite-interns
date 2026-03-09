import * as ControllerNode from "../../nodes/controller/controller-node";
import * as MockStateFactory from "../helpers/mock-state-factory";
import { type PlannerTask } from "../../agents/planner/planner-types";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";
import { type ControllerInternal } from "../../nodes/controller/controller-types";

const task1: NonNullable<PlannerTask> = {
  title: "Add user model",
  description: "Create user model with fields",
  relevantFiles: ["src/models/user.ts"],
};

const task2: NonNullable<PlannerTask> = {
  title: "Add auth middleware",
  description: "Create auth middleware",
  relevantFiles: ["src/middleware/auth.ts"],
};

const task3: NonNullable<PlannerTask> = {
  title: "Add routes",
  description: "Create API routes",
  relevantFiles: ["src/routes/index.ts"],
};

function createControllerState(overrides?: NonNullable<Record<string, unknown>>): NonNullable<MainPipelineState> {
  const state: NonNullable<MainPipelineState> = MockStateFactory.createMockState({
    plannerState: {
      output: {
        tasks: [task1, task2],
        buildCommand: "npm run build",
      },
    },
    prdAnalyzerState: {
      output: {
        needsClarification: false,
        questions: [],
        confidence: 9,
        reasoning: "All clear",
        prd: "Test PRD content",
        clarifications: null,
      },
    },
    ...overrides,
  });
  return state;
}

describe("controllerNode", () => {
  it("sets up first task with isCorrection=false when no prior outputs exist", () => {
    const state: NonNullable<MainPipelineState> = createControllerState();
    const result = ControllerNode.controllerNode(state);

    expect(result.controllerState).toBeDefined();
    expect(result.controllerState?.output?.currentTaskIndex).toBe(0);
    expect(result.controllerState?.output?.currentTask).toEqual(task1);
    expect(result.controllerState?.output?.isCorrection).toBe(false);
    expect(result.controllerState?.output?.correctionError).toBeNull();
    expect(result.controllerState?.output?.buildCommand).toBe("npm run build");
    expect(result.controllerState?.output?.prd).toBe("Test PRD content");
  });

  it("advances to next task when verifier reports success", () => {
    const state: NonNullable<MainPipelineState> = createControllerState({
      verifierState: { output: { success: true, failureDescription: null } },
    });
    const result = ControllerNode.controllerNode(state);
    const internal: ControllerInternal | null | undefined = result.controllerState?.internal;

    expect(internal?.currentTaskIndex).toBe(1);
    expect(internal?.builderAttempts).toBe(0);
    expect(internal?.verifierAttempts).toBe(0);
    expect(result.controllerState?.output?.currentTask).toEqual(task2);
    expect(result.controllerState?.output?.isCorrection).toBe(false);
  });

  it("sets up correction when verifier reports failure", () => {
    const state: NonNullable<MainPipelineState> = createControllerState({
      verifierState: { output: { success: false, failureDescription: "Missing edge case" } },
    });
    const result = ControllerNode.controllerNode(state);
    const internal: ControllerInternal | null | undefined = result.controllerState?.internal;

    expect(internal?.verifierAttempts).toBe(1);
    expect(result.controllerState?.output?.isCorrection).toBe(true);
    expect(result.controllerState?.output?.correctionError).toContain("Verification failed");
    expect(result.controllerState?.output?.correctionError).toContain("Missing edge case");
  });

  it("sets up correction when builder reports failure", () => {
    const state: NonNullable<MainPipelineState> = createControllerState({
      builderState: { output: { success: false, errorOutput: "Type error on line 5" } },
    });
    const result = ControllerNode.controllerNode(state);
    const internal: ControllerInternal | null | undefined = result.controllerState?.internal;

    expect(internal?.builderAttempts).toBe(1);
    expect(result.controllerState?.output?.isCorrection).toBe(true);
    expect(result.controllerState?.output?.correctionError).toContain("Build failed");
    expect(result.controllerState?.output?.correctionError).toContain("Type error on line 5");
  });

  it("throws when verifier retry limit is reached", () => {
    const state: NonNullable<MainPipelineState> = createControllerState({
      verifierState: { output: { success: false, failureDescription: "still failing" } },
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 0,
          builderAttempts: 0,
          verifierAttempts: 6,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });

    expect(() => ControllerNode.controllerNode(state)).toThrow("Verifier retry limit");
  });

  it("throws when builder retry limit is reached", () => {
    const state: NonNullable<MainPipelineState> = createControllerState({
      builderState: { output: { success: false, errorOutput: "persistent error" } },
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 0,
          builderAttempts: 6,
          verifierAttempts: 0,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });

    expect(() => ControllerNode.controllerNode(state)).toThrow("Builder retry limit");
  });

  it("sets allTasksDone when all tasks are completed", () => {
    const state: NonNullable<MainPipelineState> = createControllerState({
      verifierState: { output: { success: true, failureDescription: null } },
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 1,
          builderAttempts: 0,
          verifierAttempts: 0,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result = ControllerNode.controllerNode(state);
    const internal: ControllerInternal | null | undefined = result.controllerState?.internal;

    expect(internal?.allTasksDone).toBe(true);
  });

  it("builds correct task summary with numbered list", () => {
    const state: NonNullable<MainPipelineState> = MockStateFactory.createMockState({
      plannerState: {
        output: {
          tasks: [task1, task2, task3],
          buildCommand: "npm run build",
        },
      },
      prdAnalyzerState: {
        output: {
          needsClarification: false,
          questions: [],
          confidence: 9,
          reasoning: "All clear",
          prd: "Test PRD",
          clarifications: null,
        },
      },
    });
    const result = ControllerNode.controllerNode(state);

    expect(result.controllerState?.output?.allTasksSummary).toBe(
      "1. Add user model\n2. Add auth middleware\n3. Add routes"
    );
  });

  it("does not re-process builder output that was already consumed in a prior cycle", () => {
    // Simulate: builder output was consumed in cycle 1, now we are on cycle 2
    const state: NonNullable<MainPipelineState> = createControllerState({
      builderState: { output: { success: false, errorOutput: "stale error" } },
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 0,
          builderAttempts: 1,
          verifierAttempts: 0,
          allTasksDone: false,
          cycleCount: 1,
          lastBuilderOutputCycle: 1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result = ControllerNode.controllerNode(state);
    const internal: ControllerInternal | null | undefined = result.controllerState?.internal;

    // builderAttempts should NOT increment since the output was already consumed
    expect(internal?.builderAttempts).toBe(1);
    expect(result.controllerState?.output?.isCorrection).toBe(false);
  });
});
