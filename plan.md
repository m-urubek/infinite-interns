# Plan: Implement All Remaining README Features

## Context

The README describes a full autonomous development pipeline with ~10 agents and several nodes. Currently only 6 agents and 3 nodes are implemented. The README marks numerous items as `[todo]`. This plan covers implementing **everything** from the README that isn't implemented yet.

The work is divided into **5 chunks** that can each be given to a separate agent. Chunks 2 and 3 can run in parallel after Chunk 1. Chunk 4 depends on 2+3. Chunk 5 depends on all.

```
Chunk 1 (Foundation)
  ├── Chunk 2 (Analysis Controller + Analysis Agents)  ──┐
  ├── Chunk 3 (Implementation Loop Agents)               ├── Chunk 4 (Documentation Agents) ── Chunk 5 (Frontend + Rate Limits)
  └─────────────────────────────────────────────────────┘
```

---

## Upfront Architectural Decisions

### D1: Analysis Controller is a deterministic Node (no LLM)

Like `controllerNode`, it's a state machine that tracks phases/rounds and emits a `nextTarget` routing string. Lives in `src/nodes/analysis-controller/`.

### D2: Multi-provider via `BaseChatModel`

`model-factory.ts` dispatches on a new `provider` field in `ModelConfig`. Return type becomes `BaseChatModel` (from `@langchain/core`). All downstream types (`invoke-agent-graph-factory`, `gemini-flash-model`) change accordingly. OpenAI and DeepSeek packages are already in `package.json`.

### D3: Analysis Controller state machine phases

`internal` tracks: `currentPhase` ("prdGeneration" | "businessAnalysis" | "technicalAnalysis" | "done"), round counters per phase, and modes (disabled/interactive/auto) read from pipeline input on first invocation. The controller is called after every downstream step and decides what to invoke next.

### D4: Pipeline input expansion

New input fields for toggles, modes, documentation config, and rate limits. The frontend passes them from preset config. The backend reads them in routing functions and controller nodes.

### D5: Agent toggles are enforced via routing, not by removing nodes

Toggle-disabled agents are still registered in the graph but routing skips them. This keeps the graph structure stable.

---

## Chunk 1: Foundation (Multi-Provider, Pipeline Inputs, Type Expansion)

**Goal**: Lay the groundwork for all subsequent chunks. No new agents/nodes — just types, model factory, and pipeline input expansion.

### Files to modify

1. **`packages/backend/src/shared/agent-config-types.ts`**
   - Add `provider` field to `ModelConfig`: `provider: "google" | "openai" | "deepseek"`
   - Expand `LlmAgentNode` union with all 9 new agent names: `"technicalPrdAnalyzer"`, `"businessClarificationAnswerer"`, `"technicalClarificationAnswerer"`, `"microplanner"`, `"testsGenerator"`, `"initialDocumenter"`, `"microDocumenter"`, `"finalDocumenter"`, `"documentationIndexer"`
   - Add `AnalysisMode` type: `"disabled" | "interactive" | "auto"`
   - Add `DocumentationConfig` type: `{ enabled: boolean, indexPath: string, docsFolderPath: string }`
   - Add `RateLimitsConfig` type: `{ maxRpm: number | null, maxTpm: number | null, maxRpd: number | null, maxSpending: number | null }`

2. **`packages/backend/src/shared/model-factory.ts`**
   - Import `BaseChatModel` from `@langchain/core/language_models/chat_models`
   - Import `ChatOpenAI` from `@langchain/openai` and `ChatDeepSeek` from `@langchain/deepseek` (already in deps)
   - Change return type to `BaseChatModel`
   - Dispatch on `config.provider`: `"google"` -> `ChatGoogleGenerativeAI`, `"openai"` -> `ChatOpenAI`, `"deepseek"` -> `ChatDeepSeek`
   - Default to `"google"` if provider is undefined (backward compat)
   - Note: thinkingConfig is Google-specific — only apply it when provider is "google"

