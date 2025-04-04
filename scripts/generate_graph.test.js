import fs from 'fs';
import fetch from 'node-fetch';
import { jest } from '@jest/globals';
import { fetchAndProcessData, fetchDataFromGist, filterHourlyData, getTimezoneInfo, prepareChartData, calculateYAxisRange } from './generate_graph';

jest.mock('fs');
jest.mock('node-fetch', () => jest.fn());

describe('generate_graph.js', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchDataFromGist', () => {
        it('should fetch data from the provided Gist URL and return parsed JSON', async () => {
            const mockData = [{ date: '2023-01-01T00:00:00Z', remainingData: '100' }];
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockData),
            });

            const gistUrl = 'https://gist.github.com/user/gist-id';
            const result = await fetchDataFromGist(gistUrl);

            expect(fetch).toHaveBeenCalledWith(`${gistUrl}/raw/data.json`);
            expect(result).toEqual(mockData);
        });

        it('should throw an error if the response is not ok', async () => {
            fetch.mockResolvedValueOnce({ ok: false, status: 404 });

            const gistUrl = 'https://gist.github.com/user/gist-id';
            await expect(fetchDataFromGist(gistUrl)).rejects.toThrow('HTTP error! status: 404');
        });

        it('should throw an error if the data format is invalid', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce({}),
            });

            const gistUrl = 'https://gist.github.com/user/gist-id';
            await expect(fetchDataFromGist(gistUrl)).rejects.toThrow('Invalid data format: expected an array');
        });
    });

    describe('filterHourlyData', () => {
        it('should filter data to include only one entry per hour', () => {
            const mockData = [
                { date: '2023-01-01T00:00:00Z', remainingData: '100' },
                { date: '2023-01-01T00:30:00Z', remainingData: '90' },
                { date: '2023-01-01T01:00:00Z', remainingData: '80' },
            ];

            const result = filterHourlyData(mockData);
            expect(result).toEqual([
                { date: '2023-01-01T00:00:00Z', remainingData: '100' },
                { date: '2023-01-01T01:00:00Z', remainingData: '80' },
            ]);
        });
    });

    describe('getTimezoneInfo', () => {
        it('should return default UTC timezone if no environment variable is set', () => {
            delete process.env.UTC_OFFSET;

            const result = getTimezoneInfo();
            expect(result).toEqual({ timezone: 'UTC', timezoneDisplay: 'UTC+0' });
        });

        it('should return correct timezone for numeric UTC offset', () => {
            process.env.UTC_OFFSET = '+9';

            const result = getTimezoneInfo();
            expect(result).toEqual({ timezone: 'Etc/GMT-9', timezoneDisplay: 'UTC+9' });
        });

        it('should return correct timezone for named timezone', () => {
            process.env.UTC_OFFSET = 'Asia/Tokyo';

            const result = getTimezoneInfo();
            expect(result).toEqual({ timezone: 'Asia/Tokyo', timezoneDisplay: 'JST (UTC+9)' });
        });
    });

    describe('prepareChartData', () => {
        it('should prepare chart data and calculate axis settings', () => {
            const mockData = [
                { date: '2023-01-01T00:00:00Z', remainingData: '100' },
                { date: '2023-01-01T01:00:00Z', remainingData: '80' },
            ];
            const timezone = 'UTC';

            const result = prepareChartData(mockData, timezone);

            expect(result.chartData).toEqual([
                { x: new Date('2023-01-01T00:00:00Z').getTime(), y: 100 },
                { x: new Date('2023-01-01T01:00:00Z').getTime(), y: 80 },
            ]);
            expect(result.axisSettings).toEqual({ yAxisMin: 0, yAxisMax: 100 });
        });
    });

    describe('calculateYAxisRange', () => {
        it('should calculate Y-axis range based on max value', () => {
            expect(calculateYAxisRange(30)).toEqual({ yAxisMin: 0, yAxisMax: 50 });
            expect(calculateYAxisRange(75)).toEqual({ yAxisMin: 0, yAxisMax: 100 });
            expect(calculateYAxisRange(450)).toEqual({ yAxisMin: 0, yAxisMax: 500 });
        });

        it('should not exceed the maximum limit', () => {
            expect(calculateYAxisRange(600)).toEqual({ yAxisMin: 0, yAxisMax: 500 });
        });
    });

    describe('fetchAndProcessData', () => {
        it('should fetch data, process it, and generate HTML', async () => {
            const mockData = [
                { date: '2023-01-01T00:00:00Z', remainingData: '100' },
                { date: '2023-01-01T01:00:00Z', remainingData: '80' },
            ];
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValueOnce(mockData),
            });
            fs.mkdirSync.mockImplementation(() => {});
            fs.writeFileSync.mockImplementation(() => {});

            process.env.GIST_USER = 'user';
            process.env.GIST_ID = 'gist-id';

            await fetchAndProcessData();

            expect(fetch).toHaveBeenCalledWith('https://gist.github.com/user/gist-id/raw/data.json');
            expect(fs.mkdirSync).toHaveBeenCalledWith('./docs', { recursive: true });
            expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('index.html'), expect.any(String));
        });
    });
});