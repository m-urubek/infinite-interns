import * as MainPipelineRouting from "../../main-pipeline-graph/main-pipeline-routing";
import * as MockStateFactory from "../helpers/mock-state-factory";

describe("routeAfterAnalysisController", () => {
  it("routes to the nextTarget specified by the analysis controller", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: [],
          nextTarget: "prdGeneratorGraph",
        },
        internal: { currentPhase: "prdGeneration", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalysisControllerRoute> =
      MainPipelineRouting.routeAfterAnalysisController(state);
    expect(result).toBe("prdGeneratorGraph");
  });

  it("routes to prdAnalyzerGraph when controller targets it", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: [],
          nextTarget: "prdAnalyzerGraph",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalysisControllerRoute> =
      MainPipelineRouting.routeAfterAnalysisController(state);
    expect(result).toBe("prdAnalyzerGraph");
  });

  it("routes to plannerGraph when analysis is complete", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: [],
          nextTarget: "plannerGraph",
        },
        internal: { currentPhase: "done", businessRound: 0, technicalRound: 0, prdGenerated: true },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalysisControllerRoute> =
      MainPipelineRouting.routeAfterAnalysisController(state);
    expect(result).toBe("plannerGraph");
  });

  it("routes to answerClarificationsNode for interactive business clarifications", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: ["What DB?"],
          nextTarget: "answerClarificationsNode",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalysisControllerRoute> =
      MainPipelineRouting.routeAfterAnalysisController(state);
    expect(result).toBe("answerClarificationsNode");
  });

  it("routes to businessClarificationAnswererGraph for auto business clarifications", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: {
          prd: "Test PRD",
          clarifications: null,
          assignment: "Build an app",
          questions: ["What DB?"],
          nextTarget: "businessClarificationAnswererGraph",
        },
        internal: { currentPhase: "businessAnalysis", businessRound: 1, technicalRound: 0, prdGenerated: true },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostAnalysisControllerRoute> =
      MainPipelineRouting.routeAfterAnalysisController(state);
    expect(result).toBe("businessClarificationAnswererGraph");
  });

  it("throws when analysis controller output is null", () => {
    const state = MockStateFactory.createMockState({
      analysisControllerState: {
        output: null,
        internal: { currentPhase: "prdGeneration", businessRound: 0, technicalRound: 0, prdGenerated: false },
      },
    });
    expect(() => MainPipelineRouting.routeAfterAnalysisController(state)).toThrow(
      "Analysis controller output is null or undefined"
    );
  });
});

