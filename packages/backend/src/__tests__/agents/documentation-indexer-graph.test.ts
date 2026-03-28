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

import * as DocumentationIndexerGraph from "../../agents/documentation-indexer/documentation-indexer-graph";

describe("documentationIndexerGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores documentation index results in documentationIndexerState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        indexContent: "# Documentation Index\n\n- [API](api.md)\n- [Architecture](architecture.md)",
        indexPath: "docs/index.md",
        summary: "Created documentation index with 2 entries",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user auth",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
    });

    const result = await DocumentationIndexerGraph.documentationIndexerGraph.invoke(state);

    expect(result.documentationIndexerState.output?.indexContent).toContain("Documentation Index");
    expect(result.documentationIndexerState.output?.indexPath).toBe("docs/index.md");
    expect(result.documentationIndexerState.output?.summary).toBe("Created documentation index with 2 entries");
  });

  it("includes assignment and docs config in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        indexContent: "# Index",
        indexPath: "docs/index.md",
        summary: "Created index",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user authentication system",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
    });

    await DocumentationIndexerGraph.documentationIndexerGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Build user authentication system");
    expect(userMessage).toContain("docs/");
    expect(userMessage).toContain("docs/index.md");
  });

  it("throws when documentation config is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      documentationConfig: null,
    });

    await expect(DocumentationIndexerGraph.documentationIndexerGraph.invoke(state)).rejects.toThrow(
      "Documentation config is null or undefined"
    );
  });
});
