import fs from 'fs';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { jest } from '@jest/globals';

jest.mock('fs');
// Replace jest.mock with jest.dontMock for node-fetch
jest.dontMock('node-fetch');

const mockGistData = {
  files: {
    'data.json': {
      content: JSON.stringify([{ date: '2023-01-01T00:00:00Z', remainingData: 100 }]),
    },
  },
};

describe('update_gist.js', () => {
  let octokitMock;

  beforeEach(() => {
    octokitMock = {
      gists: {
        get: jest.fn().mockResolvedValue({ data: mockGistData }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    jest.spyOn(Octokit.prototype, 'constructor').mockImplementation(() => octokitMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('updates Gist with new data', async () => {
    process.env.REMAINING_DATA = '50';
    process.env.GH_PAT = 'test-token';
    process.env.GIST_USER = 'test-user';
    process.env.GIST_ID = 'test-id';

    const updateGist = await import('../scripts/update_gist');

    await updateGist;

    expect(octokitMock.gists.get).toHaveBeenCalledWith({ gist_id: 'test-id' });
    expect(octokitMock.gists.update).toHaveBeenCalledWith({
      gist_id: 'test-id',
      files: {
        'data.json': {
          content: expect.stringContaining('"remainingData": 50'),
        },
      },
    });
  });

  test('throws error if Gist has no files', async () => {
    octokitMock.gists.get.mockResolvedValueOnce({ data: { files: {} } });

    const updateGist = await import('../scripts/update_gist');

    await expect(updateGist).rejects.toThrow('No files found in the Gist. Please check the Gist ID or its content.');
  });
});