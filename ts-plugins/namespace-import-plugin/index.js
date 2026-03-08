/**
 * TypeScript Language Service Plugin — "Add namespace import" code fix.
 *
 * Intercepts the built-in "Add import" quick-fixes and adds a namespace-import
 * variant so the Ctrl+. menu offers:
 *   import * as Bar from './bar'
 * alongside the standard named-import suggestion.
 *
 * Uses the same PascalCase naming convention as the ESLint rule
 * enforce-namespace-imports.
 */

// Shared with eslint-rules/enforce-namespace-imports.cjs
function computeNamespaceName(source) {
  const isRelative = source.startsWith("./") || source.startsWith("../");
  let base;

  if (isRelative) {
    const segments = source.split("/");
    let lastSegment = segments[segments.length - 1];
    lastSegment = lastSegment.replace(/\.(js|ts|mjs|cjs|jsx|tsx)$/, "");
    if (lastSegment === "index" && segments.length >= 2) {
      base = segments[segments.length - 2];
    } else {
      base = lastSegment;
    }
  } else {
    const segments = source.split("/");
    base = segments[segments.length - 1];
  }

  base = base.replace(/^_+/, "");
  const parts = base.split(/[-.]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

function init(modules) {
  const ts = modules.typescript;

  function create(info) {
    const ls = info.languageService;
    const proxy = Object.create(null);

    for (const k of Object.keys(ls)) {
      const x = ls[k];
      proxy[k] = typeof x === "function" ? (...args) => x.apply(ls, args) : x;
    }

    proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
      let original;
      try {
        original = ls.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences);
      } catch {
        // TypeScript internals can crash on certain error codes (e.g. 2304)
        // during code fix generation. Fall through gracefully.
        return [];
      }

      const additional = [];

      for (const fix of original) {
        if (fix.fixName !== "import") continue;
        try {
          const nsFix = createNamespaceVariant(fix, fileName, start, end);
          if (nsFix) additional.push(nsFix);
        } catch (_e) {
          // Silently skip — never break the original suggestions
        }
      }

      return [...additional, ...original];
    };

    return proxy;

    // ── helpers (closed over ls / ts) ──────────────────────────────

    function createNamespaceVariant(originalFix, fileName, identStart, identEnd) {
      const changes = originalFix.changes;
      if (!changes || changes.length === 0) return null;

      const program = ls.getProgram();
      if (!program) return null;
      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return null;

      const identifierText = sourceFile.text.substring(identStart, identEnd);

      for (const fileChange of changes) {
        if (fileChange.fileName !== fileName) continue;

        for (const tc of fileChange.textChanges) {
          const newText = tc.newText;

          // Skip type-only imports
          if (/import\s+type\s/.test(newText)) continue;

          let source = null;
          let exportedName = null;

          // ── Named import: import { foo } from './bar' ──
          const namedMatch = newText.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);

          if (namedMatch) {
            source = namedMatch[2];
            const specifiers = namedMatch[1].split(",").map((s) => s.trim());

            for (const spec of specifiers) {
              const clean = spec.replace(/^type\s+/, "");
              const asParts = clean.split(/\s+as\s+/);
              const localName = (asParts.length > 1 ? asParts[1] : asParts[0]).trim();
              if (localName === identifierText) {
                exportedName = asParts[0].trim();
                break;
              }
            }
            if (!exportedName) exportedName = identifierText;
          }

          // ── Default import: import foo from './bar' ──
          if (!source) {
            const defaultMatch = newText.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
            if (defaultMatch && defaultMatch[1] === identifierText) {
              source = defaultMatch[2];
              exportedName = "default";
            }
          }

          if (!source) continue;

          const nsName = computeNamespaceName(source);
          const quote = newText.includes("'") ? "'" : '"';

          // ── Already imported as namespace? Just qualify the usage ──
          const existingNs = findExistingNamespaceImport(sourceFile, source);

          if (existingNs) {
            const usageName = exportedName === "default" ? existingNs : `${existingNs}.${exportedName}`;

            return {
              fixName: "namespaceImport",
              description: `Use existing namespace: ${usageName}`,
              changes: [
                {
                  fileName,
                  textChanges: [
                    {
                      span: { start: identStart, length: identEnd - identStart },
                      newText: usageName,
                    },
                  ],
                },
              ],
            };
          }

          // ── Build new namespace import ──
          const importLine = newText.replace(/import\s+(?:\{[^}]+\}|\w+)\s+from/, `import * as ${nsName} from`);

          const usageName = exportedName === "default" ? nsName : `${nsName}.${exportedName}`;

          return {
            fixName: "namespaceImport",
            description: `Add namespace import: import * as ${nsName} from ${quote}${source}${quote}`,
            changes: [
              {
                fileName,
                textChanges: [
                  { span: tc.span, newText: importLine },
                  {
                    span: { start: identStart, length: identEnd - identStart },
                    newText: usageName,
                  },
                ],
              },
            ],
          };
        }
      }

      return null;
    }

    function findExistingNamespaceImport(sourceFile, moduleSpecifier) {
      for (const stmt of sourceFile.statements) {
        if (stmt.kind !== ts.SyntaxKind.ImportDeclaration) continue;
        if (!stmt.moduleSpecifier || !stmt.importClause) continue;
        if (stmt.moduleSpecifier.kind !== ts.SyntaxKind.StringLiteral) continue;
        if (stmt.moduleSpecifier.text !== moduleSpecifier) continue;

        const bindings = stmt.importClause.namedBindings;
        if (bindings && bindings.kind === ts.SyntaxKind.NamespaceImport) {
          return bindings.name.text;
        }
      }
      return null;
    }
  }

  return { create };
}

module.exports = init;
