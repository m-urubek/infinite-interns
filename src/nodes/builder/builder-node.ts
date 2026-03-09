import * as ChildProcess from "node:child_process";
import * as Util from "node:util";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";
import { type PlannerOutput } from "../../agents/planner/planner-types";

const execAsync = Util.promisify(ChildProcess.exec);

const BUILD_TIMEOUT_MS: NonNullable<number> = 300_000;
const MAX_ERROR_OUTPUT_LENGTH: NonNullable<number> = 4000;

function truncateErrorOutput(output: NonNullable<string>): NonNullable<string> {
  if (output.length <= MAX_ERROR_OUTPUT_LENGTH) {
    return output;
  }
  const truncated: NonNullable<string> = output.slice(-MAX_ERROR_OUTPUT_LENGTH);
  const result: NonNullable<string> = `...[truncated, showing last ${MAX_ERROR_OUTPUT_LENGTH.toString()} chars]...\n${truncated}`;
  return result;
}

export async function builderNode(
  state: NonNullable<MainPipelineState>
): NonNullable<Promise<Partial<MainPipelineState>>> {
  const plannerOutput: NonNullable<PlannerOutput> =
    state.plannerState.output ??
    (() => {
      throw new Error("Planner output is null or undefined");
    })();

  const buildCommand: NonNullable<string> = plannerOutput.buildCommand;
  const projectDir: NonNullable<string> = state.projectDir;

  try {
    await execAsync(buildCommand, {
      cwd: projectDir,
      timeout: BUILD_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    });

    state.builderState.output = { success: true, errorOutput: null };
  } catch (error: unknown) {
    const execError: NonNullable<Error & { stdout?: string | null | undefined; stderr?: string | null | undefined }> =
      error as NonNullable<Error & { stdout?: string | null | undefined; stderr?: string | null | undefined }>;

    const combinedOutput: NonNullable<string> = [execError.stderr, execError.stdout, execError.message]
      .filter(Boolean)
      .join("\n");
    const truncated: NonNullable<string> = truncateErrorOutput(combinedOutput);

    state.builderState.output = { success: false, errorOutput: truncated };
  }

  const update: NonNullable<Partial<MainPipelineState>> = {
    builderState: state.builderState,
  };
  return update;
}