3. **`packages/backend/src/shared/gemini-flash-model.ts`**
   - Change export type from `ChatGoogleGenerativeAI` to `BaseChatModel`

4. **`packages/backend/src/invoke-agent-graph/invoke-agent-graph-factory.ts`**
   - Change all `ChatGoogleGenerativeAI` references to `BaseChatModel`
   - Update `resolveModel` signature, `model` parameter, and `firstInvokeNode`/`repeatNode` internal types
   - Import `BaseChatModel` instead of `ChatGoogleGenerativeAI`

5. **`packages/backend/src/main-pipeline-graph/main-pipeline-annotations.ts`**
   - Add new pipeline input fields:
     - `businessClarificationsMode: AnalysisMode` (default `"interactive"`)
     - `technicalClarificationsMode: AnalysisMode` (default `"disabled"`)
     - `businessClarificationRounds: number` (rename from `clarificationRounds`, default 5)
     - `technicalClarificationRounds: number` (default 5)
     - `microplannerEnabled: boolean` (default `true`)
     - `builderEnabled: boolean` (default `true`)
     - `microVerifierEnabled: boolean` (default `true`)
     - `documentationConfig: DocumentationConfig | null` (default `null` = disabled)
     - `rateLimitsConfig: RateLimitsConfig | null` (default `null`)
   - Remove old `clarificationRounds` (replaced by `businessClarificationRounds`)

6. **`packages/backend/src/main-pipeline-graph/main-pipeline-types.ts`**
   - No changes needed (it derives from annotations)

7. **`packages/backend/src/main-pipeline-graph/main-pipeline-routing.ts`**
   - Update `routeAfterAnalyzer` to use `businessClarificationRounds` instead of `clarificationRounds`

8. **`packages/backend/src/__tests__/helpers/mock-state-factory.ts`**
   - Add defaults for all new input fields
   - Remove old `clarificationRounds` default, add `businessClarificationRounds`

9. **`packages/backend/src/nodes/answer-clarifications/answer-clarifications-node.ts`**
   - Reference `state.businessClarificationRounds` instead of `state.clarificationRounds` (if used here — actually round tracking is in routing, but check)

10. **Update all existing tests** that reference `clarificationRounds` to use `businessClarificationRounds`

### Tests to write

- `src/__tests__/infrastructure/model-factory.test.ts` — test Google/OpenAI/DeepSeek dispatch, default provider, thinking config only for Google

### Verification

- `npm run fix` passes
- `npm run test` passes (all existing tests still green)

---

## Chunk 2: Analysis Controller + Technical Analyzer + Clarification Answerers

**Goal**: Replace the current inline analysis routing with a proper Analysis Controller node. Add Technical PRD Analyzer, Business Clarification Answerer, and Technical Clarification Answerer agents. Implement the three clarification modes (disabled/interactive/auto).

### New files to create

1. **`src/nodes/analysis-controller/analysis-controller-types.ts`**

   ```
   AnalysisPhase = "prdGeneration" | "businessAnalysis" | "technicalAnalysis" | "done"
   AnalysisControllerRoute = "prdGeneratorGraph" | "prdAnalyzerGraph" | "technicalPrdAnalyzerGraph"
     | "answerClarificationsNode" | "businessClarificationAnswererGraph" | "technicalClarificationAnswererGraph"
     | "initialDocumenterGraph" | "plannerGraph"
   AnalysisControllerOutput = { prd, clarifications, assignment, questions, nextTarget }
   AnalysisControllerInternal = { currentPhase, businessRound, technicalRound, prdGenerated }
   AnalysisControllerState = { output, internal }
   ```

