const js = require("@eslint/js");
const nextConfig = require("eslint-config-next");
const jestPlugin = require("eslint-plugin-jest");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
  js.configs.recommended,
  ...nextConfig,
  jestPlugin.configs["flat/style"],
  prettierConfig,
];
