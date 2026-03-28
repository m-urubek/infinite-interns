# Preset Management System

## Overview

The frontend includes a persistent preset management system that controls pipeline configuration. Presets are stored in SQLite via a Vite dev server middleware plugin.

## SQLite Schema

Database file: `packages/frontend/presets.db` (gitignored)

### Tables

- **presets**: All `Preset` type fields as columns. `backends`, `customRules`, `retryAttempts`, `agentModelConfigs` stored as JSON text. Boolean fields stored as INTEGER (0/1). String mode fields (`businessClarificationsMode`, `technicalClarificationsMode`) stored as TEXT. Primary key: `id` (UUID).
- **settings**: Key-value store (`key TEXT PRIMARY KEY, value TEXT`). Used for `selectedPresetId`.
- **thread_presets**: Associates threads with presets (`threadId TEXT PRIMARY KEY, presetId TEXT`). Saved when a pipeline is launched from the UI; looked up when attaching to a thread.

### Schema Migration

The plugin auto-migrates old schemas:
- Old boolean `businessClarifications`/`technicalClarifications` columns are migrated to `businessClarificationsMode`/`technicalClarificationsMode` (text: 'disabled'/'interactive'/'auto')
- New columns (`documentationEnabled`, `documentationIndexPath`, `docsFolderPath`) are added if missing

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

## Connected Fields (wired to backend pipeline input)

All preset fields are now connected to the backend pipeline input:

- `finalVerifier` → `finalVerifierEnabled`
- `buildCommand` → `buildCommand` when `buildCommandAutoDetect` is false, else `null`
- `businessClarificationsMode` → `businessClarificationsMode` ('disabled'/'interactive'/'auto')
- `technicalClarificationsMode` → `technicalClarificationsMode` ('disabled'/'interactive'/'auto')
- `businessClarificationRounds` → `businessClarificationRounds`
- `technicalClarificationRounds` → `technicalClarificationRounds`
- `maxImplementationAttempts` → `maxImplementationAttempts`
- `microplanner` → `microplannerEnabled`
- `builder` → `builderEnabled`
- `microVerifier` → `microVerifierEnabled`
- `documentationEnabled` + `documentationIndexPath` + `docsFolderPath` → `documentationConfig` (or null if disabled)
- `maxRpm`/`maxTpm`/`maxRpd`/`maxSpending` → `rateLimitsConfig` (or null if all are null)
- `agentModelConfigs` + `retryAttempts` + `customRules` → `agentConfigs` (per-agent model, retry, and custom rules config for all 15 LLM agents)

## Per-Agent Configuration

### Model Configuration (15 LLM agents)
Each LLM agent has its own:
- **model**: Model ID (Gemini dropdown for Google provider, manual text input for OpenAI/DeepSeek)
- **temperature**: 0-2 range
- **thinkingEnabled**: Whether to enable reasoning output (Google/Gemini only)

Configured via the "Configure Models" button in the preset editor's Advanced section.

### Custom Rules
Custom rules are per-agent plain text strings that get appended to the agent's system prompt under a "## Custom Rules" section. Stored in `AgentConfig.customRules`, wired through `InvokeAgentInput.customRules` → `invoke-agent-graph-factory` builds effective system prompt.

### Provider Selection
Provider is global per preset (`'google' | 'openai' | 'deepseek'`). When set to non-Google, the ModelConfigDialog shows a text input instead of a Gemini model dropdown and disables the thinking toggle.

## Rate Limiting

Rate limiting is enforced at the `invoke-agent-graph-factory` level using a shared singleton `RateLimiter`:
- **RPM enforcement**: Sliding window over 60-second window
- **RPD enforcement**: Sliding window over 24-hour window
- **TPM/Spending**: Stored in config but not enforced (soft caps — token counts unknown pre-request)
- Rate limiter is created lazily on first agent invocation and shared across all agents in a pipeline run
- `waitForAvailability()` is called before each LLM invocation

## Implementation Retry Counter
The backend uses a unified `failedAttempts` counter per task in `ControllerInternal`:
- Both build failures and verification failures increment the same counter
- Counter resets to 0 when a task succeeds (verifier passes → advance to next task)
- Pipeline throws an error when `failedAttempts >= maxImplementationAttempts`
- Default: 7 attempts

## Stored but NOT connected (future work)

- Custom tools per agent
- API keys management
- Timeout configuration

## Thread-Preset Association

- When a pipeline is launched from the UI, the thread ID and selected preset ID are saved together
- When attaching to a thread, the preset is looked up and restored
- External threads (not launched from our app) show with a notice that preset settings aren't available

## Shared PipelineTreeView Component

`PipelineTreeView` is a pure rendering component extracted from `PipelineTree`. It takes `treeData`, `activeNodeKey`, and `allExpanded` props and renders the tree. Used by both:
1. Main page sidebar (with live tree filtering during runs)
2. Preset management page sidebar (with static preset-filtered tree)

The `filterTreeByPreset()` function works on any tree (static or live LangGraph API) and removes nodes whose pipeline toggle is disabled in the preset.
