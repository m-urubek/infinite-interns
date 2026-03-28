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

import * as FinalDocumenterGraph from "../../agents/final-documenter/final-documenter-graph";

describe("finalDocumenterGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores final documentation results in finalDocumenterState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesModified: ["docs/feature-overview.md", "docs/api.md"],
        summary: "Removed implementing tags and polished documentation",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user auth",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      documentationIndexerState: {
        output: {
          indexContent: "# Index\n- [API](api.md)",
          indexPath: "docs/index.md",
          summary: "Index created with 1 entry",
        },
      },
    });

    const result = await FinalDocumenterGraph.finalDocumenterGraph.invoke(state);

    expect(result.finalDocumenterState.output?.filesModified).toHaveLength(2);
    expect(result.finalDocumenterState.output?.summary).toBe("Removed implementing tags and polished documentation");
  });

  it("includes index summary and docs config in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesModified: [],
        summary: "No changes needed",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user auth system",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      documentationIndexerState: {
        output: {
          indexContent: "# Index",
          indexPath: "docs/index.md",
          summary: "Index with API and architecture docs",
        },
      },
    });

    await FinalDocumenterGraph.finalDocumenterGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Build user auth system");
    expect(userMessage).toContain("Index with API and architecture docs");
    expect(userMessage).toContain("docs/");
  });

  it("uses fallback when documentation indexer output is null", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesModified: [],
        summary: "No changes needed",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user auth",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      documentationIndexerState: { output: null },
    });

    await FinalDocumenterGraph.finalDocumenterGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("No index available.");
  });

  it("throws when documentation config is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      documentationConfig: null,
    });

    await expect(FinalDocumenterGraph.finalDocumenterGraph.invoke(state)).rejects.toThrow(
      "Documentation config is null or undefined"
    );
  });
});