2. **`src/nodes/analysis-controller/analysis-controller-node.ts`**
   - Deterministic state machine. On each invocation:
     - First call: routes to `prdGeneratorGraph`
     - After PRD generated: check business mode. If not disabled → route to `prdAnalyzerGraph`. Else check technical. If both disabled → route to planner/documenter.
     - After business analyzer: if `needsClarification` and under round limit → route to `answerClarificationsNode` (interactive) or `businessClarificationAnswererGraph` (auto). Else advance to technical phase.
     - After technical analyzer: same logic as business
     - When done: route to `initialDocumenterGraph` (if docs enabled) or `plannerGraph`
   - Reads from: `prdGeneratorState.output`, `prdAnalyzerState.output`, `technicalPrdAnalyzerState.output`, `answerClarificationsState.output`, `businessClarificationAnswererState.output`, `technicalClarificationAnswererState.output`
   - Writes: `analysisControllerState.output` (pass-through data + nextTarget), `analysisControllerState.internal` (phase tracking)

3. **`src/agents/technical-prd-analyzer/technical-prd-analyzer-types.ts`**
   - Same shape as `PrdAnalyzerState` → `TechnicalPrdAnalyzerState`
   - Same `PrdAnalyzerAgentResult` shape reused (or define `TechnicalPrdAnalyzerAgentResult` identically)

4. **`src/agents/technical-prd-analyzer/technical-prd-analyzer-graph.ts`**
   - Mirrors `prd-analyzer-graph.ts` but with technical-focused system prompt (architecture, scalability, security, integration points, performance)
   - Backend: `ReadOnlyBackend`
   - setup reads from `analysisControllerState.output` (prd, clarifications, assignment)
   - process writes `technicalPrdAnalyzerState.output` with pass-through of prd + clarifications

5. **`src/agents/business-clarification-answerer/business-clarification-answerer-types.ts`**
   - `BusinessClarificationAnswererOutput = { answers: Array<string> }`
   - `BusinessClarificationAnswererState = { output }`

6. **`src/agents/business-clarification-answerer/business-clarification-answerer-graph.ts`**
   - Agent that receives questions and auto-answers them by analyzing codebase
   - Backend: `ReadOnlyShellBackend` (needs to explore codebase for answers)
   - setup reads questions from `analysisControllerState.output.questions`, plus prd and clarifications
   - process writes answers and also updates `answerClarificationsState.output.clarifications` (same format as human answers) and increments `answerClarificationsState.internal.clarificationRound`

7. **`src/agents/technical-clarification-answerer/technical-clarification-answerer-types.ts`**
   - Same shape as business answerer

8. **`src/agents/technical-clarification-answerer/technical-clarification-answerer-graph.ts`**
   - Same pattern as business answerer but with technical focus

### Files to modify

9. **`src/main-pipeline-graph/main-pipeline-annotations.ts`**
   - Add state annotations: `analysisControllerState`, `technicalPrdAnalyzerState`, `businessClarificationAnswererState`, `technicalClarificationAnswererState`

10. **`src/main-pipeline-graph/main-pipeline-graph.ts`**
    - Replace the entire analysis section:
      - Remove: `__start__` → `prdGeneratorGraph` → `prdAnalyzerGraph` → conditional → `answerClarificationsNode` → `prdGeneratorGraph`
      - Add: `__start__` → `analysisControllerNode` → conditional edges to all analysis targets
      - All analysis targets route back to `analysisControllerNode`
      - `analysisControllerNode` → conditional → `plannerGraph` (or `initialDocumenterGraph` in Chunk 4)
    - Register new nodes: `analysisControllerNode`, `technicalPrdAnalyzerGraph`, `businessClarificationAnswererGraph`, `technicalClarificationAnswererGraph`

11. **`src/main-pipeline-graph/main-pipeline-routing.ts`**
    - Remove `routeAfterAnalyzer` (replaced by analysis controller)
    - Add `routeAfterAnalysisController`: reads `analysisControllerState.output.nextTarget`

12. **`src/agents/prd-generator/prd-generator-graph.ts`**
    - Update `setup` to read clarifications from `analysisControllerState.output.clarifications` instead of `answerClarificationsState.output.clarifications` (analysis controller is now its direct upstream)

13. **`src/agents/prd-analyzer/prd-analyzer-graph.ts`**
    - Update `setup` to read prd and clarifications from `analysisControllerState.output` instead of `prdGeneratorState.output`

