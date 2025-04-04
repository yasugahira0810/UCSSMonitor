import { jest } from '@jest/globals';
import {
  filterHourlyData,
  getTimezoneInfo,
  calculateYAxisRange
} from './generate_graph.js';

// Simple tests that don't require mocking external modules
describe('generate_graph.js', () => {
  
  describe('filterHourlyData', () => {
    it('should filter data to one entry per hour', () => {
      const inputData = [
        { date: '2023-01-01T00:00:00Z', remainingData: '100' },
        { date: '2023-01-01T00:30:00Z', remainingData: '90' },
        { date: '2023-01-01T01:00:00Z', remainingData: '80' },
      ];

      const filteredData = filterHourlyData(inputData);

      expect(filteredData).toEqual([
        { date: '2023-01-01T00:00:00Z', remainingData: '100' },
        { date: '2023-01-01T01:00:00Z', remainingData: '80' },
      ]);
    });
  });

  describe('getTimezoneInfo', () => {
    it('should return UTC by default', () => {
      delete process.env.UTC_OFFSET;

      const { timezone, timezoneDisplay } = getTimezoneInfo();

      expect(timezone).toBe('UTC');
      expect(timezoneDisplay).toBe('UTC+0');
    });

    it('should return the correct timezone for a numeric offset', () => {
      process.env.UTC_OFFSET = '+9';

      const { timezone, timezoneDisplay } = getTimezoneInfo();

      expect(timezone).toBe('Etc/GMT-9');
      expect(timezoneDisplay).toBe('UTC+9');
    });

    it('should return the correct timezone for a named timezone', () => {
      process.env.UTC_OFFSET = 'Asia/Tokyo';

      const { timezone, timezoneDisplay } = getTimezoneInfo();

      expect(timezone).toBe('Asia/Tokyo');
      expect(timezoneDisplay).toBe('JST (UTC+9)');
    });
  });

  describe('calculateYAxisRange', () => {
    it('should calculate the correct Y-axis range', () => {
      const maxValue = 120;

      const yAxisSettings = calculateYAxisRange(maxValue);

      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 150,
      });
    });

    it('should not exceed the maximum limit', () => {
      const maxValue = 600;

      const yAxisSettings = calculateYAxisRange(maxValue);

      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 500,
      });
    });
  });
});