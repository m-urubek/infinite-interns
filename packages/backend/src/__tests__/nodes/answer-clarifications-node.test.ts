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

  it("pairs questions with human answers and writes to answerClarificationsState.output", () => {
    interruptReturnValue = ["React", "PostgreSQL"];

    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: ["What framework?", "What DB?"],
          nextTarget: "answerClarificationsNode",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    const clarifications = result.answerClarificationsState?.output?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("What framework?");
    expect(clarifications?.[0]?.answer).toBe("React");
    expect(clarifications?.[1]?.question).toBe("What DB?");
    expect(clarifications?.[1]?.answer).toBe("PostgreSQL");
  });

  it("merges with existing clarifications from analysisControllerState.output", () => {
    interruptReturnValue = ["New answer"];

    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: [{ question: "Old Q", answer: "Old A" }],
          assignment: "Build an app",
          questions: ["New question?"],
          nextTarget: "answerClarificationsNode",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    const clarifications = result.answerClarificationsState?.output?.clarifications;
    expect(clarifications).toHaveLength(2);
    expect(clarifications?.[0]?.question).toBe("Old Q");
    expect(clarifications?.[0]?.answer).toBe("Old A");
    expect(clarifications?.[1]?.question).toBe("New question?");
    expect(clarifications?.[1]?.answer).toBe("New answer");
  });

  it("increments clarificationRound", () => {
    interruptReturnValue = ["answer"];

    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: ["Q?"],
          nextTarget: "answerClarificationsNode",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
      answerClarificationsState: { internal: { clarificationRound: 3 } },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    expect(result.answerClarificationsState?.internal?.clarificationRound).toBe(4);
  });

  it("throws when analysis controller output is null", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: null,
        internal: { currentPhase: "businessAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });

    expect(() => AnswerClarificationsNode.answerClarificationsNode(state)).toThrow(
      "Analysis controller output is null or undefined"
    );
  });

  it("sets null for answers when fewer answers than questions", () => {
    interruptReturnValue = ["Only one"];

    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: ["Q1?", "Q2?", "Q3?"],
          nextTarget: "answerClarificationsNode",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
    });

    const result = AnswerClarificationsNode.answerClarificationsNode(state);

    const clarifications = result.answerClarificationsState?.output?.clarifications;
    expect(clarifications).toHaveLength(3);
    expect(clarifications?.[0]?.answer).toBe("Only one");
    expect(clarifications?.[1]?.answer).toBeNull();
    expect(clarifications?.[2]?.answer).toBeNull();
  });
});
