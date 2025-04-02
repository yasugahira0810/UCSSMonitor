export default {
  transform: {},
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(.{1,2}/.*)\.js$': '$1.js'
  },
  resolver: 'jest-node-exports-resolver'
};