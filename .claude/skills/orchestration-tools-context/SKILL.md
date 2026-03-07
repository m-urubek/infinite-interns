<context>
# Orchestration Tools - Technical Summary

> This document provides technical context for AI agents working on this codebase.

## Project Overview

Orchestration Tools is a LangChain-based implementation of an autonomous software development pipeline. It uses LangGraph to orchestrate 9 specialized AI agents that collaborate to implement features from a task description through PRD generation, planning, implementation, and verification.

**Key Architecture Note:** The system uses the `deepagents` npm package from LangChain, which provides built-in filesystem tools, planning capabilities, and subagent support. Agents use custom wrapper backends (`ReadOnlyBackend`, `ReadOnlyShellBackend`) to enforce permission boundaries.

### Original Project Reference

This is a reimplementation of `claude-orchestration` (located at `/home/pc/Coding/claude-orchestration`), originally built with custom Claude API calls. The new implementation leverages LangChain/LangGraph ecosystem to minimize custom code.

## Technology Stack

- **Framework**: LangChain + LangGraph (TypeScript)
- **LLM Provider**: Google Gemini (`gemini-3-flash-preview` model)
- **Agent Framework**: `deepagents` v1.8.1 (provides filesystem tools, planning, subagents)
- **Orchestration**: LangGraph StateGraph with conditional routing
- **Structured Output**: Zod schemas via `responseFormat`
- **Development Server**: `@langchain/langgraph-cli` (LangGraph Studio integration)
- **Testing**: Vitest

### Key Dependencies

```json
{
  "@langchain/core": "^1.1.29",
  "@langchain/google-genai": "^2.1.22",
  "@langchain/langgraph": "^1.2.0",
  "deepagents": "^1.8.1",
  "zod": "3.25.67"
}
```

## Project Structure

```
src/
├── agents/                    # 9 specialized agents
│   ├── prd-generator.ts       # Generates PRD from task description
│   ├── prd-analyzer.ts        # Analyzes PRD for gaps (interactive mode)
│   ├── business-analyzer.ts   # Analyzes PRD for business gaps (autonomous mode)
│   ├── clarification-answerer.ts  # Answers technical questions from analyzer
│   ├── planner.ts             # Divides PRD into sequential assignments
│   ├── microplanner.ts        # Creates step-by-step implementation plan
│   ├── implementer.ts         # Writes actual code (ONLY agent with write access)
│   ├── verifier.ts            # Verifies each assignment's implementation
│   └── final-verifier.ts      # Final verification against full PRD
├── pipeline.ts                # Main LangGraph orchestration graph
├── pipeline-state.ts          # State schema and routing functions
├── shared.ts                  # LLM instance, backend wrappers
├── agent-types.ts             # TypeScript type definitions
├── pipeline.test.ts           # Test suite
└── debug-run.ts               # Debug runner script

langgraph.json                 # LangGraph CLI configuration
.env                           # Environment variables
```

## Agent Permission Model

Agents have different filesystem access levels enforced at the backend level:

| Agent                  | Backend                | Capabilities                                 |
| ---------------------- | ---------------------- | -------------------------------------------- |
| prd-generator          | `ReadOnlyBackend`      | read_file, glob, grep, ls (NO write)         |
| prd-analyzer           | `ReadOnlyBackend`      | read_file, glob, grep, ls (NO write)         |
| business-analyzer      | `ReadOnlyBackend`      | read_file, glob, grep, ls (NO write)         |
| planner                | `ReadOnlyBackend`      | read_file, glob, grep, ls (NO write)         |
| microplanner           | `ReadOnlyBackend`      | read_file, glob, grep, ls (NO write)         |
| clarification-answerer | `ReadOnlyShellBackend` | read + execute (NO write)                    |
| verifier               | `ReadOnlyShellBackend` | read + execute (NO write)                    |
| final-verifier         | `ReadOnlyShellBackend` | read + execute (NO write)                    |
| **implementer**        | `LocalShellBackend`    | **FULL ACCESS** (read, write, edit, execute) |

### Backend Wrappers (src/shared.ts)

- **`ReadOnlyBackend`**: Wraps `FilesystemBackend`, blocks `write()` and `edit()` with error messages
- **`ReadOnlyShellBackend`**: Wraps `LocalShellBackend`, adds `execute()` but blocks `write()` and `edit()`

When a read-only agent attempts to write, it receives an error response rather than silently succeeding.

## Core Data Models

### Assignment

```typescript
type Assignment = {
  id: string; // kebab-case identifier
  title: string; // Human-readable title
  description: string; // Detailed implementation instructions
  dependsOn: Array<string>; // IDs of prerequisite assignments
  estimatedFiles: Array<string>; // Expected files to create/modify
};
```