14. **`src/nodes/answer-clarifications/answer-clarifications-node.ts`**
    - Update to read questions from `analysisControllerState.output.questions` instead of `prdAnalyzerState.output.questions`
    - Read previous clarifications from `analysisControllerState.output.clarifications`

15. **`src/agents/planner/planner-graph.ts`**
    - Update `setup` to read prd and clarifications from `analysisControllerState.output` instead of `prdAnalyzerState.output`

16. **`src/nodes/controller/controller-node.ts`**
    - Update PRD read from `analysisControllerState.output.prd` instead of `prdAnalyzerState.output.prd`

17. **`src/__tests__/helpers/mock-state-factory.ts`**
    - Add defaults for all new state types

### Tests to write

- `src/__tests__/nodes/analysis-controller-node.test.ts` — extensive state machine tests:
  - Routes to prdGenerator on first call
  - Routes to business analyzer after PRD (when interactive/auto)
  - Routes to technical analyzer after business done (when enabled)
  - Routes to answerClarificationsNode (interactive mode)
  - Routes to businessClarificationAnswererGraph (auto mode)
  - Skips disabled phases
  - Respects round limits
  - Routes to planner when all phases done
- `src/__tests__/agents/technical-prd-analyzer-graph.test.ts`
- `src/__tests__/agents/business-clarification-answerer-graph.test.ts`
- `src/__tests__/agents/technical-clarification-answerer-graph.test.ts`
- Update `src/__tests__/routing/main-pipeline-routing.test.ts` — remove routeAfterAnalyzer tests, add routeAfterAnalysisController
- Update all existing agent tests affected by upstream neighbor changes

### Verification

- `npm run fix` passes
- `npm run test` passes
- Manual test: launch pipeline with business=interactive, technical=disabled (should behave like current flow)

---

## Chunk 3: Implementation Loop Agents (Microplanner + Tests Generator)

**Goal**: Add Microplanner and Tests Generator into the implementation loop. Wire agent toggles (microplanner, builder, microVerifier) into routing.

### New files to create

1. **`src/agents/microplanner/microplanner-types.ts`**

   ```
   MicroplannerOutput = { microPlan: string, existingPatternsToReuse: Array<string>, filesToReference: Array<string> }
   MicroplannerState = { output }
   ```

2. **`src/agents/microplanner/microplanner-graph.ts`**
   - Backend: `ReadOnlyShellBackend` (read + execute to analyze codebase patterns)
   - System prompt: "Analyze the codebase to find existing patterns, utilities, abstractions, and conventions that should be reused. Create a focused micro-plan that the implementer should follow to avoid reinventing existing solutions."
   - setup reads from `controllerState.output` (current task, PRD, build command)
   - Zod schema: `{ microPlan: string, existingPatternsToReuse: string[], filesToReference: string[] }`

3. **`src/agents/tests-generator/tests-generator-types.ts`**

   ```
   TestsGeneratorOutput = { testsAdded: boolean, testFiles: Array<string>, summary: string }
   TestsGeneratorState = { output }
   ```

4. **`src/agents/tests-generator/tests-generator-graph.ts`**
   - Backend: `LocalShellBackend` (needs write access to create test files)
   - System prompt: "After a task has been verified, determine if the new code warrants unit tests or enhancement to existing tests. If so, implement them following existing test patterns."
   - setup reads from `controllerState.output` (current task info, PRD)
   - Zod schema: `{ testsAdded: boolean, testFiles: string[], summary: string }`

### Files to modify

5. **`src/main-pipeline-graph/main-pipeline-annotations.ts`**
   - Add `microplannerState` and `testsGeneratorState`

