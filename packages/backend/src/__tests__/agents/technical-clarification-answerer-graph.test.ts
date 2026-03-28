import { type InvokeAgentInternalOutput } from "../../invoke-agent-graph/invoke-agent-internal-utility";
import * as MockStateFactory from "../helpers/mock-state-factory";

vi.mock("../../shared/gemini-flash-model.js", () => ({
  geminiFlashLLMMedium: {},
}));

vi.mock("../../backends/read-only-shell-backend.js", () => ({
  ReadOnlyShellBackend: class {
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

import * as TechnicalClarificationAnswererGraph from "../../agents/technical-clarification-answerer/technical-clarification-answerer-graph";

describe("technicalClarificationAnswererGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("produces clarifications from auto-generated technical answers", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        answers: ["Use microservices architecture", "Redis for caching"],
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
          questions: ["What architecture pattern?", "What caching strategy?"],
          nextTarget: "technicalClarificationAnswererGraph",
        },
        internal: { currentPhase: "technicalAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await TechnicalClarificationAnswererGraph.technicalClarificationAnswererGraph.invoke(state);

    const clarifications = result.technicalClarificationAnswererState.output?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("What architecture pattern?");
    expect(clarifications?.[0]?.answer).toBe("Use microservices architecture");
    expect(clarifications?.[1]?.question).toBe("What caching strategy?");
    expect(clarifications?.[1]?.answer).toBe("Redis for caching");
  });

  it("merges with existing clarifications", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        answers: ["WebSockets for real-time"],
      },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const existingClarifications: Array<{ question: string; answer: string }> = [
      { question: "Database?", answer: "PostgreSQL" },
    ];
    const state = MockStateFactory.createMockState({
      assignment: "Build an app",
      analysisControllerState: {
        output: {
          prd: "A PRD about building an app",
          clarifications: existingClarifications,
          assignment: "Build an app",
          questions: ["What transport for real-time?"],
          nextTarget: "technicalClarificationAnswererGraph",
        },
        internal: { currentPhase: "technicalAnalysis", businessRound: 0, technicalRound: 1, prdGenerated: true },
      },
    });

    const result = await TechnicalClarificationAnswererGraph.technicalClarificationAnswererGraph.invoke(state);

    const clarifications = result.technicalClarificationAnswererState.output?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("Database?");
    expect(clarifications?.[0]?.answer).toBe("PostgreSQL");
    expect(clarifications?.[1]?.question).toBe("What transport for real-time?");
    expect(clarifications?.[1]?.answer).toBe("WebSockets for real-time");
  });

  it("validates schema: answers must be an array of strings", () => {
    const schema = TechnicalClarificationAnswererGraph.technicalClarificationAnswererAgentOutputSchema;
    expect(schema.safeParse({ answers: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ answers: [1, 2] }).success).toBe(false);
    expect(schema.safeParse({ answers: "not array" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