### Clarification

```typescript
type Clarification = {
  question: string; // The question asked
  answer: string; // Answer based on codebase analysis
  confident: boolean; // Whether the answer is confident
};
```

### PipelineMode

```typescript
type PipelineMode = "interactive" | "autonomous";
```

- **interactive**: Uses `prd-analyzer` for detailed technical analysis
- **autonomous**: Uses `business-analyzer` for high-level business questions only

## Pipeline State Schema

### Input Fields (Required)

```typescript
task: string; // Task description to implement
projectDir: string; // Absolute path to target project
```

### Input Fields (Optional)

```typescript
mode: PipelineMode; // Default: "autonomous"
buildCommands: Array<string>; // Build commands to run for verification
```

### Computed State

```typescript
prd: string; // Generated PRD document
analysisResult: string; // JSON analysis from analyzer
clarifications: Array<Clarification>; // Q&A history
clarificationRound: number; // Current clarification iteration
needsClarification: boolean; // Whether more clarification needed

assignments: Array<Assignment>; // Implementation plan
currentAssignmentIndex: number; // Current assignment being worked on

microplan: string; // Detailed steps for current assignment
implementationResult: string; // Output from implementer
implementationAttempt: number; // Retry counter
verificationPassed: boolean; // Per-assignment verification
verificationFeedback: string; // Feedback for failed verification

finalVerificationPassed: boolean; // Full PRD verification
pipelineRetries: number; // Full pipeline retry counter
status: string; // Current pipeline status
```

## Pipeline Flow

```
┌─────────────────┐
│   __start__    │
└───────┬─────────┘
        ▼
┌─────────────────┐
│  generatePrd    │ ◄──────────────────────┐
└───────┬─────────┘                        │
        ▼                                  │
┌─────────────────┐                        │
│   analyzePrd    │                        │
└───────┬─────────┘                        │
        │                                  │
        ├── needsClarification? ──Yes──┐   │
        │                              ▼   │
        │                 ┌─────────────────┐
        │                 │answerClarifications│
        │                 └───────┬─────────┘
        │                         │
        │◄────────────────────────┘
        │
        ▼ (No clarification needed)
┌─────────────────┐
│   createPlan    │
└───────┬─────────┘
        ▼
┌─────────────────┐
│ createMicroplan │◄──────────────────────┐
└───────┬─────────┘                       │
        ▼                                 │
┌─────────────────┐                       │
│   implement     │                       │
└───────┬─────────┘                       │
        ▼                                 │
┌─────────────────┐                       │
│     verify      │                       │
└───────┬─────────┘                       │
        │                                 │
        ├── !passed && retries < 3 ───────┘
        │
        ├── more assignments? ────────────┘
        │
        ▼ (All assignments done)
┌─────────────────┐
│   finalVerify   │
└───────┬─────────┘
        │
        ├── !passed && retries < 2 ────► generatePrd
        │
        ▼
┌─────────────────┐
│    __end__     │
└─────────────────┘
```

## Pipeline Limits

```typescript
MAX_CLARIFICATION_ROUNDS = 5; // Max Q&A iterations
MAX_IMPLEMENTATION_RETRIES = 3; // Max retries per assignment
MAX_PIPELINE_RETRIES = 2; // Max full pipeline retries
```

## Structured Output Schemas

Most agents use `responseFormat` with Zod schemas to enforce JSON output:

### PRD Analyzer Response

```typescript
{
  needsClarification: boolean,
  questions: Array<{ question: string, reason: string }>,
  confidence: number,  // 1-10
  reasoning: string
}
```

### Planner Response

```typescript
{
  assignments: Array<{
    id: string;
    title: string;
    description: string;
    dependsOn: Array<string>;
    estimatedFiles: Array<string>;
  }>;
}
```

### Verifier Response

```typescript
{
  passed: boolean,
  issues: Array<{ severity: "error" | "warning", file: string, description: string }>,
  buildPassed: boolean,
  buildOutput: string
}
```

### Final Verifier Response

```typescript
{
  passed: boolean,
  commitMessage: string,    // Conventional commit message
  feedback: string,         // Empty if passed
  unmetRequirements: Array<string>
}
```

## Running the Project

### Development Server (LangGraph Studio)

```bash
npm run dev
```

Opens LangGraph Studio at `http://localhost:8123`. Use the Studio UI to:

- Configure and launch pipeline runs
- Visualize graph execution
- Debug agent interactions

### Environment Variables

```env
GOOGLE_API_KEY=your-api-key
LANGSMITH_API_KEY=your-langsmith-key  # Optional, for tracing
```

## Common Patterns

