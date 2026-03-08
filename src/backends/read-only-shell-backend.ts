import type { FileInfo, FileData, WriteResult, EditResult } from "deepagents";
import * as Deepagents from "deepagents";
import type { BackendProtocol, MaybePromise, GrepResult } from "./read-only-backend.js";

type ExecuteResponse = {
  output: NonNullable<string>;
  exitCode: number | null | undefined;
  truncated: boolean | null | undefined;
};

type SandboxBackendProtocol = BackendProtocol & {
  execute(command: NonNullable<string>): NonNullable<MaybePromise<ExecuteResponse>>;
};

type ShellBackendOptions = {
  rootDir: NonNullable<string>;
};

export class ReadOnlyShellBackend implements SandboxBackendProtocol {
  private inner: NonNullable<Deepagents.LocalShellBackend>;

  constructor(options: NonNullable<ShellBackendOptions>) {
    this.inner = new Deepagents.LocalShellBackend({
      rootDir: options.rootDir,
    });
  }

  lsInfo(path: NonNullable<string>): NonNullable<MaybePromise<Array<FileInfo>>> {
    const result: NonNullable<MaybePromise<Array<FileInfo>>> = this.inner.lsInfo(path) as NonNullable<
      MaybePromise<Array<FileInfo>>
    >;
    return result;
  }

  read(
    filePath: NonNullable<string>,
    offset?: number | null | undefined,
    limit?: number | null | undefined
  ): NonNullable<MaybePromise<string>> {
    const result: NonNullable<MaybePromise<string>> = this.inner.read(
      filePath,
      offset ?? undefined,
      limit ?? undefined
    ) as NonNullable<MaybePromise<string>>;
    return result;
  }

  readRaw(filePath: NonNullable<string>): NonNullable<MaybePromise<FileData>> {
    const result: NonNullable<MaybePromise<FileData>> = this.inner.readRaw(filePath) as NonNullable<
      MaybePromise<FileData>
    >;
    return result;
  }

  grepRaw(
    pattern: NonNullable<string>,
    path?: string | null | undefined,
    glob?: string | null | undefined
  ): NonNullable<MaybePromise<GrepResult>> {
    const result: NonNullable<MaybePromise<GrepResult>> = this.inner.grepRaw(
      pattern,
      path ?? undefined,
      glob ?? undefined
    ) as NonNullable<MaybePromise<GrepResult>>;
    return result;
  }

  globInfo(pattern: NonNullable<string>, path?: string | null | undefined): NonNullable<MaybePromise<Array<FileInfo>>> {
    const result: NonNullable<MaybePromise<Array<FileInfo>>> = this.inner.globInfo(
      pattern,
      path ?? undefined
    ) as NonNullable<MaybePromise<Array<FileInfo>>>;
    return result;
  }

  execute(command: NonNullable<string>): NonNullable<MaybePromise<ExecuteResponse>> {
    const result: NonNullable<MaybePromise<ExecuteResponse>> = this.inner.execute(command) as NonNullable<
      MaybePromise<ExecuteResponse>
    >;
    return result;
  }

  write(_filePath: NonNullable<string>, _content: NonNullable<string>): NonNullable<MaybePromise<WriteResult>> {
    const errorResult: NonNullable<MaybePromise<WriteResult>> = {
      error: "Write operations are not permitted for this read-only agent",
      path: "" as NonNullable<string> | null | undefined,
      filesUpdate: null,
    } as NonNullable<MaybePromise<WriteResult>>;
    return errorResult;
  }

  edit(
    _filePath: NonNullable<string>,
    _oldString: NonNullable<string>,
    _newString: NonNullable<string>,
    _replaceAll?: boolean | null | undefined
  ): NonNullable<MaybePromise<EditResult>> {
    const errorResult: NonNullable<MaybePromise<EditResult>> = {
      error: "Edit operations are not permitted for this read-only agent",
      path: "" as NonNullable<string> | null | undefined,
      filesUpdate: null,
    } as NonNullable<MaybePromise<EditResult>>;
    return errorResult;
  }
}

export type { SandboxBackendProtocol, ExecuteResponse, ShellBackendOptions };
