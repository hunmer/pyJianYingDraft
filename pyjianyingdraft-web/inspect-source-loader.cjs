const { transform } = require("@react-dev-inspector/babel-plugin");

/**
 * webpack loader：用 @react-dev-inspector/babel-plugin 给每个 JSX 元素注入
 * data-inspector-relative-path / data-inspector-line / data-inspector-column，
 * 供 DevInspector 读取源码位置。
 */
module.exports = function inspectSourceLoader(source) {
  return transform({
    rootPath: this.rootContext,
    filePath: this.resourcePath,
    sourceCode: source,
  });
};
