# Preset Management System

## Overview

The frontend includes a persistent preset management system that controls pipeline configuration. Presets are stored in SQLite via a Vite dev server middleware plugin.

## SQLite Schema

Database file: `packages/frontend/presets.db` (gitignored)

### Tables

- **presets**: All `Preset` type fields as columns. `backends`, `customRules`, `retryAttempts`, `agentModelConfigs` stored as JSON text. Primary key: `id` (UUID).
- **settings**: Key-value store (`key TEXT PRIMARY KEY, value TEXT`). Used for `selectedPresetId`.
- **thread_presets**: Associates threads with presets (`threadId TEXT PRIMARY KEY, presetId TEXT`). Saved when a pipeline is launched from the UI; looked up when attaching to a thread.

## API Endpoints

All served by Vite middleware plugin at `/api/presets/*` and `/api/thread-presets/*`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/presets` | List all presets |
| GET | `/api/presets/selected` | Get selected preset ID |
| PUT | `/api/presets/selected` | Set selected preset ID |
| POST | `/api/presets` | Create new preset |
| PUT | `/api/presets/:id` | Update preset fields |
| DELETE | `/api/presets/:id` | Delete preset |
| GET | `/api/thread-presets/:threadId` | Get preset ID for a thread |
| POST | `/api/thread-presets` | Save thread-preset association |

## Connected vs Stored-Only Fields

### Connected NOW (wired to backend pipeline input):
- `finalVerifier` → `finalVerifierEnabled` (pre-fills form checkbox)
- `buildCommand` → `buildCommand` when `buildCommandAutoDetect` is false, else `null`
- `businessClarificationRounds` → `clarificationRounds` (pipeline input)
- `maxImplementationAttempts` → `maxImplementationAttempts` (pipeline input, unified failed-attempt counter per task)
- `agentModelConfigs` + `retryAttempts` → `agentConfigs` (per-agent model + retry config for all 6 LLM agents)

### Per-Agent Model Configuration
Model configuration is per-agent (not global). Each of the 6 LLM agents (`prdGenerator`, `prdAnalyzer`, `planner`, `implementer`, `verifier`, `finalVerifier`) has its own:
- **model**: Which Gemini model to use
- **temperature**: 0-2 range
- **thinkingEnabled**: Whether to enable reasoning output

Configured via the "Configure Models" button in the Advanced section of the preset editor, which opens `ModelConfigDialog`.

### Implementation Retry Counter
The backend uses a unified `failedAttempts` counter per task in `ControllerInternal`:
- Both build failures and verification failures increment the same counter
- Counter resets to 0 when a task succeeds (verifier passes → advance to next task)
- Pipeline throws an error when `failedAttempts >= maxImplementationAttempts`
- Default: 7 attempts

### Stored but NOT connected (future work):
- Agent toggles (businessClarifications, technicalClarifications, microplanner, builder, microVerifier)
- Rate limits (maxRpm, maxTpm, maxRpd, maxSpending)
- Backends per agent
- Custom rules per agent
- Custom tools

## Temperature Provider Note

**Temperature is currently hardcoded to "Temperature" label with 0-2 range for Google/Gemini models.** When new providers are added, this needs provider-dependent label/range switching (e.g., OpenAI uses 0-2 but labels may differ, Anthropic uses 0-1).

## Thread-Preset Association

- When a pipeline is launched from the UI, the thread ID and selected preset ID are saved together
- When attaching to a thread, the preset is looked up and restored
- External threads (not launched from our app) show with a notice that preset settings aren't available

## Shared PipelineTreeView Component

`PipelineTreeView` is a pure rendering component extracted from `PipelineTree`. It takes `treeData`, `activeNodeKey`, and `allExpanded` props and renders the tree. Used by both:
1. Main page sidebar (with live tree filtering during runs)
2. Preset management page sidebar (with static preset-filtered tree)

The `filterTreeByPreset()` function works on any tree (static or live LangGraph API) and removes nodes whose pipeline toggle is disabled in the preset.
