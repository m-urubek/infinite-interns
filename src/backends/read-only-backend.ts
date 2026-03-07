import type {
  FileInfo,
  FileData,
  GrepMatch,
  WriteResult,
  EditResult,
} from "deepagents";
import { FilesystemBackend } from "deepagents";

type MaybePromise<T> = T | Promise<T>;

type GrepResult = Array<GrepMatch> | string;

type BackendProtocol = {
  lsInfo(path: string): MaybePromise<Array<FileInfo>>;
  read(filePath: string, offset?: number, limit?: number): MaybePromise<string>;
  readRaw(filePath: string): MaybePromise<FileData>;
  grepRaw(
    pattern: string,
    path?: string | null,
    glob?: string | null,
  ): MaybePromise<GrepResult>;
  globInfo(pattern: string, path?: string): MaybePromise<Array<FileInfo>>;
  write(filePath: string, content: string): MaybePromise<WriteResult>;
  edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll?: boolean,
  ): MaybePromise<EditResult>;
};

type ReadOnlyBackendOptions = {
  rootDir: string;
  virtualMode?: boolean;
};

export class ReadOnlyBackend implements BackendProtocol {
  private inner: FilesystemBackend;

  constructor(options: ReadOnlyBackendOptions) {
    this.inner = new FilesystemBackend({
      rootDir: options.rootDir,
      virtualMode: options.virtualMode ?? true,
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

export type {
  BackendProtocol,
  MaybePromise,
  GrepResult,
  ReadOnlyBackendOptions,
};
