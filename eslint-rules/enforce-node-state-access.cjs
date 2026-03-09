// @ts-check

/**
 * ESLint rule: enforce-node-state-access
 *
 * Enforces that LangGraph pipeline node/agent files only write to their own
 * state property (and invokeAgentState). Reads are unrestricted.
 *
 * Ownership is derived from the file's directory name under src/agents/ or
 * src/nodes/ — converted to camelCase + "State".
 *
 * State properties are auto-discovered from main-pipeline-annotations.ts
 * by extracting all property names ending in "State" from the
 * mainPipelineStateAnnotation block. No hardcoded list needed.
 *
 * Known limitation: aliased or destructured state variables are not tracked
 * (e.g. `const s = state; s.X.output = ...`). These patterns are not used
 * in the codebase.
 */

const fs = require("fs");
const path = require("path");

const ANNOTATIONS_RELATIVE_PATH =
  "src/main-pipeline-graph/main-pipeline-annotations.ts";

/** @type {string[] | null} */
let cachedStateProperties = null;

/**
 * Read main-pipeline-annotations.ts and extract all property names ending
 * in "State" from the mainPipelineStateAnnotation block.
 *
 * @param {string} filePath - Path of the file being linted (used to find project root)
 * @returns {string[]}
 */
function discoverStateProperties(filePath) {
  if (cachedStateProperties !== null) {
    return cachedStateProperties;
  }

  const normalized = filePath.replace(/\\/g, "/");
  const srcIndex = normalized.indexOf("/src/");
  if (srcIndex === -1) {
    return [];
  }

  const projectRoot = normalized.substring(0, srcIndex);
  const annotationsPath = path.join(projectRoot, ANNOTATIONS_RELATIVE_PATH);

  try {
    const content = fs.readFileSync(annotationsPath, "utf-8");

    // Extract the mainPipelineStateAnnotation block
    const annotationStart = content.indexOf(
      "mainPipelineStateAnnotation",
    );
    if (annotationStart === -1) {
      return [];
    }
    const block = content.substring(annotationStart);

    // Match all property names ending in "State" followed by a colon
    const regex = /(\w+State)\s*:/g;
    const properties = [];
    let match;
    while ((match = regex.exec(block)) !== null) {
      properties.push(match[1]);
    }

    // Deduplicate (in case of duplicates from spread or comments)
    cachedStateProperties = [...new Set(properties)];
    return cachedStateProperties;
  } catch (_e) {
    return [];
  }
}

/**
 * Convert a kebab-case directory name to camelCase + "State".
 * e.g. "prd-generator" -> "prdGeneratorState"
 *      "answer-clarifications" -> "answerClarificationsState"
 * @param {string} dirName
 * @returns {string}
 */
function dirNameToStateProp(dirName) {
  const parts = dirName.split("-");
  const camel =
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("");
  return camel + "State";
}

/**
 * Walk a MemberExpression chain inward (via .object) to find the first
 * property name that matches a known state property.
 *
 * For `state.controllerState.internal.builderAttempts`:
 *   builderAttempts -> internal -> controllerState (match!)
 *
 * @param {import("estree").MemberExpression} memberExpr
 * @param {Set<string>} statePropertySet
 * @returns {string | null}
 */
function extractWrittenStateProperty(memberExpr, statePropertySet) {
  let current = memberExpr;
  while (current.type === "MemberExpression") {
    if (
      !current.computed &&
      current.property.type === "Identifier" &&
      statePropertySet.has(current.property.name)
    ) {
      return current.property.name;
    }
    current = current.object;
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that LangGraph pipeline nodes only write to their own state property (and invokeAgentState)",
    },
    schema: [
      {
        type: "object",
        properties: {
          stateProperties: {
            type: "array",
            items: { type: "string" },
            description: "All state property names in the pipeline",
          },
          crossStateExceptions: {
            type: "object",
            additionalProperties: {
              type: "array",
              items: { type: "string" },
            },
            description:
              "Map of directory-name -> array of additional state properties the node may write to",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbiddenStateWrite:
        "Node '{{nodeName}}' must not write to '{{stateProperty}}'. Each node may only write to its own state ('{{ownState}}') and 'invokeAgentState'. To pass data to downstream nodes, write to your own output — downstream nodes read it directly from there.",
      forbiddenReturnKey:
        "Node '{{nodeName}}' must not include '{{stateProperty}}' in the return/update object. Each node may only return its own state ('{{ownState}}') and 'invokeAgentState'. To pass data to downstream nodes, write to your own output — downstream nodes read it directly from there.",
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const normalized = filename.replace(/\\/g, "/");
    const match = normalized.match(/src\/(agents|nodes)\/([^/]+)\//);
    if (!match) {
      return {};
    }

    const dirName = match[2];
    const ownStateProp = dirNameToStateProp(dirName);

    const options = context.options[0] || {};
    const stateProperties =
      options.stateProperties || discoverStateProperties(normalized);
    const crossStateExceptions = options.crossStateExceptions || {};

    const statePropertySet = new Set(stateProperties);
    const allowedSet = new Set([
      "invokeAgentState",
      ownStateProp,
      ...(crossStateExceptions[dirName] || []),
    ]);

    /**
     * @param {import("estree").Node} node
     * @param {string} stateProp
     * @param {string} messageId
     */
    function reportIfForbidden(node, stateProp, messageId) {
      if (!statePropertySet.has(stateProp)) {
        return;
      }
      if (allowedSet.has(stateProp)) {
        return;
      }
      context.report({
        node,
        messageId,
        data: {
          nodeName: dirName,
          stateProperty: stateProp,
          ownState: ownStateProp,
        },
      });
    }

    /**
     * Check object literal keys for forbidden state properties.
     * @param {import("estree").ObjectExpression} objExpr
     */
    function checkObjectKeys(objExpr) {
      for (const prop of objExpr.properties) {
        if (prop.type === "SpreadElement") {
          continue;
        }
        const keyName =
          prop.key.type === "Identifier"
            ? prop.key.name
            : prop.key.type === "Literal"
              ? String(prop.key.value)
              : null;
        if (keyName !== null) {
          reportIfForbidden(prop, keyName, "forbiddenReturnKey");
        }
      }
    }

    return {
      AssignmentExpression(node) {
        if (node.left.type !== "MemberExpression") {
          return;
        }
        const stateProp = extractWrittenStateProperty(
          node.left,
          statePropertySet,
        );
        if (stateProp !== null) {
          reportIfForbidden(node, stateProp, "forbiddenStateWrite");
        }
      },

      UpdateExpression(node) {
        if (node.argument.type !== "MemberExpression") {
          return;
        }
        const stateProp = extractWrittenStateProperty(
          node.argument,
          statePropertySet,
        );
        if (stateProp !== null) {
          reportIfForbidden(node, stateProp, "forbiddenStateWrite");
        }
      },

      UnaryExpression(node) {
        if (node.operator !== "delete") {
          return;
        }
        if (node.argument.type !== "MemberExpression") {
          return;
        }
        const stateProp = extractWrittenStateProperty(
          node.argument,
          statePropertySet,
        );
        if (stateProp !== null) {
          reportIfForbidden(node, stateProp, "forbiddenStateWrite");
        }
      },

      ReturnStatement(node) {
        if (!node.argument || node.argument.type !== "ObjectExpression") {
          return;
        }
        checkObjectKeys(node.argument);
      },

      // Catch `const update: Partial<MainPipelineState> = { builderState: ... }`
      VariableDeclarator(node) {
        if (!node.init || node.init.type !== "ObjectExpression") {
          return;
        }
        checkObjectKeys(node.init);
      },
    };
  },
};
