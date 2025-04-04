// Ensure fs mock aligns with test requirements
const fs = {
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(() => false), // Default to false for tests
  mkdirSync: jest.fn()
};
export default fs;