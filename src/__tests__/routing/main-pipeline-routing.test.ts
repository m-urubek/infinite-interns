import * as MainPipelineRouting from "../../main-pipeline-graph/main-pipeline-routing";
import * as MockStateFactory from "../helpers/mock-state-factory";

describe("routeAfterAnalyzer", () => {
  it("routes to answerClarificationsNode when needsClarification is true and under round limit", () => {
    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["What DB?"],
          confidence: 4,
          reasoning: "Missing DB choice",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      answerClarificationsState: { internal: { clarificationRound: 2 } },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalyzerRoute> = MainPipelineRouting.routeAfterAnalyzer(state);
    expect(result).toBe("answerClarificationsNode");
  });

  it("routes to plannerGraph when round limit is reached even if needsClarification is true", () => {
    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["What DB?"],
          confidence: 4,
          reasoning: "Missing DB choice",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      answerClarificationsState: { internal: { clarificationRound: 5 } },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalyzerRoute> = MainPipelineRouting.routeAfterAnalyzer(state);
    expect(result).toBe("plannerGraph");
  });

  it("routes to plannerGraph when needsClarification is false", () => {
    const state = MockStateFactory.createMockState({
      prdAnalyzerState: {
        output: {
          needsClarification: false,
          questions: [],
          confidence: 9,
          reasoning: "All clear",
          prd: "Test PRD",
          clarifications: null,
        },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalyzerRoute> = MainPipelineRouting.routeAfterAnalyzer(state);
    expect(result).toBe("plannerGraph");
  });

  it("throws when analyzer output is null", () => {
    const state = MockStateFactory.createMockState({
      prdAnalyzerState: { output: null },
    });
    expect(() => MainPipelineRouting.routeAfterAnalyzer(state)).toThrow(
      "PRD Analyzer output is null or undefined after analysis"
    );
  });
});

describe("routeAfterController", () => {
  it("routes to implementerGraph when allTasksDone is false", () => {
    const state = MockStateFactory.createMockState({
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 0,
          builderAttempts: 0,
          verifierAttempts: 0,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostControllerRoute> =
      MainPipelineRouting.routeAfterController(state);
    expect(result).toBe("implementerGraph");
  });

  it("routes to finalVerifierGraph when allTasksDone is true", () => {
    const state = MockStateFactory.createMockState({
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 2,
          builderAttempts: 0,
          verifierAttempts: 0,
          allTasksDone: true,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostControllerRoute> =
      MainPipelineRouting.routeAfterController(state);
    expect(result).toBe("finalVerifierGraph");
  });
});

describe("routeAfterBuilder", () => {
  it("routes to verifierGraph when build succeeds", () => {
    const state = MockStateFactory.createMockState({
      builderState: { output: { success: true, errorOutput: null } },
    });
    const result: NonNullable<MainPipelineRouting.PostBuilderRoute> = MainPipelineRouting.routeAfterBuilder(state);
    expect(result).toBe("verifierGraph");
  });

  it("routes to controllerNode when build fails", () => {
    const state = MockStateFactory.createMockState({
      builderState: { output: { success: false, errorOutput: "Type error" } },
    });
    const result: NonNullable<MainPipelineRouting.PostBuilderRoute> = MainPipelineRouting.routeAfterBuilder(state);
    expect(result).toBe("controllerNode");
  });

  it("throws when builder output is null", () => {
    const state = MockStateFactory.createMockState({
      builderState: { output: null },
    });
    expect(() => MainPipelineRouting.routeAfterBuilder(state)).toThrow(
      "Builder output is null or undefined after build"
    );
  });
});
