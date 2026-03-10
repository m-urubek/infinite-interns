#!/usr/bin/env node

/**
 * Check for unused exports across the entire package
 *
 * Analyzes all TypeScript/JavaScript files to find:
 * - Exports that are never imported elsewhere in the package
 * - Suggests moving them to index files for public API or removing them
 *
 * Usage: node scripts/check-exports.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Configuration
const config = {
  srcDir: path.join(projectRoot, "src"),
  indexFilePatterns: ["index.ts", "index.tsx", "index.js", "index.jsx"],
  ignoreUnderscorePrefixed: true,
};

// Regex patterns for parsing
const exportPatterns = {
  // export const x = ...
  // export function x() ...
  // export class X {}
  // export type X = ...
  // export interface X {}
  declaration: /export\s+(const|let|var|function|class|type|interface)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
  // export { x, y, z }
  namedExports: /export\s*\{([^}]+)\}/g,
  // import from
  imports: /import\s+(?:\{([^}]+)\}|(?:\*\s+as\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)|([a-zA-Z_$][a-zA-Z0-9_$]*))/g,
};

/**
 * @typedef {Object} Export
 * @property {string} name
 * @property {string} file
 * @property {number} line
 */

/**
 * @typedef {Object} ImportInfo
 * @property {string} name
 * @property {string} from
 */

const allExports = new Map(); // { "name" -> Export }
const allImports = new Set(); // { "name" }

/**
 * Get all TypeScript/JavaScript files in a directory
 * @param {string} dir
 * @param {Function} [filter]
 * @returns {string[]}
 */
function getAllFiles(dir, filter) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && (!filter || filter(fullPath))) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Parse exports from a file
 * @param {string} filePath
 * @returns {Export[]}
 */
function parseExports(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const exports = [];

  // Skip index files - they're meant to re-export
  const isIndexFile = config.indexFilePatterns.some((pattern) => filePath.endsWith(pattern));
  if (isIndexFile) {
    return exports;
  }

  let match;

  // Find named declarations: export const/function/class/type/interface
  const declRegex = /export\s+(const|let|var|function|class|type|interface)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  while ((match = declRegex.exec(content)) !== null) {
    const name = match[2];
    if (!config.ignoreUnderscorePrefixed || !name.startsWith("_")) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      exports.push({ name, file: filePath, line: lineNum });
    }
  }

  // Find named exports: export { x, y as Z }
  const namedRegex = /export\s*\{([^}]+)\}/g;
  while ((match = namedRegex.exec(content)) !== null) {
    const names = match[1];
    const nameMatches = [...names.matchAll(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:as\s+([a-zA-Z_$][a-zA-Z0-9_$]*))?/g)];
    for (const nameMatch of nameMatches) {
      const name = nameMatch[2] || nameMatch[1]; // Use alias if present
      if (!config.ignoreUnderscorePrefixed || !name.startsWith("_")) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        exports.push({ name, file: filePath, line: lineNum });
      }
    }
  }

  return exports;
}

/**
 * Parse imports from a file
 * @param {string} filePath
 * @returns {string[]}
 */
function parseImports(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const imports = new Set();

  // import { x, y } from "..."
  const namedRegex = /import\s+\{([^}]+)\}\s+from\s+["']/g;
  let match;
  while ((match = namedRegex.exec(content)) !== null) {
    const names = match[1];
    const nameMatches = [...names.matchAll(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:as\s+([a-zA-Z_$][a-zA-Z0-9_$]*))?/g)];
    for (const nameMatch of nameMatches) {
      const localName = nameMatch[2] || nameMatch[1]; // Use alias if present
      imports.add(localName);
    }
  }

  // import * as x from "..."
  const starRegex = /import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+["']/g;
  while ((match = starRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // import x from "..." (default)
  const defaultRegex = /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+["']/g;
  while ((match = defaultRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

/**
 * Check if name is used anywhere in the codebase
 * @param {string} name
 * @param {string[]} files
 * @returns {boolean}
 */
function isNameUsed(name, files) {
  // Check all files for the name (excluding the file where it's defined)
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    // Simple check: does the name appear in identifiers?
    // This is a heuristic and may have false positives/negatives
    const regex = new RegExp(`\\b${name}\\b`, "g");
    if (regex.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Main check
 */
function checkUnusedExports() {
  console.log("🔍 Checking for unused exports in package...\n");

  const allFiles = getAllFiles(config.srcDir);
  const exportsByName = new Map();
  const allImportedNames = new Set();

  // Collect all exports
  for (const file of allFiles) {
    const exports = parseExports(file);
    const imports = parseImports(file);

    for (const imp of imports) {
      allImportedNames.add(imp);
    }

    for (const exp of exports) {
      if (!exportsByName.has(exp.name)) {
        exportsByName.set(exp.name, []);
      }
      const expList = exportsByName.get(exp.name);
      if (expList) {
        expList.push(exp);
      }
    }
  }

  // Check for unused exports
  const unused = [];

  for (const [name, exports] of exportsByName) {
    if (!allImportedNames.has(name)) {
      unused.push(...exports);
    }
  }

  if (unused.length === 0) {
    console.log("✅ No unused exports found!\n");
    process.exit(0);
  }

  console.log(`❌ Found ${unused.length} unused export(s):\n`);

  for (const exp of unused.sort((a, b) => a.file.localeCompare(b.file))) {
    const relPath = path.relative(projectRoot, exp.file);
    console.log(`  ${relPath}:${exp.line}`);
    console.log(`    Export '${exp.name}' is not imported anywhere in the package`);
    console.log(`    → Re-export from index.ts or remove if no longer needed\n`);
  }

  process.exit(1);
}

// Run check
checkUnusedExports();