### Agent Factory Pattern

Each agent exports two functions:

```typescript
// For pipeline use - creates agent with specific projectDir
export function create(projectDir: string): DeepAgent;

// For LangGraph Studio testing - reads projectDir from config
export function makeGraph(config?: GraphConfig): DeepAgent;
```

### Invoking Agents in Pipeline

```typescript
const result = await agent.invoke({
  messages: [{ role: "user", content: userMessage }],
});

// Check for structured response first (from responseFormat)
if (result.structuredResponse) {
  return JSON.stringify(result.structuredResponse);
}
// Fallback to last message content
return result.messages.at(-1)?.content;
```

## Important Notes

### Gemini Configuration

- **Model**: `gemini-3-flash-preview` - Cheap and fast with thinking capabilities
- **Temperature**: Set to 0.5
- **Structured Output**: Full support via `responseFormat` with Zod schemas

### Future Capabilities

The `deepagents` package provides built-in support for:

- **Subagents**: `task` tool and `subagents` config parameter
- **Planning**: `write_todos` tool
- **Context management**: Automatic summarization and offloading

These are available for future expansion without additional implementation.

## Testing

```bash
npm run test        # Run tests once
npm run test:watch  # Watch mode
```

Tests use Vitest and mock the LLM responses to verify pipeline routing logic.

## Lint and typescript

Always run `npm run fix` when you make changes in .ts files. This runs lint check, typescript check and automatic fixes. It returns even typescript errors, not only lints. So this command is all you need to check your code.

## Code Style Requirements

This project uses a custom ESLint rule (`enforce-explicit-types`) that enforces strict typing patterns different from typical TypeScript defaults.

### 1. Explicit Type Annotations Required

All variables, parameters, return types, and class properties must have explicit type annotations. This is automatically fixed by running fix.

```typescript
// ❌ BAD - no type annotation
const count = 5;
const name = "hello";
function process(data) { ... }
function getData() { return items; }

// ✅ GOOD - explicit types
const count: number = 5;
const name: string = "hello";
function process(data: InputData): void { ... }
function getData(): Array<Item> { return items; }
```

**Exceptions:**

- Destructuring patterns are allowed without type annotations - when the type definition would be longer than 100 characters.
- Arrow function shorthand (single expression, no block) is allowed without return type

### 2. No Inline Complex Types

Complex types must be extracted to named `type` aliases. Do NOT use inline:

- Union types (except simple `T | null` or `T | undefined`)
- Intersection types
- Object literal types
- Tuple types
- Function types
- Conditional types
- Mapped types

```typescript
// ❌ BAD - inline complex types
const handler: (x: number) => void = ...;
const data: { name: string; age: number } = ...;
const result: "success" | "error" | "pending" = ...;
const pair: [string, number] = ...;

// ✅ GOOD - extract to named types. Name the types in descriptive way - not patterns like [function name]Input, [function name]Output, and so on.
type Handler = (x: number) => void;
type Data = { name: string; age: number };
type Result = "success" | "error" | "pending";
type Pair = [string, number];

const handler: Handler = ...;
const data: Data = ...;
const result: Result = ...;
const pair: Pair = ...;
```

### 3. No Inline Return Values

Do NOT return computed values directly. Assign to a variable first, then return the variable. All return paths must return the same type:

```typescript
// ❌ BAD - inline returns
function getName(): string {
  return "hello";
}
function calculate(): number {
  return a + b;
}
function buildObject(): Config {
  return { key: value };
}

// ✅ GOOD - assign then return
function getName(): string {
  const name: string = "hello";
  return name;
}
function calculate(): number {
  const result: number = a + b;
  return result;
}
function buildObject(): Config {
  const config: Config = { key: value };
  return config;
}
```

**Allowed inline returns:**

- Variables/identifiers: `return myVar;`
- Member expressions: `return obj.property;`
- `undefined`: `return undefined;` or `return;`
- Empty string: `return "";`

**NOT allowed inline:**

- Literals (strings, numbers, booleans): `return "hello";` ❌
- `null`: `return null;` ❌
- Object/array literals: `return { ... };` ❌
- Function calls: `return doSomething();` ❌
- Computed expressions: `return a + b;` ❌

### 4. No Duplicate Variable Declarations

Do NOT declare variables with the same name multiple times in a function:

```typescript
// ❌ BAD - same variable name declared twice
function process(): void {
  const result: string = step1();
  // ... more code ...
  const result: string = step2(); // Error!
}

// ✅ GOOD - unique names or reassign
function process(): void {
  const result1: string = step1();
  const result2: string = step2();
}
// OR
function process(): void {
  let result: string = step1();
  result = step2();
}
```

</context>
