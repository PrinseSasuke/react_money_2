module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setupAfterEnv.js"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  testMatch: ["**/tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  testTimeout: 15000,
};
