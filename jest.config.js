const nextJest = require("next/jest");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.development" });

const createJestConfig = nextJest();

const jestConfig = {
  moduleDirectories: ["node_modules", "<rootDir>"],
  testTimeout: 60000,
  transformIgnorePatterns: ["/node_modules/(?!node-pg-migrate)/"],
};

module.exports = async () => {
  const config = await createJestConfig(jestConfig)();
  config.transformIgnorePatterns = ["/node_modules/(?!node-pg-migrate)/"];
  return config;
};
