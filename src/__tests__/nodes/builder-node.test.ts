import * as MockStateFactory from "../helpers/mock-state-factory";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";

type ExecCallback = (error: Error | null | undefined, result: { stdout: string; stderr: string }) => void;

let execMockImpl: (
  command: NonNullable<string>,
  options: NonNullable<Record<string, unknown>>,
  callback: NonNullable<ExecCallback>
) => void;

vi.mock("node:child_process", () => ({
  exec: (
    command: NonNullable<string>,
    options: NonNullable<Record<string, unknown>>,
    callback: NonNullable<ExecCallback>
  ) => {
    execMockImpl(command, options, callback);
  },
}));

// Must import after vi.mock
// eslint-disable-next-line local/enforce-namespace-imports
import { builderNode } from "../../nodes/builder/builder-node";

function createBuilderState(buildCommand: NonNullable<string> = "npm run build"): NonNullable<MainPipelineState> {
  const state: NonNullable<MainPipelineState> = MockStateFactory.createMockState({
    plannerState: {
      output: {
        tasks: [{ title: "Task 1", description: "Do something", relevantFiles: [] }],
        buildCommand: buildCommand,
      },
    },
  });
  return state;
}

describe("builderNode", () => {
  it("returns success when build command succeeds", async (): Promise<void> => {
    execMockImpl = (_cmd: string, _opts: Record<string, unknown>, callback: ExecCallback) => {
      callback(null, { stdout: "Build complete", stderr: "" });
    };

    const state: NonNullable<MainPipelineState> = createBuilderState();
    const result = await builderNode(state);

    expect(result.builderState?.output?.success).toBe(true);
    expect(result.builderState?.output?.errorOutput).toBeNull();
  });

  it("returns failure with error output when build fails", async (): Promise<void> => {
    execMockImpl = (
      _cmd: NonNullable<string>,
      _opts: NonNullable<Record<string, unknown>>,
      callback: NonNullable<ExecCallback>
    ) => {
      const err: NonNullable<Error & { stderr?: string; stdout?: string }> = new Error("Command failed");
      err.stderr = "error: type mismatch";
      err.stdout = "";
      callback(err, { stdout: "", stderr: "error: type mismatch" });
    };

    const state: NonNullable<MainPipelineState> = createBuilderState();
    const result = await builderNode(state);

    expect(result.builderState?.output?.success).toBe(false);
    expect(result.builderState?.output?.errorOutput).toContain("type mismatch");
  });

  it("truncates error output longer than 4000 characters", async (): Promise<void> => {
    const longError: NonNullable<string> = "x".repeat(5000);
    execMockImpl = (
      _cmd: NonNullable<string>,
      _opts: NonNullable<Record<string, unknown>>,
      callback: NonNullable<ExecCallback>
    ) => {
      const err: NonNullable<Error & { stderr?: string; stdout?: string }> = new Error(longError);
      err.stderr = longError;
      err.stdout = "";
      callback(err, { stdout: "", stderr: longError });
    };

    const state: NonNullable<MainPipelineState> = createBuilderState();
    const result = await builderNode(state);

    expect(result.builderState?.output?.success).toBe(false);
    const errorOutput: NonNullable<string> = result.builderState?.output?.errorOutput ?? "";
    expect(errorOutput).toContain("truncated");
    // The truncated output should be under 4200 chars (4000 + prefix)
    expect(errorOutput.length).toBeLessThan(4200);
  });

  it("passes correct projectDir and buildCommand to exec", async (): Promise<void> => {
    let capturedCommand: NonNullable<string> = "";
    let capturedCwd: NonNullable<string> = "";

    execMockImpl = (
      cmd: NonNullable<string>,
      opts: NonNullable<Record<string, unknown>>,
      callback: NonNullable<ExecCallback>
    ) => {
      capturedCommand = cmd;
      const cwd: unknown = opts["cwd"];
      capturedCwd = typeof cwd === "string" ? cwd : "";
      callback(null, { stdout: "", stderr: "" });
    };

    const state: NonNullable<MainPipelineState> = MockStateFactory.createMockState({
      projectDir: "/my/project",
      plannerState: {
        output: {
          tasks: [{ title: "Task", description: "Do", relevantFiles: [] }],
          buildCommand: "cargo build",
        },
      },
    });
    await builderNode(state);

    expect(capturedCommand).toBe("cargo build");
    expect(capturedCwd).toBe("/my/project");
  });

  it("throws when planner output is null", async (): Promise<void> => {
    const state: NonNullable<MainPipelineState> = MockStateFactory.createMockState({
      plannerState: { output: null },
    });

    await expect(builderNode(state)).rejects.toThrow("Planner output is null or undefined");
  });
});
