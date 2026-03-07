/**
 * Custom ESLint rule: no-unused-exports
 *
 * Detects exported symbols that are not imported anywhere in the package.
 * Uses shared state across the linting session to track exports and imports.
 *
 * Exceptions:
 * - Files named index.* (meant to re-export)
 * - Items starting with underscore (conventionally unused)
 * - Default exports (assumed to be entry points)
 */

// Shared state across all file lints in this session
const packageState = {
  exports: new Map(), // { "file:name" -> { node, file } }
  imports: new Set(), // { "name" }
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Detect exported symbols that are not imported anywhere in the package",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          ignoredFilePatterns: {
            type: "array",
            items: { type: "string" },
            default: ["index.*"],
            description: "File patterns to ignore (regex strings)",
          },
        },
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const ignoredFilePatterns = options.ignoredFilePatterns || ["index.*"];
    const filename = context.filename;

    // Check if file should be ignored
    const shouldIgnore = ignoredFilePatterns.some((pattern) => {
      const regex = new RegExp(pattern);
      return regex.test(filename);
    });

    return {
      // Collect all exports
      ExportNamedDeclaration(node) {
        if (shouldIgnore) return;

        if (node.declaration) {
          // export const x = ...
          // export function foo() {}
          // export class Foo {}
          // export type T = ...
          const declaration = node.declaration;

          if (declaration.id) {
            const name = declaration.id.name;
            if (!name.startsWith("_")) {
              const key = `${filename}:${name}`;
              packageState.exports.set(key, {
                node: declaration,
                file: filename,
              });
            }
          } else if (
            declaration.declarations &&
            Array.isArray(declaration.declarations)
          ) {
            // export const x = ..., y = ...
            declaration.declarations.forEach((decl) => {
              const name = decl.id.name;
              if (!name.startsWith("_")) {
                const key = `${filename}:${name}`;
                packageState.exports.set(key, { node: decl, file: filename });
              }
            });
          }
        } else if (node.specifiers) {
          // export { x, y } or export { x as X }
          node.specifiers.forEach((spec) => {
            const name = spec.exported.name;
            if (!name.startsWith("_")) {
              const key = `${filename}:${name}`;
              packageState.exports.set(key, { node: spec, file: filename });
            }
          });
        }
      },

      // Track all imports (mark names as used)
      ImportDeclaration(node) {
        node.specifiers.forEach((spec) => {
          const name = spec.local.name;
          packageState.imports.add(name);
        });
      },

      // Also track require() calls
      CallExpression(node) {
        if (
          node.callee.name === "require" ||
          (node.callee.type === "MemberExpression" &&
            node.callee.object.name === "require")
        ) {
          packageState.imports.add("*");
        }
      },

      // Report at the very end (when all files have been processed)
      "Program:exit"() {
        // Only report on the last file (hacky but necessary for shared state)
        // Better approach: move reporting to a separate phase or use a plugin
      },
    };
  },
};

// Export a function to check unused exports (call this after all files are linted)
module.exports.reportUnused = function (context) {
  packageState.exports.forEach((exportData, key) => {
    const name = key.split(":")[1];
    if (!packageState.imports.has(name)) {
      context.report({
        node: exportData.node,
        message: `Export '${name}' is not imported anywhere in the package. If this should be exposed outside the package, re-export it from an index.ts file. Otherwise, remove the export or rename to start with '_' to suppress this warning.`,
      });
    }
  });
};

// Reset state for new linting session
module.exports.resetState = function () {
  packageState.exports.clear();
  packageState.imports.clear();
};
