<context>
# Orchestration Tools - Technical Summary

> This document provides technical context for AI agents working on this codebase.

## Project Overview

Orchestration Tools is a LangChain-based autonomous software development pipeline. It uses LangGraph to orchestrate specialized AI agents that collaborate to implement features from a task description. The project is in active development — the architecture has been modularized into composable subgraphs, with only the PRD generator agent currently implemented. Other agents will be added incrementally.

**Key Architecture Note:** The system uses the `deepagents` npm package from LangChain, which provides built-in filesystem tools, planning capabilities, and subagent support. Agents use custom wrapper backends (`ReadOnlyBackend`, `ReadOnlyShellBackend`) to enforce permission boundaries.

## Technology Stack

- **Framework**: LangChain + LangGraph (TypeScript, ES Modules)
- **LLM Provider**: Google Gemini (`gemini-3-flash-preview` model)
- **Agent Framework**: `deepagents` v1.8.1 (provides filesystem tools, planning, subagents)
- **Orchestration**: LangGraph StateGraph with subgraph composition
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
├── agents/                           # Specialized agents (each in own directory)
│   └── prd-generator/                # PRD generation agent
│       ├── prd-generator-graph.ts    # Subgraph: setup → invoke → process
│       └── prd-generator-types.ts    # State types for PRD generator
├── backends/                         # Permission-enforcing backend wrappers
│   ├── read-only-backend.ts          # Read-only filesystem (blocks write/edit)
│   └── read-only-shell-backend.ts    # Read + execute (blocks write/edit)
├── invoke-agent-graph/               # Reusable agent invocation subgraph
│   ├── invoke-agent-graph-factory.ts # Factory: creates invoke subgraph with retries
│   ├── invoke-agent-internal-utility.ts # Core: instantiates deepagent + validates output
│   ├── invoke-agent-types.ts         # State/IO types for invoke graph
│   └── invoke-agent-annotations.ts   # LangGraph annotations (legacy, mostly commented)
├── main-pipeline-graph/              # Top-level pipeline orchestration
│   ├── main-pipeline-graph.ts        # Main graph: currently prdGenerator only
│   ├── main-pipeline-annotations.ts  # State annotations for pipeline
│   ├── main-pipeline-types.ts        # Type definitions (ClarifyingQuestion, etc.)
│   └── main-pipeline-utility.ts      # (empty, placeholder)
└── shared/                           # Shared utilities
    ├── gemini-flash-model.ts         # Singleton Gemini Flash LLM instance
    ├── shared-types.ts               # Common type aliases (AnnotationRoot)
    └── shared-utility.ts             # Helpers: lastValue, isNotNull, sleep, etc.

eslint-rules/                         # Custom ESLint rules
├── enforce-explicit-types.cjs        # Strict typing enforcement
├── enforce-namespace-imports.cjs     # import * as Name style
├── enforce-brackets.cjs              # Control structure brackets
└── no-unused-exports.cjs             # Unused export detection (currently off)

ts-plugins/                           # TypeScript compiler plugins
└── namespace-import-plugin/          # Enforces namespace imports at TS level

langgraph.json                        # LangGraph CLI config (needs update)
```

## Architecture Patterns

### 1. Composable Subgraph Pattern

The pipeline is built from composable LangGraph subgraphs. Each agent is a self-contained subgraph that can be independently tested and composed into the main pipeline.

```
Main Pipeline Graph
  └── PRD Generator Subgraph
        └── Invoke Agent Subgraph (reusable)
              └── DeepAgent (from deepagents package)