6. **`src/main-pipeline-graph/main-pipeline-graph.ts`**
   - Restructure implementation loop:
     - `controllerNode` → conditional → `microplannerGraph` (if enabled + not done) or `implementerGraph` (if microplanner disabled + not done) or `finalVerifierGraph`/`__end__` (if done)
     - `microplannerGraph` → `implementerGraph`
     - `implementerGraph` → `builderNode` (if builder enabled) or `verifierGraph` (if builder disabled)
     - `builderNode` → conditional → `verifierGraph` (success + verifier enabled) or `controllerNode` (failure) or `testsGeneratorGraph` (success + verifier disabled)
     - `verifierGraph` → conditional → `testsGeneratorGraph` (success) or `controllerNode` (failure)
     - `testsGeneratorGraph` → `controllerNode` (or `microDocumenterGraph` when docs added in Chunk 4)

7. **`src/main-pipeline-graph/main-pipeline-routing.ts`**
   - Update `routeAfterController` to include `microplannerGraph` as a possible target, read `microplannerEnabled` toggle
   - Update `routeAfterBuilder` to handle `microVerifierEnabled` toggle
   - Add `routeAfterVerifier` — routes to `testsGeneratorGraph` (on success) or `controllerNode` (on failure)
   - Add `routeAfterImplementer` — routes to `builderNode` (if builder enabled) or `verifierGraph` (builder disabled + verifier enabled) or `controllerNode` (both disabled, essentially no verification)

8. **`src/agents/implementer/implementer-graph.ts`**
   - Update `setup` to include micro-plan in user message when `microplannerState.output` is available
   - The microplanner is a direct upstream when enabled, so setup reads from `microplannerState.output.microPlan` if present

9. **`src/__tests__/helpers/mock-state-factory.ts`**
   - Add defaults for `microplannerState` and `testsGeneratorState`

### Tests to write

- `src/__tests__/agents/microplanner-graph.test.ts`
- `src/__tests__/agents/tests-generator-graph.test.ts`
- Update `src/__tests__/routing/main-pipeline-routing.test.ts` — new routing functions + toggle-based routing
- Update `src/__tests__/agents/implementer-graph.test.ts` — test micro-plan inclusion in message

### Verification

- `npm run fix` passes
- `npm run test` passes
- Manual test: launch with microplanner=true and microplanner=false to verify toggle works

---

## Chunk 4: Documentation Pipeline (4 Agents + Settings)

**Goal**: Implement Initial Documenter, Micro Documenter, Final Documenter, and Documentation Indexer. Wire them into the pipeline at their insertion points.

### New files to create

1. **`src/agents/initial-documenter/initial-documenter-types.ts`**

   ```
   InitialDocumenterOutput = { filesCreated: Array<string>, filesModified: Array<string>, summary: string }
   InitialDocumenterState = { output }
   ```

2. **`src/agents/initial-documenter/initial-documenter-graph.ts`**
   - Backend: `LocalShellBackend` (writes documentation files)
   - System prompt: Creates/modifies docs with `<!-- CURRENTLY IMPLEMENTING -->` tags
   - setup reads from `analysisControllerState.output` (prd, clarifications) + `documentationConfig` from pipeline input
   - Runs after analysis completes, before planner

3. **`src/agents/micro-documenter/micro-documenter-types.ts`**

   ```
   MicroDocumenterOutput = { filesModified: Array<string>, summary: string, noChangesNeeded: boolean }
   MicroDocumenterState = { output }
   ```

4. **`src/agents/micro-documenter/micro-documenter-graph.ts`**
   - Backend: `LocalShellBackend` (writes documentation)
   - System prompt: After each verified task, determine if docs need updating with new findings
   - setup reads from `controllerState.output` (current task) + `documentationConfig`
   - Runs after tests generator in implementation loop

5. **`src/agents/documentation-indexer/documentation-indexer-types.ts`**

   ```
   DocumentationIndexerOutput = { indexContent: string, indexPath: string, summary: string }
   DocumentationIndexerState = { output }
   ```

6. **`src/agents/documentation-indexer/documentation-indexer-graph.ts`**
   - Backend: `LocalShellBackend` (writes index file)
   - System prompt: Creates/updates master documentation index as structured map of all docs
   - setup reads `documentationConfig` (index path, docs folder path)
   - Runs after final verifier

