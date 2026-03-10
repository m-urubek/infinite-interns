/**
 * Custom ESLint rule: enforce-explicit-types
 *
 * A comprehensive rule that combines:
 * 1. Require explicit type annotations (with smart handling of complex types)
 * 2. Disallow inline complex types (require named type aliases)
 * 3. Disallow returning inline values (require returning variables)
 * 4. Report TypeScript compiler errors (optional, replaces tsc --noEmit)
 *
 * Supports auto-fix where applicable.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce explicit types, named type aliases, and variable returns",
      recommended: false,
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          // Type annotation settings
          maxTypeLength: {
            type: "number",
            default: 100,
          },
          checkVariables: {
            type: "boolean",
            default: true,
          },
          checkParameters: {
            type: "boolean",
            default: true,
          },
          checkReturnTypes: {
            type: "boolean",
            default: true,
          },
          checkPropertyDeclarations: {
            type: "boolean",
            default: true,
          },
          ignoreArrowShorthand: {
            type: "boolean",
            default: true,
          },
          ignoreDestructuring: {
            type: "boolean",
            default: true,
          },
          // Inline complex types settings
          allowInlineUnions: {
            type: "boolean",
            default: false,
          },
          allowInlineIntersections: {
            type: "boolean",
            default: false,
          },
          allowInlineObjectTypes: {
            type: "boolean",
            default: false,
          },
          allowInlineTuples: {
            type: "boolean",
            default: false,
          },
          allowInlineFunctionTypes: {
            type: "boolean",
            default: false,
          },
          allowInlineConditionalTypes: {
            type: "boolean",
            default: false,
          },
          allowInlineMappedTypes: {
            type: "boolean",
            default: false,
          },
          maxUnionMembers: {
            type: "number",
            default: 1,
          },
          maxTypeDepth: {
            type: "number",
            default: 4,
          },
          // Return value settings
          checkReturns: {
            type: "boolean",
            default: true,
          },
          allowReturnMemberExpressions: {
            type: "boolean",
            default: true,
          },
          allowReturnUndefined: {
            type: "boolean",
            default: true,
          },
          allowReturnEmptyString: {
            type: "boolean",
            default: true,
          },
          // TypeScript errors settings
          checkTypescriptErrors: {
            type: "boolean",
            default: true,
            description: "Report TypeScript compiler errors (replaces tsc --noEmit)",
          },
          // Duplicate variable names settings
          checkDuplicateVariables: {
            type: "boolean",
            default: true,
            description: "Disallow declaring variables with the same name multiple times in a function",
          },
          // Return type consistency settings
          checkReturnTypeConsistency: {
            type: "boolean",
            default: true,
            description: "Check that all return paths from a function return the same type",
          },
          // Explicit nullability settings
          checkExplicitNullability: {
            type: "boolean",
            default: true,
            description:
              "Require every type annotation to explicitly include | null | undefined or be wrapped in NonNullable<>",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      // Type annotation messages
      missingType: 'Missing explicit type annotation. Inferred type "{{type}}" is short enough to write explicitly.',
      missingReturnType: 'Missing explicit return type. Inferred type "{{type}}" is short enough to write explicitly.',
      missingTypeNeedsAlias:
        "Missing explicit type annotation. Inferred type is complex - create a named type alias for it using typeof or ReturnType.",
      missingReturnTypeNeedsAlias:
        "Missing explicit return type. Inferred type is complex - create a named type alias for it using typeof or ReturnType.",
      // Inline complex types messages
      noInlineUnion: "Inline union type not allowed. Extract to a named `type` alias.",
      noInlineIntersection: "Inline intersection type not allowed. Extract to a named `type` alias.",
      noInlineObject: "Inline object type not allowed. Extract to a named `type` alias.",
      noInlineTuple: "Inline tuple type not allowed. Extract to a named `type` alias.",
      noInlineFunction: "Inline function type not allowed. Extract to a named `type` alias.",
      noInlineConditional: "Inline conditional type not allowed. Extract to a named `type` alias.",
      noInlineMapped: "Inline mapped type not allowed. Extract to a named `type` alias.",
      // Return value messages
      noInlineReturn: "Do not return inline values. Assign to a variable first, then return the variable.",
      // TypeScript error messages
      typescriptError: "TS{{code}}: {{message}}",
      typescriptNullableError: "TS{{code}}: Value may be null or undefined.",
      // Duplicate variable messages
      duplicateVariable:
        'Variable "{{name}}" is already declared in this function. Declare it once at the top and assign to it or change the name if they don\'t share the same type.',
      // Return type consistency messages
      inconsistentReturnTypes:
        "Function returns inconsistent types across paths: {{types}}. Split into separate functions or unify the return type.",
      // Explicit nullability messages
      missingExplicitNullability:
        "Type '{{type}}' must explicitly specify nullability. Add '| null | undefined' or wrap in NonNullable<>.",
      suggestAddNullUndefined: "Add | null | undefined",
      suggestWrapNonNullable: "Wrap in NonNullable<>",
    },
  },

  create(context) {
    const options = context.options[0] || {};

    // Type annotation options
    const maxTypeLength = options.maxTypeLength ?? 100;
    const checkVariables = options.checkVariables ?? true;
    const checkParameters = options.checkParameters ?? true;
    const checkReturnTypes = options.checkReturnTypes ?? true;
    const checkPropertyDeclarations = options.checkPropertyDeclarations ?? true;
    const ignoreArrowShorthand = options.ignoreArrowShorthand ?? true;
    const ignoreDestructuring = options.ignoreDestructuring ?? true;

    // Inline complex types options
    const allowInlineUnions = options.allowInlineUnions ?? false;
    const allowInlineIntersections = options.allowInlineIntersections ?? false;
    const allowInlineObjectTypes = options.allowInlineObjectTypes ?? false;
    const allowInlineTuples = options.allowInlineTuples ?? false;
    const allowInlineFunctionTypes = options.allowInlineFunctionTypes ?? false;
    const allowInlineConditionalTypes = options.allowInlineConditionalTypes ?? false;
    const allowInlineMappedTypes = options.allowInlineMappedTypes ?? false;
    const maxUnionMembers = options.maxUnionMembers ?? 1;
    const maxTypeDepth = options.maxTypeDepth ?? 4;

    // Return value options
    const checkReturns = options.checkReturns ?? true;
    const allowReturnMemberExpressions = options.allowReturnMemberExpressions ?? true;
    const allowReturnUndefined = options.allowReturnUndefined ?? true;
    const allowReturnEmptyString = options.allowReturnEmptyString ?? true;

    // TypeScript errors options
    const checkTypescriptErrors = options.checkTypescriptErrors ?? true;

    // Duplicate variable options
    const checkDuplicateVariables = options.checkDuplicateVariables ?? true;

    // Return type consistency options
    const checkReturnTypeConsistency = options.checkReturnTypeConsistency ?? true;

    // Explicit nullability options
    const checkExplicitNullability = options.checkExplicitNullability ?? true;

    const sourceCode = context.sourceCode;
    const parserServices = sourceCode.parserServices;

    // Type checker (may not be available)
    let checker = null;
    let esTreeNodeToTSNodeMap = null;
    let program = null;
    if (parserServices?.program && parserServices?.esTreeNodeToTSNodeMap) {
      program = parserServices.program;
      checker = program.getTypeChecker();
      esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;
    }

    // ==================== SHARED UTILITIES ====================

    // Cache for node_modules checks to avoid repeated lookups
    const nodeModulesCache = new Map();

    function isFromNodeModules(filePath) {
      if (!filePath) return false;
      const normalized = filePath.replace(/\\/g, "/");
      return normalized.includes("/node_modules/");
    }

    function isTypeFromNodeModules(type) {
      if (!type) return false;

      // Check cache first
      const typeId = type.id ?? type.symbol?.id ?? String(type);
      if (nodeModulesCache.has(typeId)) {
        return nodeModulesCache.get(typeId);
      }

      let result = false;
      try {
        const symbol = type.getSymbol() || type.aliasSymbol;
        if (symbol) {
          const declarations = symbol.getDeclarations();
          if (declarations && declarations.length > 0) {
            for (const decl of declarations) {
              const sourceFile = decl.getSourceFile();
              if (sourceFile && isFromNodeModules(sourceFile.fileName)) {
                result = true;
                break;
              }
            }
          }
        }

        if (!result) {
          // Check type arguments recursively (for generics like Promise<ExternalType>)
          const typeArgs = type.typeArguments || type.aliasTypeArguments;
          if (typeArgs) {
            for (const arg of typeArgs) {
              if (isTypeFromNodeModules(arg)) {
                result = true;
                break;
              }
            }
          }
        }

        if (!result) {
          // Check union/intersection members
          if (type.isUnion && type.isUnion()) {
            for (const member of type.types) {
              if (isTypeFromNodeModules(member)) {
                result = true;
                break;
              }
            }
          }
          if (!result && type.isIntersection && type.isIntersection()) {
            for (const member of type.types) {
              if (isTypeFromNodeModules(member)) {
                result = true;
                break;
              }
            }
          }
        }
      } catch {
        // Ignore errors, assume not from node_modules
      }

      nodeModulesCache.set(typeId, result);
      return result;
    }

    function simplifyLiteralType(type, typeString) {
      // Use TypeScript's type flags to detect literal types
      // This is more reliable than parsing the string representation
      if (type && type.flags) {
        const flags = type.flags;
        // TypeScript TypeFlags:
        // StringLiteral = 128, TemplateLiteral = 134217728
        // NumberLiteral = 256
        // BigIntLiteral = 2048
        // BooleanLiteral = 512

        // Check for string literal (including template literals)
        // flags & 128 = StringLiteral, flags & 134217728 = TemplateLiteral
        if ((flags & 128) !== 0 || (flags & 134217728) !== 0) {
          return "string";
        }

        // Check for number literal
        if ((flags & 256) !== 0) {
          return "number";
        }

        // Check for bigint literal
        if ((flags & 2048) !== 0) {
          return "bigint";
        }

        // Check for boolean literal (true / false)
        if ((flags & 512) !== 0) {
          return "boolean";
        }
      }

      // Fallback: check string representation patterns
      // Single string literal: starts and ends with quotes (double or backtick)
      if (
        (typeString.startsWith('"') && typeString.endsWith('"')) ||
        (typeString.startsWith("`") && typeString.endsWith("`"))
      ) {
        return "string";
      }

      // Single number literal: just a number
      if (/^-?\d+(\.\d+)?$/.test(typeString)) {
        return "number";
      }

      // Single bigint literal
      if (/^-?\d+n$/.test(typeString)) {
        return "bigint";
      }

      // Boolean literals
      if (typeString === "true" || typeString === "false") {
        return "boolean";
      }

      return typeString;
    }

    // ==================== TYPE DEPTH CHECK ====================

    function getTypeDepth(type, currentDepth = 0, visited = new Set()) {
      if (currentDepth > maxTypeDepth) return currentDepth;
      if (!type) return currentDepth;

      const typeId = type.id;
      if (typeId !== undefined) {
        if (visited.has(typeId)) return currentDepth;
        visited.add(typeId);
      }

      let maxDepthFound = currentDepth;

      const typeArgs = type.typeArguments || type.aliasTypeArguments;
      if (typeArgs) {
        for (const arg of typeArgs) {
          const d = getTypeDepth(arg, currentDepth + 1, visited);
          if (d > maxDepthFound) maxDepthFound = d;
          if (maxDepthFound > maxTypeDepth) return maxDepthFound;
        }
      }

      if (type.types) {
        for (const member of type.types) {
          const d = getTypeDepth(member, currentDepth + 1, visited);
          if (d > maxDepthFound) maxDepthFound = d;
          if (maxDepthFound > maxTypeDepth) return maxDepthFound;
        }
      }

      return maxDepthFound;
    }

    // ==================== TYPE ANNOTATION LOGIC ====================

    /**
     * Check if a type is or contains null/undefined union members.
     */
    function typeContainsNullOrUndefined(type) {
      if (!type) return false;
      // TypeFlags: Null = 65536, Undefined = 32768, Void = 16384
      if ((type.flags & 65536) !== 0) return true;
      if ((type.flags & 32768) !== 0) return true;
      if ((type.flags & 16384) !== 0) return true;
      if (type.isUnion && type.isUnion()) {
        return type.types.some((t) => (t.flags & 65536) !== 0 || (t.flags & 32768) !== 0 || (t.flags & 16384) !== 0);
      }
      return false;
    }

    /**
     * Get the non-nullable version of a type string by stripping null/undefined members.
     */
    function getNonNullableTypeString(type, tsNode) {
      const nonNullType = type.getNonNullableType ? type.getNonNullableType() : null;
      if (!nonNullType || nonNullType === type) return null;
      const nonNullStr = checker.typeToString(nonNullType, tsNode, 0);
      if (!nonNullStr || nonNullStr === "never") return null;
      return simplifyLiteralType(nonNullType, nonNullStr);
    }

    function getTypeInfo(node) {
      if (!checker || !esTreeNodeToTSNodeMap) return null;

      try {
        const tsNode = esTreeNodeToTSNodeMap.get(node);
        if (!tsNode) return null;

        const type = checker.getTypeAtLocation(tsNode);
        if (!type) return null;

        if (getTypeDepth(type) > maxTypeDepth) return null;

        let typeString = checker.typeToString(type, tsNode, 0);

        if (!typeString) return null;
        if (typeString === "any" || typeString === "unknown" || typeString === "never") {
          return null;
        }

        // Simplify single literal types to base types
        let simplifiedType = simplifyLiteralType(type, typeString);

        // If the type contains null/undefined, check if the initializer value
        // is actually non-nullable (control-flow narrowed). If so, use NonNullable.
        if (typeContainsNullOrUndefined(type)) {
          // Check if this is a variable declarator with an initializer
          const parent = node.parent;
          if (parent && parent.type === "VariableDeclarator" && parent.init) {
            const initTsNode = esTreeNodeToTSNodeMap.get(parent.init);
            if (initTsNode) {
              const initType = checker.getTypeAtLocation(initTsNode);
              if (initType && !typeContainsNullOrUndefined(initType)) {
                // The initializer is non-nullable — use the non-nullable type directly
                const nonNullStr = getNonNullableTypeString(type, tsNode);
                if (nonNullStr) {
                  simplifiedType = nonNullStr;
                }
              }
            }
          }
        }

        const isShort = simplifiedType.length <= maxTypeLength;
        const isExternal = isTypeFromNodeModules(type);

        return {
          typeString: simplifiedType,
          isShort,
          isExternal,
          shouldReport: isShort || !isExternal,
          canFix: isShort,
        };
      } catch {
        return null;
      }
    }

    function createVariableFix(fixer, node, typeString) {
      return fixer.insertTextAfter(node, `: ${typeString}`);
    }

    function createParameterFix(fixer, node, typeString) {
      return fixer.insertTextAfter(node, `: ${typeString}`);
    }

    function createReturnTypeFix(fixer, node, typeString) {
      let insertPosition = null;

      if (node.type === "ArrowFunctionExpression") {
        if (node.params.length > 0) {
          const lastParam = node.params[node.params.length - 1];
          const tokenAfterParams = sourceCode.getTokenAfter(lastParam);
          if (tokenAfterParams && tokenAfterParams.value === ")") {
            insertPosition = tokenAfterParams;
          } else {
            insertPosition = lastParam;
          }
        } else {
          const arrowToken = sourceCode.getTokenBefore(node.body, (token) => token.value === "=>");
          if (arrowToken) {
            const tokenBeforeArrow = sourceCode.getTokenBefore(arrowToken);
            insertPosition = tokenBeforeArrow;
          }
        }
      } else {
        if (node.params.length > 0) {
          const lastParam = node.params[node.params.length - 1];
          const tokenAfterParams = sourceCode.getTokenAfter(lastParam);
          if (tokenAfterParams && tokenAfterParams.value === ")") {
            insertPosition = tokenAfterParams;
          } else {
            insertPosition = lastParam;
          }
        } else {
          const openParen = sourceCode.getFirstToken(node, (token) => token.value === "(");
          if (openParen) {
            const closeParen = sourceCode.getTokenAfter(openParen, (token) => token.value === ")");
            insertPosition = closeParen;
          }
        }
      }

      if (insertPosition) {
        return fixer.insertTextAfter(insertPosition, `: ${typeString}`);
      }

      return null;
    }

    function checkVariableDeclarator(node) {
      if (!checkVariables) return;
      if (node.id.typeAnnotation) return;

      if (ignoreDestructuring) {
        if (node.id.type === "ArrayPattern" || node.id.type === "ObjectPattern") {
          return;
        }
      }

      if (!node.init) return;

      const info = getTypeInfo(node.id);
      if (info) {
        if (info.shouldReport) {
          if (info.canFix) {
            context.report({
              node: node.id,
              messageId: "missingType",
              data: { type: info.typeString },
              fix(fixer) {
                return createVariableFix(fixer, node.id, info.typeString);
              },
            });
          } else {
            context.report({
              node: node.id,
              messageId: "missingTypeNeedsAlias",
            });
          }
        }
      }
    }

    function checkFunctionParameter(node) {
      if (!checkParameters) return;
      if (node.typeAnnotation) return;

      const info = getTypeInfo(node);
      if (info) {
        if (info.shouldReport) {
          if (info.canFix) {
            context.report({
              node,
              messageId: "missingType",
              data: { type: info.typeString },
              fix(fixer) {
                return createParameterFix(fixer, node, info.typeString);
              },
            });
          } else {
            context.report({
              node,
              messageId: "missingTypeNeedsAlias",
            });
          }
        }
      }
    }

    function checkFunctionReturnType(node, isArrow = false) {
      if (!checkReturnTypes) return;
      if (node.returnType) return;

      if (isArrow && ignoreArrowShorthand && node.body.type !== "BlockStatement") {
        return;
      }

      if (!checker || !esTreeNodeToTSNodeMap) return;

      try {
        const tsNode = esTreeNodeToTSNodeMap.get(node);
        if (!tsNode) return;

        const signature = checker.getSignatureFromDeclaration(tsNode);
        if (!signature) return;

        const returnType = checker.getReturnTypeOfSignature(signature);
        let typeString = checker.typeToString(returnType);

        if (!typeString || typeString === "any" || typeString === "unknown" || typeString === "never") {
          return;
        }

        // Skip primitive return types (except string) — they are obvious from context
        const primitiveReturnTypes = new Set(["boolean", "number", "bigint", "void", "undefined", "null", "symbol"]);
        if (primitiveReturnTypes.has(typeString)) {
          return;
        }

        typeString = simplifyLiteralType(returnType, typeString);

        const isShort = typeString.length <= maxTypeLength;
        const isExternal = isTypeFromNodeModules(returnType);

        if (isShort || !isExternal) {
          if (isShort) {
            context.report({
              node: node.id || node,
              messageId: "missingReturnType",
              data: { type: typeString },
              fix(fixer) {
                return createReturnTypeFix(fixer, node, typeString);
              },
            });
          } else {
            context.report({
              node: node.id || node,
              messageId: "missingReturnTypeNeedsAlias",
            });
          }
        }
      } catch {
        // Ignore errors
      }
    }

    function checkPropertyDefinition(node) {
      if (!checkPropertyDeclarations) return;
      if (node.typeAnnotation) return;
      if (!node.value) return;

      const info = getTypeInfo(node.key);
      if (info) {
        if (info.shouldReport) {
          if (info.canFix) {
            context.report({
              node: node.key,
              messageId: "missingType",
              data: { type: info.typeString },
              fix(fixer) {
                return fixer.insertTextAfter(node.key, `: ${info.typeString}`);
              },
            });
          } else {
            context.report({
              node: node.key,
              messageId: "missingTypeNeedsAlias",
            });
          }
        }
      }
    }

    // ==================== INLINE COMPLEX TYPES LOGIC ====================

    function isNullOrUndefined(typeNode) {
      if (typeNode.type === "TSNullKeyword") return true;
      if (typeNode.type === "TSUndefinedKeyword") return true;
      if (typeNode.type === "TSVoidKeyword") return true;
      if (
        typeNode.type === "TSTypeReference" &&
        typeNode.typeName &&
        typeNode.typeName.type === "Identifier" &&
        (typeNode.typeName.name === "undefined" || typeNode.typeName.name === "null")
      ) {
        return true;
      }
      return false;
    }

    function checkNullishUnion(unionNode) {
      const nonNullishMembers = unionNode.types.filter((t) => !isNullOrUndefined(t));
      return nonNullishMembers.length <= 1;
    }

    function isInsideTypeAlias(node) {
      let current = node.parent;
      while (current) {
        if (current.type === "TSTypeAliasDeclaration" || current.type === "TSInterfaceDeclaration") {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    function isDirectChildOfTypeAnnotation(node) {
      const parent = node.parent;
      if (!parent) return false;

      return (
        parent.type === "TSTypeAnnotation" || parent.type === "TSAsExpression" || parent.type === "TSTypeAssertion"
      );
    }

    function getTypeReferenceDeclarationPath(typeRefNode) {
      if (!checker || !esTreeNodeToTSNodeMap) return null;

      try {
        const tsNode = esTreeNodeToTSNodeMap.get(typeRefNode);
        if (!tsNode) return null;

        const type = checker.getTypeAtLocation(tsNode);
        if (!type) return null;

        const symbol = type.getSymbol() || type.aliasSymbol;
        if (!symbol) return null;

        const declarations = symbol.getDeclarations();
        if (!declarations || declarations.length === 0) return null;

        const sourceFile = declarations[0].getSourceFile();
        if (sourceFile) {
          return sourceFile.fileName;
        }
      } catch {
        // Ignore errors
      }
      return null;
    }

    function collectTypeReferences(node, refs = []) {
      if (!node) return refs;

      if (node.type === "TSTypeReference") {
        refs.push(node);
      }

      for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const child = node[key];
        if (child && typeof child === "object") {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === "object" && item.type) {
                collectTypeReferences(item, refs);
              }
            }
          } else if (child.type) {
            collectTypeReferences(child, refs);
          }
        }
      }

      return refs;
    }

    function containsExternalTypeReference(node) {
      if (!checker) return false;

      const typeRefs = collectTypeReferences(node);

      for (const ref of typeRefs) {
        const declPath = getTypeReferenceDeclarationPath(ref);
        if (declPath && isFromNodeModules(declPath)) {
          return true;
        }
      }

      return false;
    }

    function checkInlineComplexType(node) {
      if (!node) return;

      if (isInsideTypeAlias(node)) return;
      if (containsExternalTypeReference(node)) return;

      const checkNested = isDirectChildOfTypeAnnotation(node);

      switch (node.type) {
        case "TSUnionType":
          if (!allowInlineUnions) {
            const isNullishUnion = checkNullishUnion(node);
            if (!isNullishUnion && node.types.length > maxUnionMembers) {
              context.report({ node, messageId: "noInlineUnion" });
            }
          }
          break;

        case "TSIntersectionType":
          if (!allowInlineIntersections) {
            context.report({ node, messageId: "noInlineIntersection" });
          }
          break;

        case "TSTypeLiteral":
          if (!allowInlineObjectTypes && checkNested) {
            if (node.members && node.members.length > 0) {
              context.report({ node, messageId: "noInlineObject" });
            }
          }
          break;

        case "TSTupleType":
          if (!allowInlineTuples && checkNested) {
            context.report({ node, messageId: "noInlineTuple" });
          }
          break;

        case "TSFunctionType":
        case "TSConstructorType":
          if (!allowInlineFunctionTypes && checkNested) {
            context.report({ node, messageId: "noInlineFunction" });
          }
          break;

        case "TSConditionalType":
          if (!allowInlineConditionalTypes) {
            context.report({ node, messageId: "noInlineConditional" });
          }
          break;

        case "TSMappedType":
          if (!allowInlineMappedTypes) {
            context.report({ node, messageId: "noInlineMapped" });
          }
          break;
      }
    }

    // ==================== RETURN VALUE LOGIC ====================

    function isAllowedReturnValue(node) {
      if (!node) {
        return allowReturnUndefined;
      }

      if (node.type === "Identifier") {
        if (node.name === "undefined") {
          return true;
        }
        return true;
      }

      if (node.type === "MemberExpression" && allowReturnMemberExpressions) {
        return true;
      }

      // Always allow returning null, booleans, and numbers (primitives except string)
      if (node.type === "Literal" && node.value === null) {
        return true;
      }

      if (node.type === "Literal" && typeof node.value === "boolean") {
        return true;
      }

      if (node.type === "Literal" && typeof node.value === "number") {
        return true;
      }

      if (node.type === "Literal" && node.value === "" && allowReturnEmptyString) {
        return true;
      }

      return false;
    }

    function checkReturnStatement(node) {
      if (checkReturns && !isAllowedReturnValue(node.argument)) {
        context.report({
          node,
          messageId: "noInlineReturn",
        });
      }

      // Track return types for consistency check (independent of checkReturns)
      if (checkReturnTypeConsistency) {
        recordReturnType(node);
      }
    }

    // ==================== TYPESCRIPT ERRORS LOGIC ====================

    /**
     * Walk the TypeScript diagnostic message chain and return true if any
     * node mentions `null` or `undefined` (indicating a nullability error).
     */
    function diagnosticChainHasNullUndefined(msgText) {
      if (typeof msgText === "string") {
        return /\b(null|undefined)\b/.test(msgText);
      }
      if (!msgText) return false;
      if (/\b(null|undefined)\b/.test(msgText.messageText)) return true;
      if (msgText.next) {
        for (const n of msgText.next) {
          if (diagnosticChainHasNullUndefined(n)) return true;
        }
      }
      return false;
    }

    function isNullUndefinedDiagnostic(diagnostic) {
      // Codes that are exclusively about null/undefined access
      const nullSpecificCodes = new Set([2532, 2533, 18047, 18048]);
      if (nullSpecificCodes.has(diagnostic.code)) return true;
      return diagnosticChainHasNullUndefined(diagnostic.messageText);
    }

    function checkTypescriptDiagnostics() {
      if (!checkTypescriptErrors || !program) return;

      const filename = context.filename ?? context.getFilename?.();
      const sourceFile = program.getSourceFile(filename);
      if (!sourceFile) return;

      // Get semantic diagnostics (type errors)
      const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile);
      // Get syntactic diagnostics (syntax errors)
      const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile);

      const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics];

      for (const diagnostic of allDiagnostics) {
        if (diagnostic.file !== sourceFile) continue;

        const start = diagnostic.start ?? 0;
        const length = diagnostic.length ?? 1;

        // Convert TS position to ESLint location
        const startLoc = sourceFile.getLineAndCharacterOfPosition(start);
        const endLoc = sourceFile.getLineAndCharacterOfPosition(start + length);

        if (isNullUndefinedDiagnostic(diagnostic)) {
          context.report({
            loc: {
              start: { line: startLoc.line + 1, column: startLoc.character },
              end: { line: endLoc.line + 1, column: endLoc.character },
            },
            messageId: "typescriptNullableError",
            data: { code: diagnostic.code },
          });
        } else {
          const message =
            typeof diagnostic.messageText === "string" ? diagnostic.messageText : diagnostic.messageText.messageText;
          context.report({
            loc: {
              start: { line: startLoc.line + 1, column: startLoc.character },
              end: { line: endLoc.line + 1, column: endLoc.character },
            },
            messageId: "typescriptError",
            data: { code: diagnostic.code, message },
          });
        }
      }
    }

    // ==================== RETURN TYPE CONSISTENCY LOGIC ====================

    // Stack to track return types per function scope.
    // Each entry is a Set<string> of normalized type strings.
    const returnTypeStack = [];

    function normalizeReturnTypeString(typeString) {
      if (!typeString) return null;
      // Ignore any/unknown/never — they unify with anything
      if (typeString === "any" || typeString === "unknown" || typeString === "never") return null;
      return typeString;
    }

    function getExpressionTypeString(node) {
      if (!checker || !esTreeNodeToTSNodeMap) return null;

      try {
        const tsNode = esTreeNodeToTSNodeMap.get(node);
        if (!tsNode) return null;

        const type = checker.getTypeAtLocation(tsNode);
        if (!type) return null;

        const typeString = checker.typeToString(type);
        return normalizeReturnTypeString(simplifyLiteralType(type, typeString));
      } catch {
        return null;
      }
    }

    function enterReturnTypeScope() {
      returnTypeStack.push(new Set());
    }

    function exitReturnTypeScope(functionNode) {
      if (returnTypeStack.length === 0) return;
      const returnTypes = returnTypeStack.pop();

      // Nothing to check if 0 or 1 distinct types
      if (returnTypes.size <= 1) return;

      context.report({
        node: functionNode.id || functionNode,
        messageId: "inconsistentReturnTypes",
        data: {
          types: Array.from(returnTypes).join(", "),
        },
      });
    }

    function recordReturnType(returnNode) {
      if (returnTypeStack.length === 0) return;

      const scope = returnTypeStack[returnTypeStack.length - 1];

      if (!returnNode.argument) {
        scope.add("void");
      } else {
        const typeString = getExpressionTypeString(returnNode.argument);
        if (typeString) {
          scope.add(typeString);
        }
      }
    }

    // ==================== DUPLICATE VARIABLE LOGIC ====================

    // Stack of Maps to track variable names per function scope
    const functionScopeStack = [];

    function enterFunctionScope() {
      functionScopeStack.push(new Map());
    }

    function exitFunctionScope() {
      functionScopeStack.pop();
    }

    function checkDuplicateVariableDeclaration(node) {
      if (!checkDuplicateVariables) return;
      if (functionScopeStack.length === 0) return;

      // Get variable name from the declarator's id
      const id = node.id;
      if (!id || id.type !== "Identifier") return;

      const name = id.name;
      const currentScope = functionScopeStack[functionScopeStack.length - 1];

      if (currentScope.has(name)) {
        // Already declared in this function - report error
        context.report({
          node: id,
          messageId: "duplicateVariable",
          data: { name },
        });
      } else {
        // First declaration - track it
        currentScope.set(name, node);
      }
    }

    // ==================== EXPLICIT NULLABILITY LOGIC ====================

    // TypeScript utility types that propagate/transform nullability explicitly.
    // If a type is built from one of these, the user has already made a
    // conscious nullability decision, so we don't require | null | undefined.
    const NULLABILITY_AWARE_UTILITIES = new Set(["NonNullable", "NoInfer"]);

    /**
     * Check if a name refers to any type parameter in an enclosing generic declaration.
     * Generic type parameters (e.g. T in function foo<T>) are exempt from nullability
     * checks because they are placeholders, not concrete types.
     */
    function isTypeParameter(name, node) {
      let current = node.parent;
      while (current) {
        const typeParams = current.typeParameters && current.typeParameters.params;
        if (typeParams) {
          for (const param of typeParams) {
            if (
              param.type === "TSTypeParameter" &&
              param.name &&
              ((typeof param.name === "string" && param.name === name) ||
                (param.name.type === "Identifier" && param.name.name === name))
            ) {
              return true;
            }
          }
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Check if a type parameter name (e.g. "T") has a nullability-aware constraint
     * (e.g. `T extends NonNullable<unknown>`) in an enclosing generic declaration.
     */
    function isConstrainedTypeParameter(name, node) {
      let current = node.parent;
      while (current) {
        // Look for type parameters on type aliases, interfaces, functions, classes
        const typeParams = current.typeParameters && current.typeParameters.params;
        if (typeParams) {
          for (const param of typeParams) {
            if (
              param.type === "TSTypeParameter" &&
              param.name &&
              ((typeof param.name === "string" && param.name === name) ||
                (param.name.type === "Identifier" && param.name.name === name))
            ) {
              // Found the type parameter — check its constraint
              if (param.constraint) {
                return typeNodeHasExplicitNullability(param.constraint);
              }
              // No constraint — not explicitly nullable
              return false;
            }
          }
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Check whether a TSTypeAnnotation node has explicit nullability.
     * Returns true (= OK, no error) if:
     *   - The type includes `| null | undefined` (both present in a union)
     *   - The type is wrapped in NonNullable<>
     *   - The type is a utility type that inherits nullability (Partial, ReturnType, etc.)
     *   - The type uses `typeof`
     *   - The type is inside a type alias declaration (checked at the alias level instead)
     */
    function typeNodeHasExplicitNullability(typeNode) {
      if (!typeNode) return true;

      switch (typeNode.type) {
        case "TSUnionType": {
          // Check if union contains both null and undefined
          let hasNull = false;
          let hasUndefined = false;
          for (const member of typeNode.types) {
            if (member.type === "TSNullKeyword") hasNull = true;
            if (
              member.type === "TSUndefinedKeyword" ||
              (member.type === "TSTypeReference" &&
                member.typeName &&
                member.typeName.type === "Identifier" &&
                member.typeName.name === "undefined")
            ) {
              hasUndefined = true;
            }
          }
          return hasNull && hasUndefined;
        }

        case "TSTypeReference": {
          const typeName = typeNode.typeName;
          if (typeName && typeName.type === "Identifier") {
            // NonNullable<T>, Partial<T>, ReturnType<F>, etc.
            if (NULLABILITY_AWARE_UTILITIES.has(typeName.name)) {
              return true;
            }
            // Generic type parameters (e.g. T in function foo<T>) are exempt
            if (isTypeParameter(typeName.name, typeNode)) {
              return true;
            }
            // Check if this is a generic type parameter with a nullability-aware constraint
            if (isConstrainedTypeParameter(typeName.name, typeNode)) {
              return true;
            }
          }
          // Qualified names like SomeModule.SomeType — not a utility, needs check
          return false;
        }

        case "TSTypeQuery":
          // typeof X — inherits nullability from the referenced value
          return true;

        case "TSIndexedAccessType":
          // T[K] — derived type, inherits from source
          return true;

        case "TSMappedType":
          // { [K in ...]: ... } — structural type transformation
          return true;

        case "TSConditionalType":
          // T extends U ? X : Y — conditional logic, user is making explicit decisions
          return true;

        case "TSIntersectionType":
          // A & B — check if any member has explicit nullability
          return typeNode.types.some((t) => typeNodeHasExplicitNullability(t));

        // Primitives and simple keywords — need explicit nullability
        case "TSStringKeyword":
        case "TSNumberKeyword":
        case "TSBooleanKeyword":
        case "TSBigIntKeyword":
        case "TSSymbolKeyword":
        case "TSObjectKeyword":
        case "TSTypeLiteral":
        case "TSTupleType":
        case "TSArrayType":
        case "TSFunctionType":
        case "TSConstructorType":
        case "TSTemplateLiteralType":
        case "TSLiteralType":
          return false;

        // void, undefined, null, never, unknown, any — these are inherently about nullability or special
        case "TSVoidKeyword":
        case "TSUndefinedKeyword":
        case "TSNullKeyword":
        case "TSNeverKeyword":
        case "TSUnknownKeyword":
        case "TSAnyKeyword":
          return true;

        // Parenthesized — check inner
        case "TSParenthesizedType":
          return typeNodeHasExplicitNullability(typeNode.typeAnnotation);

        default:
          return true;
      }
    }

    /**
     * Get the source text of a type annotation node for the error message.
     */
    function getTypeText(typeNode) {
      try {
        return sourceCode.getText(typeNode);
      } catch {
        return "...";
      }
    }

    /**
     * Check a TSTypeAnnotation node for explicit nullability.
     * This is the main entry point called from visitors.
     */
    function checkExplicitNullabilityOnAnnotation(node) {
      if (!checkExplicitNullability) return;

      // node is a TSTypeAnnotation — the actual type is in node.typeAnnotation
      const typeNode = node.typeAnnotation;
      if (!typeNode) return;

      if (!typeNodeHasExplicitNullability(typeNode)) {
        const typeText = getTypeText(typeNode);
        context.report({
          node: typeNode,
          messageId: "missingExplicitNullability",
          data: { type: typeText },
          suggest: [
            {
              messageId: "suggestAddNullUndefined",
              fix(fixer) {
                return fixer.replaceText(typeNode, `${typeText} | null | undefined`);
              },
            },
            {
              messageId: "suggestWrapNonNullable",
              fix(fixer) {
                return fixer.replaceText(typeNode, `NonNullable<${typeText}>`);
              },
            },
          ],
        });
      }
    }

    // ==================== RETURN HANDLERS ====================

    return {
      // TypeScript errors check (runs once per file)
      Program: checkTypescriptDiagnostics,

      // Function scope tracking for duplicate variable and return type consistency checks
      FunctionDeclaration(node) {
        enterFunctionScope();
        if (checkReturnTypeConsistency) {
          enterReturnTypeScope();
        }
        checkFunctionReturnType(node, false);
      },
      "FunctionDeclaration:exit"(node) {
        if (checkReturnTypeConsistency) {
          exitReturnTypeScope(node);
        }
        exitFunctionScope();
      },
      FunctionExpression(node) {
        enterFunctionScope();
        if (checkReturnTypeConsistency) {
          enterReturnTypeScope();
        }
        // Skip constructors - they don't have explicit return types
        const isConstructor =
          node.parent && node.parent.type === "MethodDefinition" && node.parent.kind === "constructor";
        if (!isConstructor) {
          checkFunctionReturnType(node, false);
        }
      },
      "FunctionExpression:exit"(node) {
        if (checkReturnTypeConsistency) {
          exitReturnTypeScope(node);
        }
        exitFunctionScope();
      },
      ArrowFunctionExpression(node) {
        enterFunctionScope();
        if (checkReturnTypeConsistency) {
          enterReturnTypeScope();
        }
        checkFunctionReturnType(node, true);
      },
      "ArrowFunctionExpression:exit"(node) {
        if (checkReturnTypeConsistency) {
          exitReturnTypeScope(node);
        }
        exitFunctionScope();
      },

      // Type annotation checks
      VariableDeclarator(node) {
        checkVariableDeclarator(node);
        checkDuplicateVariableDeclaration(node);
      },
      "FunctionDeclaration > Identifier.params": checkFunctionParameter,
      "FunctionExpression > Identifier.params": checkFunctionParameter,
      "ArrowFunctionExpression > Identifier.params": checkFunctionParameter,
      PropertyDefinition: checkPropertyDefinition,

      // Inline complex types checks
      TSUnionType: checkInlineComplexType,
      TSIntersectionType: checkInlineComplexType,
      TSTypeLiteral: checkInlineComplexType,
      TSTupleType: checkInlineComplexType,
      TSFunctionType: checkInlineComplexType,
      TSConstructorType: checkInlineComplexType,
      TSConditionalType: checkInlineComplexType,
      TSMappedType: checkInlineComplexType,

      // Return value checks
      ReturnStatement: checkReturnStatement,

      // Explicit nullability checks
      // Check type annotations on variables, params, properties, return types
      TSTypeAnnotation: checkExplicitNullabilityOnAnnotation,
      // Check `as X` type assertions — TSAsExpression has the type directly in node.typeAnnotation (not wrapped in TSTypeAnnotation)
      TSAsExpression(node) {
        if (!checkExplicitNullability) return;
        const typeNode = node.typeAnnotation;
        if (!typeNode) return;
        if (!typeNodeHasExplicitNullability(typeNode)) {
          const typeText = getTypeText(typeNode);
          context.report({
            node: typeNode,
            messageId: "missingExplicitNullability",
            data: { type: typeText },
            suggest: [
              {
                messageId: "suggestAddNullUndefined",
                fix(fixer) {
                  return fixer.replaceText(typeNode, `${typeText} | null | undefined`);
                },
              },
              {
                messageId: "suggestWrapNonNullable",
                fix(fixer) {
                  return fixer.replaceText(typeNode, `NonNullable<${typeText}>`);
                },
              },
            ],
          });
        }
      },
    };
  },
};
