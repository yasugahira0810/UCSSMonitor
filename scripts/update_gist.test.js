import { jest } from '@jest/globals';
import dotenv from 'dotenv';
dotenv.config();

// Create mock functions
const mockExistSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockJoin = jest.fn((...parts) => parts.join('/'));

// Mock modules before importing the module under test
jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync
  },
  existsSync: mockExistSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync
}));

jest.unstable_mockModule('path', () => ({
  default: {
    join: mockJoin
  },
  join: mockJoin
}));

// Mock Octokit
const mockGistGet = jest.fn();
const mockGistUpdate = jest.fn();
const mockOctokit = {
  gists: {
    get: mockGistGet,
    update: mockGistUpdate
  }
};

jest.unstable_mockModule('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

// Import the module under test
const updateGistModule = await import('./update_gist.js');
const { updateGist, fetchGistData, saveGistData, generateFiles } = updateGistModule;

describe('update_gist.js', () => {
    const mockEnv = {
        REMAINING_DATA: '50.5'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...process.env, ...mockEnv };
    });

    describe('updateGist', () => {
        it('should update the Gist with new data', async () => {
            const mockExistingData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 100 }];

            // Mock the API calls for updateGist test
            mockGistGet.mockResolvedValueOnce({
                data: {
                    files: {
                        'data.json': { content: JSON.stringify(mockExistingData) },
                    },
                },
            });
            mockGistUpdate.mockResolvedValueOnce({});

            await updateGist();

            expect(mockGistGet).toHaveBeenCalledWith({ gist_id: process.env.GIST_ID });
            
            // Just verify that the Gist was updated with the correct gist_id and file name
            // Without checking the specific content which varies with timestamps
            expect(mockGistUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    gist_id: process.env.GIST_ID,
                    files: expect.objectContaining({
                        'data.json': expect.any(Object)
                    })
                })
            );
        });

        it('should handle errors gracefully', async () => {
            mockGistGet.mockRejectedValueOnce(new Error('Failed to fetch Gist'));

            await expect(updateGist()).resolves.not.toThrow();
        });
    });

    describe('fetchGistData', () => {
        it('should fetch and parse existing Gist data', async () => {
            const mockData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 100 }];

            mockGistGet.mockResolvedValueOnce({
                data: {
                    files: {
                        'data.json': { content: JSON.stringify(mockData) },
                    },
                },
            });

            const result = await fetchGistData(mockOctokit);

            expect(result).toEqual(mockData);
            expect(mockGistGet).toHaveBeenCalledWith({ gist_id: process.env.GIST_ID });
        });

        it('should throw an error if no files are found in the Gist', async () => {
            // Mock the response with empty files object
            mockGistGet.mockResolvedValueOnce({ 
                data: { 
                    files: {} 
                } 
            });

            // Test that it throws the correct error
            await expect(fetchGistData(mockOctokit))
                .rejects
                .toThrow('No files found in the Gist');
        });

        it('should throw an error if Gist content is not valid JSON', async () => {
            mockGistGet.mockResolvedValueOnce({
                data: {
                    files: {
                        'data.json': { content: 'invalid-json' },
                    },
                },
            });

            await expect(fetchGistData(mockOctokit))
                .rejects
                .toThrow('Failed to parse Gist content as JSON');
        });
    });

    describe('saveGistData', () => {
        it('should save updated data to the Gist', async () => {
            const mockUpdatedData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 50 }];

            mockGistUpdate.mockResolvedValueOnce({});

            await saveGistData(mockOctokit, mockUpdatedData);

            expect(mockGistUpdate).toHaveBeenCalledWith({
                gist_id: process.env.GIST_ID,
                files: {
                    'data.json': {
                        content: JSON.stringify(mockUpdatedData, null, 2),
                    },
                },
            });
        });
    });

    describe('generateFiles', () => {
        it('should generate HTML files in the docs directory', () => {
            // Setup mock functions for fs module
            mockExistSync.mockReturnValueOnce(false);

            generateFiles();

            expect(mockExistSync).toHaveBeenCalledWith('docs');
            expect(mockMkdirSync).toHaveBeenCalledWith('docs');
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/chart.html',
                expect.stringContaining('<title>Chart</title>')
            );
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/index.html',
                expect.stringContaining('<title>Index</title>')
            );
        });

        it('should not create the directory if it already exists', () => {
            mockExistSync.mockReturnValueOnce(true);
            mockMkdirSync.mockClear();

            generateFiles();

            expect(mockMkdirSync).not.toHaveBeenCalled();
        });
    });
});