7. **`src/agents/final-documenter/final-documenter-types.ts`**

   ```
   FinalDocumenterOutput = { filesModified: Array<string>, summary: string }
   FinalDocumenterState = { output }
   ```

8. **`src/agents/final-documenter/final-documenter-graph.ts`**
   - Backend: `LocalShellBackend` (writes documentation)
   - System prompt: Removes "currently implementing" tags, polishes documentation
   - setup reads from `documentationIndexerState.output` + `documentationConfig`
   - Runs at very end, after documentation indexer

### Files to modify

9. **`src/main-pipeline-graph/main-pipeline-annotations.ts`**
   - Add state annotations for all 4 new agents

10. **`src/main-pipeline-graph/main-pipeline-graph.ts`**
    - Wire initial documenter: analysis controller routes to `initialDocumenterGraph` when docs enabled → `plannerGraph`; or directly to `plannerGraph` when disabled
    - Wire micro documenter: `testsGeneratorGraph` → `microDocumenterGraph` (docs enabled) → `controllerNode`; or `testsGeneratorGraph` → `controllerNode` (disabled)
    - Wire final pipeline: `finalVerifierGraph` → `documentationIndexerGraph` → `finalDocumenterGraph` → `__end__` (docs enabled); or `finalVerifierGraph` → `__end__` (disabled)

11. **`src/main-pipeline-graph/main-pipeline-routing.ts`**
    - Add `routeAfterTestsGenerator`: → `microDocumenterGraph` (docs enabled) or `controllerNode`
    - Update `routeAfterController`: when `allTasksDone`, route to `finalVerifierGraph` (if enabled) or `documentationIndexerGraph` (if final verifier disabled but docs enabled) or `__end__`
    - Add routing after `finalVerifierGraph`: → `documentationIndexerGraph` (docs enabled) or `__end__`
    - Update analysis controller: add `initialDocumenterGraph` as route target when analysis done + docs enabled

12. **`src/nodes/analysis-controller/analysis-controller-node.ts`**
    - Add routing to `initialDocumenterGraph` when analysis done and docs enabled

13. **`src/__tests__/helpers/mock-state-factory.ts`**
    - Add defaults for all 4 new state types

### Tests to write

- `src/__tests__/agents/initial-documenter-graph.test.ts`
- `src/__tests__/agents/micro-documenter-graph.test.ts`
- `src/__tests__/agents/final-documenter-graph.test.ts`
- `src/__tests__/agents/documentation-indexer-graph.test.ts`
- Update routing tests for documentation conditional edges

### Verification

- `npm run fix` passes
- `npm run test` passes
- Manual test: launch with documentation enabled and verify all 4 agents run

---

## Chunk 5: Frontend Wiring + Rate Limits + Remaining Config

**Goal**: Wire all new pipeline inputs from frontend to backend. Update UI for new settings. Implement rate limits enforcement. Pass custom rules to agents.

### Files to modify

1. **`packages/frontend/src/types/preset.ts`**
   - Expand `AGENT_NODES` and `LLM_AGENT_NODES` with all new agents
   - Update `AGENT_NODE_LABELS` and `DEFAULT_BACKENDS` for new agents
   - Add to `Preset` type: `documentationEnabled: boolean`, `documentationIndexPath: string`, `docsFolderPath: string`
   - Change `provider` type from `'google'` to `'google' | 'openai' | 'deepseek'`
   - Add `businessClarificationsMode` and `technicalClarificationsMode` fields as `'disabled' | 'interactive' | 'auto'`
   - Remove old `businessClarifications` and `technicalClarifications` booleans (replace with mode)
   - Update `createDefaultPreset()`

