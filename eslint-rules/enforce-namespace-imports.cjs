/**
 * Custom ESLint rule: enforce-namespace-imports
 *
 * Forces all imports to use `import * as Name` namespace syntax.
 * The only exception is `import type` declarations.
 *
 * The rule does NOT enforce the chosen namespace name — any name is valid.
 * The error message includes a suggested conventional name derived from
 * the filename (for local imports) or package name (for external imports).
 *
 * For index files, the parent directory name is used for the suggestion.
 */

/**
 * Compute a suggested PascalCase namespace name from an import source string.
 * @param {string} source - The import source (e.g. "./shared/shared-utility.js" or "@langchain/langgraph")
 * @returns {string}
 */
function computeSuggestedName(source) {
  const isRelative = source.startsWith("./") || source.startsWith("../");

  let base;

  if (isRelative) {
    const segments = source.split("/");
    let lastSegment = segments[segments.length - 1];

    // Strip known extensions
    lastSegment = lastSegment.replace(/\.(js|ts|mjs|cjs|jsx|tsx)$/, "");

    // If basename is "index", use parent directory name instead
    if (lastSegment === "index" && segments.length >= 2) {
      base = segments[segments.length - 2];
    } else {
      base = lastSegment;
    }
  } else {
    // External package: take the last segment after "/"
    // e.g. "@langchain/langgraph" → "langgraph", "zod" → "zod"
    const segments = source.split("/");
    base = segments[segments.length - 1];
  }

  // Strip leading underscores
  base = base.replace(/^_+/, "");

  // Split on hyphens and dots, capitalize each part
  const parts = base.split(/[-.]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce all imports use 'import * as Name' namespace syntax (except import type)",
      recommended: false,
    },
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          ignorePatterns: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "Regex patterns for import source paths to skip (e.g. ['node:.*'])",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      namespaceRequired: "Import must use namespace syntax. Suggested: import * as {{suggested}} from '{{source}}'",
      suggestNamespace: "Convert to namespace import: import * as {{suggested}}",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const ignorePatterns = (options.ignorePatterns || []).map((p) => new RegExp(p));

    return {
      ImportDeclaration(node) {
        // Skip type-only imports (import type { ... })
        if (node.importKind === "type") return;

        // Skip side-effect imports (zero specifiers)
        if (node.specifiers.length === 0) return;

        const source = node.source.value;

        // Skip if source matches any ignore pattern
        if (ignorePatterns.some((re) => re.test(source))) return;

        // Check if the import already uses namespace syntax
        if (node.specifiers.length === 1 && node.specifiers[0].type === "ImportNamespaceSpecifier") {
          return; // Any name is accepted
        }

        // Separate value specifiers from type specifiers (import { type Foo })
        const valueSpecifiers = node.specifiers.filter((s) => s.importKind !== "type");
        const typeSpecifiers = node.specifiers.filter((s) => s.importKind === "type");

        // If there are no value specifiers, only types — skip entirely
        if (valueSpecifiers.length === 0) return;

        // Report error with suggested name
        const suggested = computeSuggestedName(source);

        /**
         * Collect all fixes: rewrite the import statement and prefix every
         * usage of each value binding with the namespace name.
         * Type specifiers are preserved as a separate import type statement.
         */
        function buildFixes(fixer) {
          const sourceCode = context.sourceCode;
          const fixes = [];

          const importText = sourceCode.getText(node);
          const quoteChar = importText.includes("'") ? "'" : '"';

          // Build the namespace import for value specifiers
          let newImport = `import * as ${suggested} from ${quoteChar}${source}${quoteChar}`;

          // If there were type specifiers mixed in, preserve them as import type
          if (typeSpecifiers.length > 0) {
            const typeNames = typeSpecifiers
              .map((s) => {
                const imported = s.imported ? s.imported.name : s.local.name;
                const local = s.local.name;
                return imported !== local ? `${imported} as ${local}` : imported;
              })
              .join(", ");
            newImport += `;\nimport type { ${typeNames} } from ${quoteChar}${source}${quoteChar}`;
          }

          fixes.push(fixer.replaceText(node, newImport));

          // For each value specifier, find all references and prefix them
          const scope = sourceCode.getScope(node);

          for (const specifier of valueSpecifiers) {
            const localName = specifier.local.name;
            const exportedName =
              specifier.type === "ImportDefaultSpecifier"
                ? "default"
                : specifier.type === "ImportSpecifier"
                  ? (specifier.imported && specifier.imported.name) || localName
                  : null;

            if (!exportedName) continue;

            const variable = scope.variables.find((v) => v.name === localName);
            if (!variable) continue;

            for (const ref of variable.references) {
              const refNode = ref.identifier;
              // Skip the import specifier itself
              if (refNode.range[0] >= node.range[0] && refNode.range[1] <= node.range[1]) {
                continue;
              }
              fixes.push(fixer.replaceText(refNode, `${suggested}.${exportedName}`));
            }
          }

          return fixes;
        }

        context.report({
          node,
          messageId: "namespaceRequired",
          data: { suggested, source },
          suggest: [
            {
              messageId: "suggestNamespace",
              data: { suggested },
              fix: buildFixes,
            },
          ],
        });
      },
    };
  },
};

// Export for testing
module.exports.computeSuggestedName = computeSuggestedName;
