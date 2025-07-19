// Jest用fsモック（複数ファイル対応）
const fileContents = {};

const fs = {
  readFileSync: jest.fn((filePath, encoding) => {
    return fileContents[filePath] || '';
  }),
  writeFileSync: jest.fn((filePath, content, encoding) => {
    fileContents[filePath] = content;
  }),
  __setMockContent: (map) => {
    // map: { [filePath]: content }
    for (const key in map) fileContents[key] = map[key];
  },
  __getMockContent: (filePath) => {
    if (filePath) return fileContents[filePath] || '';
    return { ...fileContents };
  },
  __resetMockContent: () => {
    for (const key in fileContents) delete fileContents[key];
  }
};

module.exports = fs;