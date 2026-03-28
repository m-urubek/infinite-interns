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

import * as InitialDocumenterGraph from "../../agents/initial-documenter/initial-documenter-graph";

describe("initialDocumenterGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("stores initial documentation results in initialDocumenterState.output", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesCreated: ["docs/feature-overview.md", "docs/api.md"],
        filesModified: ["docs/index.md"],
        summary: "Created feature overview and API documentation",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user auth",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      analysisControllerState: {
        output: {
          prd: "Auth PRD document",
          clarifications: null,
          assignment: "Build user auth",
          questions: [],
          nextTarget: "initialDocumenterGraph",
        },
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await InitialDocumenterGraph.initialDocumenterGraph.invoke(state);

    expect(result.initialDocumenterState.output?.filesCreated).toHaveLength(2);
    expect(result.initialDocumenterState.output?.filesModified).toHaveLength(1);
    expect(result.initialDocumenterState.output?.summary).toBe("Created feature overview and API documentation");
  });

  it("includes PRD and documentation config in user message", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        filesCreated: [],
        filesModified: [],
        summary: "No docs created",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build user auth",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      analysisControllerState: {
        output: {
          prd: "Auth PRD content here",
          clarifications: [{ question: "Framework?", answer: "Express" }],
          assignment: "Build user auth",
          questions: [],
          nextTarget: "initialDocumenterGraph",
        },
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    await InitialDocumenterGraph.initialDocumenterGraph.invoke(state);

    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Auth PRD content here");
    expect(userMessage).toContain("docs/");
    expect(userMessage).toContain("docs/index.md");
    expect(userMessage).toContain("Express");
  });

  it("throws when analysis controller output is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      analysisControllerState: {
        output: null,
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    await expect(InitialDocumenterGraph.initialDocumenterGraph.invoke(state)).rejects.toThrow(
      "Analysis controller output is null or undefined"
    );
  });

  it("throws when documentation config is null", async (): Promise<void> => {
    const state = MockStateFactory.createMockState({
      documentationConfig: null,
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Test",
          questions: [],
          nextTarget: "initialDocumenterGraph",
        },
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    await expect(InitialDocumenterGraph.initialDocumenterGraph.invoke(state)).rejects.toThrow(
      "Documentation config is null or undefined"
    );
  });
});