2. **`packages/frontend/src/hooks/usePipeline.ts`**
   - Expand `PipelineInput` with all new fields:
     - `businessClarificationsMode`, `technicalClarificationsMode`
     - `businessClarificationRounds`, `technicalClarificationRounds`
     - `microplannerEnabled`, `builderEnabled`, `microVerifierEnabled`
     - `documentationConfig: { enabled, indexPath, docsFolderPath } | null`
     - `rateLimitsConfig: { maxRpm, maxTpm, maxRpd, maxSpending } | null`
   - Update `launchPipeline` to pass all fields to `stream.submit`

3. **`packages/frontend/src/components/PipelineForm.tsx`**
   - Derive new fields from preset and pass to `onSubmit`

4. **`packages/frontend/src/components/PresetEditorForm.tsx`**
   - Replace boolean toggle for business/technical clarifications with a tri-state selector (disabled/interactive/auto)
   - Add "Documentation" section: enabled toggle, index path input, docs folder path input
   - Add provider selection dropdown in General section (google/openai/deepseek)

5. **`packages/frontend/src/components/dialogs/ModelConfigDialog.tsx`**
   - Add provider field per agent (affects which models are available)
   - When provider changes, update available model list

6. **`packages/frontend/src/server/presets-api-plugin.ts`**
   - Add new columns to SQLite schema: `documentationEnabled`, `documentationIndexPath`, `docsFolderPath`, `businessClarificationsMode`, `technicalClarificationsMode`
   - Migration: `ALTER TABLE presets ADD COLUMN ... DEFAULT ...` for each new column
   - Migrate old boolean `businessClarifications`/`technicalClarifications` → mode strings
   - Update `rowToPreset`, `insertPreset`, `booleanFields` list, etc.

7. **`packages/backend/src/shared/rate-limiter.ts`** (NEW FILE)
   - Simple sliding window rate limiter
   - Tracks RPM, TPM, RPD counters
   - `async waitForAvailability()` — sleeps until next request is allowed
   - Used by invoke-agent-graph-factory before each LLM call

8. **`packages/backend/src/invoke-agent-graph/invoke-agent-graph-factory.ts`**
   - Accept optional rate limiter
   - Before each LLM call, call `rateLimiter.waitForAvailability()` if provided
   - Pass `customRules` from agent config into the system prompt (append to the agent's system prompt)

9. **`packages/backend/src/invoke-agent-graph/invoke-agent-types.ts`**
   - Add `customRules: string | null` to `InvokeAgentInput`

10. **All agent setup functions** — pass `customRules` from `agentConfigs` into `invokeAgentState.input.customRules`

11. **`packages/backend/langgraph.json`**
    - Register all new agent graphs (technicalPrdAnalyzer, businessClarificationAnswerer, technicalClarificationAnswerer, microplanner, testsGenerator, initialDocumenter, microDocumenter, finalDocumenter, documentationIndexer)

### Tests to write

- `src/__tests__/infrastructure/rate-limiter.test.ts` — test RPM tracking, waitForAvailability, counter reset
- Update existing tests as needed

### Verification

- `npm run fix` passes for both backend and frontend
- `npm run test` passes
- Manual E2E: launch pipeline from UI with various toggle/mode combinations
- Verify preset save/load with new fields
- Verify rate limiter throttles correctly

---

## Summary

| Chunk | Description                                | New Agents | New Nodes | Key Risk                                                          |
| ----- | ------------------------------------------ | ---------- | --------- | ----------------------------------------------------------------- |
| 1     | Foundation (types, multi-provider, inputs) | 0          | 0         | Rename `clarificationRounds` breaks existing tests                |
| 2     | Analysis Controller + 4 analysis agents    | 3          | 1         | Biggest refactor — changes upstream neighbor of 5 existing agents |
| 3     | Microplanner + Tests Generator             | 2          | 0         | Implementation loop routing gets complex with toggles             |
| 4     | 4 Documentation agents                     | 4          | 0         | Conditional wiring at 3 insertion points                          |
| 5     | Frontend wiring + rate limits              | 0          | 0         | SQLite migration + UI complexity                                  |

**Total: 9 new agents, 1 new node, multi-provider support, rate limiting, documentation settings, full frontend wiring.**
