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

import * as BusinessClarificationAnswererGraph from "../../agents/business-clarification-answerer/business-clarification-answerer-graph";

describe("businessClarificationAnswererGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("produces clarifications from auto-generated answers", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        answers: ["Use PostgreSQL", "Yes, support OAuth"],
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
          questions: ["What database?", "Should we support OAuth?"],
          nextTarget: "businessClarificationAnswererGraph",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await BusinessClarificationAnswererGraph.businessClarificationAnswererGraph.invoke(state);

    const clarifications = result.businessClarificationAnswererState.output?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("What database?");
    expect(clarifications?.[0]?.answer).toBe("Use PostgreSQL");
    expect(clarifications?.[1]?.question).toBe("Should we support OAuth?");
    expect(clarifications?.[1]?.answer).toBe("Yes, support OAuth");
  });

  it("merges with existing clarifications", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: {
        answers: ["REST API"],
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
          prd: "A PRD about building an app",
          clarifications: existingClarifications,
          assignment: "Build an app",
          questions: ["What API style?"],
          nextTarget: "businessClarificationAnswererGraph",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await BusinessClarificationAnswererGraph.businessClarificationAnswererGraph.invoke(state);

    const clarifications = result.businessClarificationAnswererState.output?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("Framework?");
    expect(clarifications?.[0]?.answer).toBe("React");
    expect(clarifications?.[1]?.question).toBe("What API style?");
    expect(clarifications?.[1]?.answer).toBe("REST API");
  });

  it("validates schema: answers must be an array of strings", () => {
    const schema = BusinessClarificationAnswererGraph.businessClarificationAnswererAgentOutputSchema;
    expect(schema.safeParse({ answers: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ answers: [1, 2] }).success).toBe(false);
    expect(schema.safeParse({ answers: "not array" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});
