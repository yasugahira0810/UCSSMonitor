import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';
import { Octokit } from '@octokit/rest';
import { updateGist, fetchGistData, saveGistData, generateFiles } from './update_gist';

jest.mock('fs');
jest.mock('@octokit/rest');

describe('update_gist.js', () => {
    const mockOctokit = {
        gists: {
            get: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(() => {
        Octokit.mockImplementation(() => mockOctokit);
        process.env.REMAINING_DATA = '100';
        process.env.GIST_USER = 'test_user';
        process.env.GIST_ID = 'test_gist_id';
        process.env.GH_PAT = 'test_token';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('updateGist', () => {
        it('should update the Gist with new data', async () => {
            const existingData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 50 }];
            mockOctokit.gists.get.mockResolvedValueOnce({
                data: { files: { 'data.json': { content: JSON.stringify(existingData) } } },
            });
            mockOctokit.gists.update.mockResolvedValueOnce({});

            await updateGist();

            expect(mockOctokit.gists.get).toHaveBeenCalledWith({ gist_id: 'test_gist_id' });
            expect(mockOctokit.gists.update).toHaveBeenCalledWith({
                gist_id: 'test_gist_id',
                files: {
                    'data.json': {
                        content: JSON.stringify(
                            [
                                ...existingData,
                                { date: expect.any(String), remainingData: 100 },
                            ],
                            null,
                            2
                        ),
                    },
                },
            });
        });

        it('should handle errors gracefully', async () => {
            mockOctokit.gists.get.mockRejectedValueOnce(new Error('Gist not found'));

            await expect(updateGist()).resolves.not.toThrow();

            expect(mockOctokit.gists.get).toHaveBeenCalledWith({ gist_id: 'test_gist_id' });
        });
    });

    describe('fetchGistData', () => {
        it('should fetch and parse existing Gist data', async () => {
            const existingData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 50 }];
            mockOctokit.gists.get.mockResolvedValueOnce({
                data: { files: { 'data.json': { content: JSON.stringify(existingData) } } },
            });

            const result = await fetchGistData(mockOctokit);

            expect(result).toEqual(existingData);
            expect(mockOctokit.gists.get).toHaveBeenCalledWith({ gist_id: 'test_gist_id' });
        });

        it('should throw an error if no files are found in the Gist', async () => {
            mockOctokit.gists.get.mockResolvedValueOnce({ data: { files: {} } });

            await expect(fetchGistData(mockOctokit)).rejects.toThrow(
                'No files found in the Gist. Please check the Gist ID or its content.'
            );
        });
    });

    describe('saveGistData', () => {
        it('should save updated data to the Gist', async () => {
            const updatedData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 100 }];
            mockOctokit.gists.update.mockResolvedValueOnce({});

            await saveGistData(mockOctokit, updatedData);

            expect(mockOctokit.gists.update).toHaveBeenCalledWith({
                gist_id: 'test_gist_id',
                files: {
                    'data.json': {
                        content: JSON.stringify(updatedData, null, 2),
                    },
                },
            });
        });
    });

    describe('generateFiles', () => {
        it('should generate HTML files in the docs directory', () => {
            fs.existsSync.mockReturnValueOnce(false);
            fs.mkdirSync.mockImplementationOnce(() => {});
            fs.writeFileSync.mockImplementationOnce(() => {});

            generateFiles();

            expect(fs.existsSync).toHaveBeenCalledWith(path.join('docs'));
            expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('docs'));
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        });

        it('should not create the directory if it already exists', () => {
            fs.existsSync.mockReturnValueOnce(true);

            generateFiles();

            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        });
    });
});