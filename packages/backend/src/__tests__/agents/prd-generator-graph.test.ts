import { type InvokeAgentInternalOutput } from "../../invoke-agent-graph/invoke-agent-internal-utility";
import * as MockStateFactory from "../helpers/mock-state-factory";

// Mock LLM infrastructure before any imports that use it
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

// Import after mocks
import * as PrdGeneratorGraph from "../../agents/prd-generator/prd-generator-graph";

describe("prdGeneratorGraph", () => {
  beforeEach(() => {
    invokeAgentMock.mockReset();
  });

  it("produces PRD output when invoked without clarifications", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { precision: 75, prd: "Generated PRD content about a todo app" },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build a todo app",
    });

    const result = await PrdGeneratorGraph.prdGeneratorGraph.invoke(state);

    expect(result.prdGeneratorState.output.prd).toBe("Generated PRD content about a todo app");
    expect(result.prdGeneratorState.output.clarifications).toBeNull();
    expect(invokeAgentMock).toHaveBeenCalledOnce();

    // Verify the user message contains the assignment
    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("Build a todo app");
    expect(userMessage).toContain("No clarifications provided");
  });

  it("passes through clarifications when provided", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { precision: 85, prd: "Updated PRD with React" },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({
      assignment: "Build a todo app",
      analysisControllerState: {
        output: {
          prd: "",
          clarifications: [{ question: "What framework?", answer: "React" }],
          assignment: "Build a todo app",
          questions: [],
          nextTarget: "prdGeneratorGraph",
        },
        internal: { currentPhase: "prdGeneration", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = await PrdGeneratorGraph.prdGeneratorGraph.invoke(state);

    expect(result.prdGeneratorState.output.prd).toBe("Updated PRD with React");
    expect(result.prdGeneratorState.output.clarifications).toHaveLength(1);
    expect(result.prdGeneratorState.output.clarifications?.[0]?.answer).toBe("React");

    // Verify clarifications appear in user message
    const messages: NonNullable<Array<{ content: string }>> = invokeAgentMock.mock.calls[0]?.[0];
    const userMessage: NonNullable<string> = messages[0]?.content ?? "";
    expect(userMessage).toContain("What framework?");
    expect(userMessage).toContain("React");
  });

  it("validates schema: precision must be 0-100 and prd must be a string", async (): Promise<void> => {
    const mockResponse: NonNullable<InvokeAgentInternalOutput> = {
      response: { precision: 50, prd: "A valid PRD" },
      success: true,
      errorMessage: null,
    };
    invokeAgentMock.mockResolvedValue(mockResponse);

    const state = MockStateFactory.createMockState({ assignment: "Test" });
    const result = await PrdGeneratorGraph.prdGeneratorGraph.invoke(state);

    expect(result.prdGeneratorState.output.prd).toBe("A valid PRD");

    // Verify schema rejects out-of-range precision via Zod
    const schema = PrdGeneratorGraph.prdGeneratorAgentOutputSchema;
    expect(schema.safeParse({ precision: -1, prd: "test" }).success).toBe(false);
    expect(schema.safeParse({ precision: 101, prd: "test" }).success).toBe(false);
    expect(schema.safeParse({ precision: 0, prd: "test" }).success).toBe(true);
    expect(schema.safeParse({ precision: 100, prd: "test" }).success).toBe(true);
  });
});