```

### 2. Invoke Agent Graph (Reusable)

The `invoke-agent-graph` module is a generic, reusable subgraph for invoking any deepagent with retry logic. Created via factory function:

```typescript
createInvokeAgentGraph(
  backendClass,         // Backend type (ReadOnly, ReadOnlyShell, LocalShell)
  model,                // LLM model instance
  systemPrompt,         // Agent system prompt
  responseZod,          // Zod schema for structured output validation
  maxInSessionAttempts,  // Retries within same session (default 3)
  maxSessionAttempts     // Fresh session retries (default 3)
)
```

**Flow:** firstInvoke → [success? → end] / [fail? → repeat → ...]

Retry logic includes exponential backoff (5s sleep between retries).

### 3. Agent Directory Pattern

Each agent lives in its own directory under `src/agents/` with:
- `*-graph.ts` — The subgraph definition (setup → invoke → process nodes)
- `*-types.ts` — State and IO type definitions

### 4. Backend Permission Model

Agents have different filesystem access levels enforced at the backend level:

| Backend              | Capabilities                              | Use Case                    |
| -------------------- | ----------------------------------------- | --------------------------- |
| `ReadOnlyBackend`    | read_file, glob, grep, ls (NO write)      | Analysis-only agents        |
| `ReadOnlyShellBackend` | read + execute (NO write)               | Verification agents         |
| `LocalShellBackend`  | **FULL ACCESS** (read, write, execute)    | Implementation agents       |

When a read-only agent attempts to write, it receives an error response rather than silently succeeding.

## Currently Implemented

### PRD Generator Agent

- **Purpose**: Generates a Product Requirements Document from a task description
- **Backend**: `ReadOnlyBackend` (read-only filesystem access)
- **Zod Schema**: Validates `precision` (0-100) and `prd` (min 100 chars)
- **System Prompt**: Instructions to analyze codebase using tools, incorporate clarifications, generate PRD with sections: Overview, Requirements, Acceptance Criteria, Constraints, Out of Scope

### Main Pipeline

- **Input**: `assignment` (task description) + `projectDir` (target project path)
- **Current Flow**: `__start__` → `prdGeneratorGraph` → `__end__`
- **Checkpointing**: Uses `MemorySaver` for in-memory state persistence
- **Exports**: Both compiled `graph` and uncompiled `graphBuilder`

## Core Data Models

### ClarifyingQuestion

```typescript
type ClarifyingQuestion = {
  question: string;
  answer: string | null | undefined;
};

type ClarifyingQuestions = Array<ClarifyingQuestion>;
```

### InvokeAgentState

```typescript
type InvokeAgentState = {
  input: InvokeAgentInput;    // { conversationHistory, userMessage }
  output: InvokeAgentOutput;  // { result: ZodObject output }
  internal: InvokeAgentInternal; // { succeeded, errorMessage, attempt counters }
};
```

### PrdGeneratorState

```typescript
type PrdGeneratorState = {
  input: PrdGeneratorInput;   // { assignment, clarifications }
  output: PrdGeneratorOutput; // { prd, clarifications }
};
```

## Shared Utilities

- **`lastValue<T>()`**: "Last write wins" reducer for LangGraph state annotations
- **`isNotNullOrUndf()`**: Type guard for non-null/undefined values
- **`isNotNullOrEmpty()`**: Type guard for non-empty arrays/strings
- **`applyDefault<T>()`**: Apply default value if target is null/undefined
- **`sleep()`**: Promise-based sleep using Node timers
- **`geminiFlashLLMMedium`**: Singleton Gemini Flash model (temp 0.5)
- **`AnnotationRoot`**: Type alias for LangGraph `Annotation.Root` return type

## Running the Project

### Development Server (LangGraph Studio)

```bash
npm run dev
```

Opens LangGraph Studio at `http://localhost:8123`.

### Environment Variables

```env
GOOGLE_API_KEY=your-google-api-key
LANGSMITH_API_KEY=your-langsmith-key  # Optional, for tracing
LANGGRAPH_SCHEMA_RESOLVE_TIMEOUT_MS=120000
```

## Lint and TypeScript

Always run `npm run fix` when you make changes in .ts files. This runs formatting (Prettier), lint check (ESLint with auto-fix), and TypeScript type checking. It returns even TypeScript errors, not only lints. This command is all you need to check your code.

## Code Style Requirements

This project uses custom ESLint rules that enforce strict typing patterns different from typical TypeScript defaults.

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

### 5. Namespace Imports

All imports must use namespace import style:

```typescript
// ❌ BAD
import { StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// ✅ GOOD
import * as LangGraph from "@langchain/langgraph";
import * as LangChainGoogleGenai from "@langchain/google-genai";
```

Type-only imports use inline `type` keyword:

```typescript
import { type SomeType } from "./types.js";
```

### 6. Bracket Enforcement

All control structures (if, else, for, while, etc.) must use brackets, even for single-line bodies.

## Agents Planned for Future Implementation

The following agents existed in the previous architecture and will be re-added as modular subgraphs:

- **PRD Analyzer** — Analyzes PRD for gaps (interactive mode)
- **Business Analyzer** — Analyzes PRD for business gaps (autonomous mode)
- **Clarification Answerer** — Answers technical questions from analyzers
- **Planner** — Divides PRD into sequential assignments
- **Microplanner** — Creates step-by-step implementation plans
- **Implementer** — Writes actual code (only agent with full write access)
- **Verifier** — Verifies each assignment's implementation
- **Final Verifier** — Final verification against full PRD

</context>
