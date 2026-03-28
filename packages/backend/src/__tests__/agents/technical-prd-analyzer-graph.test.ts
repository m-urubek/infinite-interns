import { type InvokeAgentInternalOutput } from "../../invoke-agent-graph/invoke-agent-internal-utility";
import * as MockStateFactory from "../helpers/mock-state-factory";

vi.mock("../../shared/gemini-flash-model.js", () => ({
  geminiFlashLLMMedium: {},
}));

vi.mock("../../backends/read-only-backend.js", () => ({
  ReadOnlyBackend: class {
    constructor() {}
  },
}));

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

import * as TechnicalPrdAnalyzerGraph from "../../agents/technical-prd-analyzer/technical-prd-analyzer-graph";

describe("technicalPrdAnalyzerGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("outputs needsClarification=true with technical questions", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        needsClarification: true,
        questions: ["What caching strategy?", "Should we use WebSockets?"],
        confidence: 4,
        reasoning: "Missing technical decisions",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build an app",
      analysisControllerState: {
        output: {
          prd: "A PRD about building an app",
          clarifications: null,
          assignment: "Build an app",
          questions: [],
          nextTarget: "technicalPrdAnalyzerGraph",
        },
        internal: { currentPhase: "technicalAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await TechnicalPrdAnalyzerGraph.technicalPrdAnalyzerGraph.invoke(state);

    expect(result.technicalPrdAnalyzerState.output?.needsClarification).toBe(true);
    expect(result.technicalPrdAnalyzerState.output?.questions).toHaveLength(2);
    expect(result.technicalPrdAnalyzerState.output?.confidence).toBe(4);
  });

  it("outputs needsClarification=false when technically sound", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        needsClarification: false,
        questions: [],
        confidence: 9,
        reasoning: "Technically complete",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build an app",
      analysisControllerState: {
        output: {
          prd: "A comprehensive PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: [],
          nextTarget: "technicalPrdAnalyzerGraph",
        },
        internal: { currentPhase: "technicalAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await TechnicalPrdAnalyzerGraph.technicalPrdAnalyzerGraph.invoke(state);

    expect(result.technicalPrdAnalyzerState.output?.needsClarification).toBe(false);
    expect(result.technicalPrdAnalyzerState.output?.questions).toHaveLength(0);
  });

  it("passes through prd and clarifications from analysisControllerState", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        needsClarification: false,
        questions: [],
        confidence: 8,
        reasoning: "All good",
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const existingClarifications: Array<{ question: string; answer: string }> = [
      { question: "Framework?", answer: "React" },
    ];
    const state = MockStateFactory.createMockState({
      assignment: "Build an app",
      analysisControllerState: {
        output: {
          prd: "PRD with React details",
          clarifications: existingClarifications,
          assignment: "Build an app",
          questions: [],
          nextTarget: "technicalPrdAnalyzerGraph",
        },
        internal: { currentPhase: "technicalAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await TechnicalPrdAnalyzerGraph.technicalPrdAnalyzerGraph.invoke(state);

    expect(result.technicalPrdAnalyzerState.output?.prd).toBe("PRD with React details");
    expect(result.technicalPrdAnalyzerState.output?.clarifications).toEqual(existingClarifications);
  });
});
