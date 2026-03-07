import type { FileInfo, FileData, WriteResult, EditResult } from "deepagents";
import { LocalShellBackend } from "deepagents";
import type {
  BackendProtocol,
  MaybePromise,
  GrepResult,
} from "./read-only-backend.js";

type ExecuteResponse = {
  output: string;
  exitCode: number | null;
  truncated: boolean;
};

type SandboxBackendProtocol = BackendProtocol & {
  execute(command: string): MaybePromise<ExecuteResponse>;
};

type ShellBackendOptions = {
  rootDir: string;
};

export class ReadOnlyShellBackend implements SandboxBackendProtocol {
  private inner: LocalShellBackend;

  constructor(options: ShellBackendOptions) {
    this.inner = new LocalShellBackend({
      rootDir: options.rootDir,
    });
  }

  lsInfo(path: string): MaybePromise<Array<FileInfo>> {
    const result: MaybePromise<Array<FileInfo>> = this.inner.lsInfo(path);
    return result;
  }

  read(
    filePath: string,
    offset?: number,
    limit?: number,
  ): MaybePromise<string> {
    const result: MaybePromise<string> = this.inner.read(
      filePath,
      offset,
      limit,
    );
    return result;
  }

  readRaw(filePath: string): MaybePromise<FileData> {
    const result: MaybePromise<FileData> = this.inner.readRaw(filePath);
    return result;
  }

  grepRaw(
    pattern: string,
    path?: string | null,
    glob?: string | null,
  ): MaybePromise<GrepResult> {
    const result: MaybePromise<GrepResult> = this.inner.grepRaw(
      pattern,
      path ?? undefined,
      glob ?? undefined,
    );
    return result;
  }

  globInfo(pattern: string, path?: string): MaybePromise<Array<FileInfo>> {
    const result: MaybePromise<Array<FileInfo>> = this.inner.globInfo(
      pattern,
      path,
    );
    return result;
  }

  execute(command: string): MaybePromise<ExecuteResponse> {
    const result: MaybePromise<ExecuteResponse> = this.inner.execute(command);
    return result;
  }

  write(_filePath: string, _content: string): WriteResult {
    const errorResult: WriteResult = {
      error: "Write operations are not permitted for this read-only agent",
      path: "" as string | undefined,
      filesUpdate: null,
    } as WriteResult;
    return errorResult;
  }

  edit(
    _filePath: string,
    _oldString: string,
    _newString: string,
    _replaceAll?: boolean,
  ): EditResult {
    const errorResult: EditResult = {
      error: "Edit operations are not permitted for this read-only agent",
      path: "" as string | undefined,
      filesUpdate: null,
    } as EditResult;
    return errorResult;
  }
}

export type { SandboxBackendProtocol, ExecuteResponse, ShellBackendOptions };
