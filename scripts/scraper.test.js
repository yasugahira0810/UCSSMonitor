import { jest } from '@jest/globals';
import puppeteer from 'puppeteer';
import fs from 'fs';
import { logErrorDetails, login, isLoggedIn, waitForPostLoginText, logRemainingData } from '../scripts/scraper';

jest.mock('puppeteer');
jest.mock('fs');
jest.dontMock('cosmiconfig');

describe('scraper.js', () => {
  let pageMock;

  beforeEach(() => {
    pageMock = {
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      type: jest.fn(),
      click: jest.fn(),
      waitForNavigation: jest.fn(),
      $: jest.fn(),
      evaluate: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
    };
    puppeteer.launch = jest.fn().mockResolvedValue({ newPage: jest.fn().mockResolvedValue(pageMock), close: jest.fn() });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logErrorDetails writes error details to a file', async () => {
    const errorMessage = 'Test error';
    await logErrorDetails(pageMock, errorMessage);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'error_details.json',
      expect.stringContaining(errorMessage)
    );
  });

  test('login throws an error if email or password is missing', async () => {
    await expect(login(pageMock, null, 'password')).rejects.toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    await expect(login(pageMock, 'email', null)).rejects.toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
  });

  test('isLoggedIn returns true if serviceDetailsButton is found', async () => {
    pageMock.waitForSelector.mockResolvedValueOnce(true);
    const result = await isLoggedIn(pageMock);
    expect(result).toBe(true);
  });

  test('isLoggedIn returns false if serviceDetailsButton is not found', async () => {
    pageMock.waitForSelector.mockRejectedValueOnce(new Error('Not found'));
    const result = await isLoggedIn(pageMock);
    expect(result).toBe(false);
  });

  test('logRemainingData logs remaining data and sets GitHub Actions output', async () => {
    pageMock.click.mockResolvedValueOnce();
    pageMock.waitForSelector.mockResolvedValueOnce();
    pageMock.$eval.mockResolvedValueOnce('123.45');

    console.log = jest.fn();

    await logRemainingData(pageMock);

    expect(console.log).toHaveBeenCalledWith('123.45');
    expect(console.log).toHaveBeenCalledWith('::set-output name=remainingData::123.45');
  });
});