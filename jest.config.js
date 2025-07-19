export default {
  transform: {},
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(debug|@puppeteer|puppeteer|puppeteer-core|@puppeteer/browsers)/)',
  ],
  moduleFileExtensions: ['js', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node'],
  testTimeout: 60000,
  setupFilesAfterEnv: [],
  forceExit: true,
  detectOpenHandles: true,
  // Add these settings for better ES module compatibility
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  runner: 'jest-runner',
  verbose: true,
  collectCoverage: true,
  coverageReporters: ['html', 'text', 'lcov'],
  coverageDirectory: 'coverage',
}