module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce curly braces around control statements and always put opening brace on new line",
      category: "Stylistic Issues",
      recommended: true,
    },
    schema: [],
  },

  create(context) {
    function checkBody(node) {
      if (!node || node.type === "BlockStatement" || node.type === "EmptyStatement") {
        return;
      }

      context.report({
        node,
        message: "Statement must be enclosed in braces",
      });
    }

    return {
      IfStatement(node) {
        checkBody(node.consequent);
        if (node.alternate && node.alternate.type !== "IfStatement") {
          checkBody(node.alternate);
        }
      },
      ForStatement(node) {
        checkBody(node.body);
      },
      ForInStatement(node) {
        checkBody(node.body);
      },
      ForOfStatement(node) {
        checkBody(node.body);
      },
      WhileStatement(node) {
        checkBody(node.body);
      },
      DoWhileStatement(node) {
        checkBody(node.body);
      },
    };
  },
};
