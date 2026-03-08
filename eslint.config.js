import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const enforceExplicitTypes = require("./eslint-rules/enforce-explicit-types.cjs");
const noUnusedExports = require("./eslint-rules/no-unused-exports.cjs");
const enforceNamespaceImports = require("./eslint-rules/enforce-namespace-imports.cjs");
const enforceBrackets = require("./eslint-rules/enforce-brackets.cjs");

const localPlugin = {
  rules: {
    "enforce-explicit-types": enforceExplicitTypes,
    "no-unused-exports": noUnusedExports,
    "enforce-namespace-imports": enforceNamespaceImports,
    "enforce-brackets": enforceBrackets,
  },
};

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      local: localPlugin,
    },
    rules: {
      // Rule 1: All variables must specify type
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/typedef": [
        "error",
        {
          arrayDestructuring: false,
          arrowParameter: true,
          memberVariableDeclaration: true,
          objectDestructuring: false,
          parameter: true,
          propertyDeclaration: true,
          variableDeclaration: false,
          variableDeclarationIgnoreFunction: true,
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // Rule 2: Forbid anonymous types
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-type-alias": "off",
      "@typescript-eslint/array-type": ["error", { default: "generic" }],

      // Rule 3: Forbid == and !=, enforce === and !==
      // WARNING: Do NOT use --fix for eqeqeq errors! Manually review each case as == vs === have different behavior
      eqeqeq: ["error", "always"],
      "@typescript-eslint/strict-boolean-expressions": "off",

      // Additional strict rules for better type safety
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      // Unused variables/parameters and imports
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "no-unused-vars": "off",

      // Null safety rules - prevent null/undefined reference exceptions
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "no-null/no-null": "off",

      // Custom rule: enforce explicit types, named type aliases, and variable returns
      "local/enforce-explicit-types": [
        "error",
        {
          // Type annotation settings
          maxTypeLength: 100,
          checkVariables: true,
          checkParameters: true,
          checkReturnTypes: true,
          checkPropertyDeclarations: true,
          ignoreArrowShorthand: true,
          ignoreDestructuring: true,
          // Inline complex types settings
          allowInlineUnions: false,
          allowInlineIntersections: false,
          allowInlineObjectTypes: false,
          allowInlineTuples: false,
          allowInlineFunctionTypes: false,
          allowInlineConditionalTypes: false,
          allowInlineMappedTypes: false,
          maxUnionMembers: 1, // Only allow nullish unions (T | null, T | undefined)
          // Return value settings
          checkReturns: true,
          allowReturnMemberExpressions: true,
          allowReturnUndefined: true,
          allowReturnEmptyString: true,
          // TypeScript errors (replaces tsc --noEmit)
          checkTypescriptErrors: true,
          // Duplicate variables in same function
          checkDuplicateVariables: true,
          // Explicit nullability — every type must include | null | undefined or NonNullable<>
          checkExplicitNullability: true,
        },
      ],

      // Custom rule: detect unused exports (except in index files)
      // NOTE: Package-level unused export detection requires a tool outside ESLint's per-file architecture
      // Use 'npm run check-exports' or 'ts-unused-exports' for package-wide analysis
      "local/no-unused-exports": "off",

      // Enforce `import { type Foo }` for type-only bindings (inline style)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Custom rule: enforce namespace imports (import * as Name)
      "local/enforce-namespace-imports": "error",

      // Custom rule: enforce brackets on control structures (auto-fixes silently)
      "local/enforce-brackets": "error",
    },
  },
];