describe("routeAfterController", () => {
  it("routes to implementerGraph when allTasksDone is false and microplanner disabled", () => {
    const state = MockStateFactory.createMockState({
      microplannerEnabled: false,
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 0,
          failedAttempts: 0,
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

  it("routes to microplannerGraph when allTasksDone is false and microplanner enabled and not correction", () => {
    const state = MockStateFactory.createMockState({
      microplannerEnabled: true,
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: { title: "Task", description: "Desc", relevantFiles: [] },
          buildCommand: "npm run build",
          prd: "PRD",
          allTasksSummary: "1. Task",
          isCorrection: false,
          correctionError: null,
        },
        internal: {
          currentTaskIndex: 0,
          failedAttempts: 0,
          allTasksDone: false,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostControllerRoute> =
      MainPipelineRouting.routeAfterController(state);
    expect(result).toBe("microplannerGraph");
  });

  it("routes to implementerGraph when microplanner enabled but is correction run", () => {
    const state = MockStateFactory.createMockState({
      microplannerEnabled: true,
      controllerState: {
        output: {
          currentTaskIndex: 0,
          currentTask: { title: "Task", description: "Desc", relevantFiles: [] },
          buildCommand: "npm run build",
          prd: "PRD",
          allTasksSummary: "1. Task",
          isCorrection: true,
          correctionError: "Build failed",
        },
        internal: {
          currentTaskIndex: 0,
          failedAttempts: 1,
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
          failedAttempts: 0,
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

  it("routes to __end__ when allTasksDone and finalVerifier disabled and docs disabled", () => {
    const state = MockStateFactory.createMockState({
      finalVerifierEnabled: false,
      documentationConfig: null,
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 2,
          failedAttempts: 0,
          allTasksDone: true,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostControllerRoute> =
      MainPipelineRouting.routeAfterController(state);
    expect(result).toBe("__end__");
  });

  it("routes to documentationIndexerGraph when allTasksDone and finalVerifier disabled but docs enabled", () => {
    const state = MockStateFactory.createMockState({
      finalVerifierEnabled: false,
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      controllerState: {
        output: null,
        internal: {
          currentTaskIndex: 2,
          failedAttempts: 0,
          allTasksDone: true,
          cycleCount: 0,
          lastBuilderOutputCycle: -1,
          lastVerifierOutputCycle: -1,
        },
      },
    });
    const result: NonNullable<MainPipelineRouting.PostControllerRoute> =
      MainPipelineRouting.routeAfterController(state);
    expect(result).toBe("documentationIndexerGraph");
  });
});

describe("routeAfterImplementer", () => {
  it("routes to builderNode when builder is enabled", () => {
    const state = MockStateFactory.createMockState({
      builderEnabled: true,
      microVerifierEnabled: true,
    });
    const result: NonNullable<MainPipelineRouting.PostImplementerRoute> =
      MainPipelineRouting.routeAfterImplementer(state);
    expect(result).toBe("builderNode");
  });

  it("routes to verifierGraph when builder disabled but verifier enabled", () => {
    const state = MockStateFactory.createMockState({
      builderEnabled: false,
      microVerifierEnabled: true,
    });
    const result: NonNullable<MainPipelineRouting.PostImplementerRoute> =
      MainPipelineRouting.routeAfterImplementer(state);
    expect(result).toBe("verifierGraph");
  });

  it("routes to testsGeneratorGraph when both builder and verifier disabled", () => {
    const state = MockStateFactory.createMockState({
      builderEnabled: false,
      microVerifierEnabled: false,
    });
    const result: NonNullable<MainPipelineRouting.PostImplementerRoute> =
      MainPipelineRouting.routeAfterImplementer(state);
    expect(result).toBe("testsGeneratorGraph");
  });
});

describe("routeAfterBuilder", () => {
  it("routes to verifierGraph when build succeeds and verifier enabled", () => {
    const state = MockStateFactory.createMockState({
      microVerifierEnabled: true,
      builderState: { output: { success: true, errorOutput: null } },
    });
    const result: NonNullable<MainPipelineRouting.PostBuilderRoute> = MainPipelineRouting.routeAfterBuilder(state);
    expect(result).toBe("verifierGraph");
  });

  it("routes to testsGeneratorGraph when build succeeds and verifier disabled", () => {
    const state = MockStateFactory.createMockState({
      microVerifierEnabled: false,
      builderState: { output: { success: true, errorOutput: null } },
    });
    const result: NonNullable<MainPipelineRouting.PostBuilderRoute> = MainPipelineRouting.routeAfterBuilder(state);
    expect(result).toBe("testsGeneratorGraph");
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

describe("routeAfterVerifier", () => {
  it("routes to testsGeneratorGraph when verification succeeds", () => {
    const state = MockStateFactory.createMockState({
      verifierState: { output: { success: true, failureDescription: null } },
    });
    const result: NonNullable<MainPipelineRouting.PostVerifierRoute> = MainPipelineRouting.routeAfterVerifier(state);
    expect(result).toBe("testsGeneratorGraph");
  });

  it("routes to controllerNode when verification fails", () => {
    const state = MockStateFactory.createMockState({
      verifierState: { output: { success: false, failureDescription: "Missing validation" } },
    });
    const result: NonNullable<MainPipelineRouting.PostVerifierRoute> = MainPipelineRouting.routeAfterVerifier(state);
    expect(result).toBe("controllerNode");
  });

  it("throws when verifier output is null", () => {
    const state = MockStateFactory.createMockState({
      verifierState: { output: null },
    });
    expect(() => MainPipelineRouting.routeAfterVerifier(state)).toThrow(
      "Verifier output is null or undefined after verification"
    );
  });
});

describe("routeAfterTestsGenerator", () => {
  it("routes to microDocumenterGraph when documentation is enabled", () => {
    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
    });
    const result: NonNullable<MainPipelineRouting.PostTestsGeneratorRoute> =
      MainPipelineRouting.routeAfterTestsGenerator(state);
    expect(result).toBe("microDocumenterGraph");
  });

  it("routes to controllerNode when documentation is disabled", () => {
    const state = MockStateFactory.createMockState({
      documentationConfig: null,
    });
    const result: NonNullable<MainPipelineRouting.PostTestsGeneratorRoute> =
      MainPipelineRouting.routeAfterTestsGenerator(state);
    expect(result).toBe("controllerNode");
  });

  it("routes to controllerNode when documentation config has enabled false", () => {
    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: false, indexPath: "docs/index.md", docsFolderPath: "docs/" },
    });
    const result: NonNullable<MainPipelineRouting.PostTestsGeneratorRoute> =
      MainPipelineRouting.routeAfterTestsGenerator(state);
    expect(result).toBe("controllerNode");
  });
});

describe("routeAfterFinalVerifier", () => {
  it("routes to documentationIndexerGraph when documentation is enabled", () => {
    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
    });
    const result: NonNullable<MainPipelineRouting.PostFinalVerifierRoute> =
      MainPipelineRouting.routeAfterFinalVerifier(state);
    expect(result).toBe("documentationIndexerGraph");
  });

  it("routes to __end__ when documentation is disabled", () => {
    const state = MockStateFactory.createMockState({
      documentationConfig: null,
    });
    const result: NonNullable<MainPipelineRouting.PostFinalVerifierRoute> =
      MainPipelineRouting.routeAfterFinalVerifier(state);
    expect(result).toBe("__end__");
  });

  it("routes to __end__ when documentation config has enabled false", () => {
    const state = MockStateFactory.createMockState({
      documentationConfig: { enabled: false, indexPath: "docs/index.md", docsFolderPath: "docs/" },
    });
    const result: NonNullable<MainPipelineRouting.PostFinalVerifierRoute> =
      MainPipelineRouting.routeAfterFinalVerifier(state);
    expect(result).toBe("__end__");
  });
});
