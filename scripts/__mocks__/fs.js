// Mock for fs module
const fs = {
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
};

export default fs;