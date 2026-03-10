import type { FileInfo, FileData, GrepMatch, WriteResult, EditResult } from "deepagents";
import * as Deepagents from "deepagents";

type MaybePromise<T> = T | Promise<T>;

type GrepResult = Array<GrepMatch> | string;

type BackendProtocol = {
  lsInfo(path: NonNullable<string>): NonNullable<MaybePromise<Array<FileInfo>>>;
  read(
    filePath: NonNullable<string>,
    offset?: number | null | undefined,
    limit?: number | null | undefined
  ): NonNullable<MaybePromise<string>>;
  readRaw(filePath: NonNullable<string>): NonNullable<MaybePromise<FileData>>;
  grepRaw(
    pattern: NonNullable<string>,
    path?: string | null | undefined,
    glob?: string | null | undefined
  ): NonNullable<MaybePromise<GrepResult>>;
  globInfo(pattern: NonNullable<string>, path?: string | null | undefined): NonNullable<MaybePromise<Array<FileInfo>>>;
  write(filePath: NonNullable<string>, content: NonNullable<string>): NonNullable<MaybePromise<WriteResult>>;
  edit(
    filePath: NonNullable<string>,
    oldString: NonNullable<string>,
    newString: NonNullable<string>,
    replaceAll?: boolean | null | undefined
  ): NonNullable<MaybePromise<EditResult>>;
};

type ReadOnlyBackendOptions = {
  rootDir: NonNullable<string>;
  virtualMode?: boolean | null | undefined;
};

export class ReadOnlyBackend implements BackendProtocol {
  private inner: NonNullable<Deepagents.FilesystemBackend>;

  constructor(options: NonNullable<ReadOnlyBackendOptions>) {
    this.inner = new Deepagents.FilesystemBackend({
      rootDir: options.rootDir,
      virtualMode: options.virtualMode ?? true,
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

export type { BackendProtocol, MaybePromise, GrepResult, ReadOnlyBackendOptions };
