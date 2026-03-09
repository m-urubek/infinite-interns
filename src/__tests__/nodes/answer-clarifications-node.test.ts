import * as MockStateFactory from "../helpers/mock-state-factory";

let interruptReturnValue: NonNullable<Array<string>> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@langchain/langgraph", async (): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual("@langchain/langgraph");
  const mod = {
    ...actual,
    interrupt: () => interruptReturnValue,
  };
  return mod;
});

// Must import after vi.mock
import * as AnswerClarificationsNode from "../../nodes/answer-clarifications/answer-clarifications-node";

describe("answerClarificationsNode", () => {
  beforeEach(() => {
    interruptReturnValue = [];
  });

  it("pairs questions with human answers and writes to prdGeneratorState.input", () => {
    interruptReturnValue = ["React", "PostgreSQL"];

    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["What framework?", "What DB?"],
          confidence: 4,
          reasoning: "Needs info",
          prd: "Test PRD",
          clarifications: null,
        },
      },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    const clarifications = result.prdGeneratorState?.input?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("What framework?");
    expect(clarifications?.[0]?.answer).toBe("React");
    expect(clarifications?.[1]?.question).toBe("What DB?");
    expect(clarifications?.[1]?.answer).toBe("PostgreSQL");
  });

  it("merges with existing clarifications", () => {
    interruptReturnValue = ["New answer"];

    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["New question?"],
          confidence: 4,
          reasoning: "Needs more info",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      prdGeneratorState: {
        input: { clarifications: null },
        output: {
          prd: "Test PRD",
          clarifications: [{ question: "Old Q", answer: "Old A" }],
        },
      },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    const clarifications = result.prdGeneratorState?.input?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("Old Q");
    expect(clarifications?.[0]?.answer).toBe("Old A");
    expect(clarifications?.[1]?.question).toBe("New question?");
    expect(clarifications?.[1]?.answer).toBe("New answer");
  });

  it("increments clarificationRound", () => {
    interruptReturnValue = ["answer"];

    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["Q?"],
          confidence: 4,
          reasoning: "Needs info",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      answerClarificationsState: { internal: { clarificationRound: 3 } },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    expect(result.answerClarificationsState?.internal?.clarificationRound).toBe(4);
  });

  it("throws when analyzer output is null", () => {
    const state = MockStateFactory.createMockState({
      prdAnalyzerState: { output: null },
    });

    expect(() => AnswerClarificationsNode.answerClarificationsNode(state)).toThrow(
      "PRD Analyzer output is null or undefined"
    );
  });

  it("sets null for answers when fewer answers than questions", () => {
    interruptReturnValue = ["Only one"];

    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["Q1?", "Q2?", "Q3?"],
          confidence: 3,
          reasoning: "Multiple gaps",
          prd: "Test PRD",
          clarifications: null,
        },
      },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    const clarifications = result.prdGeneratorState?.input?.clarifications;
    expect(clarifications).toHaveLength(3);
    expect(clarifications?.[0]?.answer).toBe("Only one");
    expect(clarifications?.[1]?.answer).toBeNull();
    expect(clarifications?.[2]?.answer).toBeNull();
  });
});
