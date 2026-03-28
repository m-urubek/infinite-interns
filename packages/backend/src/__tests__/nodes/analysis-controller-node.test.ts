import * as AnalysisControllerNode from "../../nodes/analysis-controller/analysis-controller-node";
import * as MockStateFactory from "../helpers/mock-state-factory";
import { type MainPipelineState } from "../../main-pipeline-graph/main-pipeline-types";

describe("analysisControllerNode", () => {
  it("routes to prdGeneratorGraph on first invocation", () => {
    const state: MainPipelineState = MockStateFactory.createMockState();
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("prdGeneratorGraph");
    expect(result.analysisControllerState?.internal?.prdGenerated).toBe(true);
  });

  it("routes to prdAnalyzerGraph after PRD generated when business mode is interactive", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "interactive",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("prdAnalyzerGraph");
    expect(result.analysisControllerState?.output?.prd).toBe("Test PRD");
    expect(result.analysisControllerState?.internal?.currentPhase).toBe("businessAnalysis");
  });

  it("routes to prdAnalyzerGraph after PRD generated when business mode is auto", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "auto",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("prdAnalyzerGraph");
  });

  it("routes to answerClarificationsNode when business analyzer needs clarification in interactive mode", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "interactive",
      businessClarificationRounds: 5,
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["What DB?"],
          confidence: 4,
          reasoning: "Missing info",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "businessAnalysis",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("answerClarificationsNode");
    expect(result.analysisControllerState?.output?.questions).toEqual(["What DB?"]);
    expect(result.analysisControllerState?.internal?.businessRound).toBe(1);
  });

  it("routes to businessClarificationAnswererGraph when business analyzer needs clarification in auto mode", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "auto",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["What DB?"],
          confidence: 4,
          reasoning: "Missing info",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "businessAnalysis",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("businessClarificationAnswererGraph");
  });

  it("skips business analysis when mode is disabled and routes to technical", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "interactive",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("technicalPrdAnalyzerGraph");
    expect(result.analysisControllerState?.internal?.currentPhase).toBe("technicalAnalysis");
  });

  it("routes to technicalPrdAnalyzerGraph when technical analysis is enabled and not yet run", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "interactive",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      technicalPrdAnalyzerState: { output: null },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "technicalAnalysis",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("technicalPrdAnalyzerGraph");
  });

  it("routes to technicalClarificationAnswererGraph when technical analyzer needs clarification in auto mode", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "auto",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      technicalPrdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["What architecture?"],
          confidence: 3,
          reasoning: "Missing arch",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "technicalAnalysis",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("technicalClarificationAnswererGraph");
    expect(result.analysisControllerState?.output?.questions).toEqual(["What architecture?"]);
    expect(result.analysisControllerState?.internal?.technicalRound).toBe(1);
  });

  it("respects business round limit and advances to technical phase", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "interactive",
      businessClarificationRounds: 2,
      technicalClarificationsMode: "disabled",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      prdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["More questions"],
          confidence: 4,
          reasoning: "Still needs info",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "businessAnalysis",
          businessRound: 2,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    // Should skip clarification and route to planner since both business is at limit and technical is disabled
    expect(result.analysisControllerState?.output?.nextTarget).toBe("plannerGraph");
  });

  it("respects technical round limit and routes to planner", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "interactive",
      technicalClarificationRounds: 1,
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      technicalPrdAnalyzerState: {
        output: {
          needsClarification: true,
          questions: ["Remaining Q"],
          confidence: 3,
          reasoning: "Still unclear",
          prd: "Test PRD",
          clarifications: null,
        },
      },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "technicalAnalysis",
          businessRound: 0,
          technicalRound: 1,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("plannerGraph");
  });

  it("routes to plannerGraph when both business and technical are disabled", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "disabled",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("plannerGraph");
  });

  it("routes to plannerGraph when business analyzer says no clarification needed", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "interactive",
      technicalClarificationsMode: "disabled",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
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
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "businessAnalysis",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("plannerGraph");
  });

  it("routes to initialDocumenterGraph when analysis done and docs enabled", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "disabled",
      documentationConfig: { enabled: true, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("initialDocumenterGraph");
  });

  it("routes to plannerGraph when analysis done and docs disabled", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "disabled",
      documentationConfig: null,
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("plannerGraph");
  });

  it("routes to plannerGraph when analysis done and docs config has enabled false", () => {
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "disabled",
      documentationConfig: { enabled: false, indexPath: "docs/index.md", docsFolderPath: "docs/" },
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.nextTarget).toBe("plannerGraph");
  });

  it("passes through clarifications from answerClarificationsState", () => {
    const existingClarifications: Array<{ question: string; answer: string }> = [
      { question: "Framework?", answer: "React" },
    ];
    const state: MainPipelineState = MockStateFactory.createMockState({
      businessClarificationsMode: "disabled",
      technicalClarificationsMode: "disabled",
      prdGeneratorState: { output: { prd: "Test PRD", clarifications: null } },
      answerClarificationsState: {
        output: { clarifications: existingClarifications },
        internal: { clarificationRound: 1 },
      },
      analysisControllerState: {
        output: null,
        internal: {
          currentPhase: "prdGeneration",
          businessRound: 0,
          technicalRound: 0,
          prdGenerated: true,
        },
      },
    });
    const result = AnalysisControllerNode.analysisControllerNode(state);

    expect(result.analysisControllerState?.output?.clarifications).toEqual(existingClarifications);
  });
});
