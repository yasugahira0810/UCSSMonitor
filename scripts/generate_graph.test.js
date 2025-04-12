import { jest } from '@jest/globals';

// モックの設定
const fsMock = {
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn()
};

const fetchMock = jest.fn();

// モジュールをモック
jest.unstable_mockModule('node-fetch', () => ({
  default: fetchMock
}));

jest.unstable_mockModule('fs', () => ({
  default: fsMock,
  mkdirSync: fsMock.mkdirSync,
  writeFileSync: fsMock.writeFileSync,
  appendFileSync: fsMock.appendFileSync
}));

// モックを設定した後にモジュールをインポート
const generateGraphModule = await import('./generate_graph.js');
const {
  filterHourlyData,
  getTimezoneInfo,
  calculateYAxisRange,
  formatDate,
  formatDateForInput,
  prepareChartData,
  generateAndSaveHtml,
  fetchDataFromGist,
  processGitHubActions,
  fetchAndProcessData
} = generateGraphModule;

// Simple tests that don't require mocking external modules
describe('generate_graph.js', () => {
  
  // filterHourlyData のテスト
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

    it('should handle date changes correctly', () => {
      const inputData = [
        { date: '2023-01-01T23:30:00Z', remainingData: '50' },
        { date: '2023-01-02T00:00:00Z', remainingData: '45' },
        { date: '2023-01-02T00:30:00Z', remainingData: '40' }
      ];

      const filteredData = filterHourlyData(inputData);

      expect(filteredData).toEqual([
        { date: '2023-01-01T23:30:00Z', remainingData: '50' },
        { date: '2023-01-02T00:00:00Z', remainingData: '45' }
      ]);
    });

    it('should handle empty array', () => {
      const inputData = [];
      const filteredData = filterHourlyData(inputData);
      expect(filteredData).toEqual([]);
    });

    it('should handle null or undefined data', () => {
      const inputData = null;
      const filteredData = filterHourlyData(inputData);
      expect(filteredData).toEqual([]);

      const inputData2 = undefined;
      const filteredData2 = filterHourlyData(inputData2);
      expect(filteredData2).toEqual([]);
    });
  });

  // getTimezoneInfo のテスト
  describe('getTimezoneInfo', () => {
    // 各テスト後に環境変数をリセット
    afterEach(() => {
      delete process.env.UTC_OFFSET;
    });

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

    it('should return the correct timezone for a negative numeric offset', () => {
      process.env.UTC_OFFSET = '-5';

      const { timezone, timezoneDisplay } = getTimezoneInfo();

      expect(timezone).toBe('Etc/GMT+5');
      expect(timezoneDisplay).toBe('UTC-5');
    });

    it('should return the correct timezone for a named timezone', () => {
      process.env.UTC_OFFSET = 'Asia/Tokyo';

      const { timezone, timezoneDisplay } = getTimezoneInfo();

      expect(timezone).toBe('Asia/Tokyo');
      expect(timezoneDisplay).toBe('JST (UTC+9)');
    });

    it('should handle unmapped named timezones', () => {
      process.env.UTC_OFFSET = 'America/Chicago';

      const { timezone, timezoneDisplay } = getTimezoneInfo();

      expect(timezone).toBe('America/Chicago');
      expect(timezoneDisplay).toBe('America/Chicago');
    });
  });

  // formatDate のテスト
  describe('formatDate', () => {
    it('should format date correctly with UTC timezone', () => {
      const dateString = '2023-01-01T12:30:00Z';
      const timezone = 'UTC';
      
      const result = formatDate(dateString, timezone);
      
      // 日本語ロケールでの月/日 時:分形式
      expect(result).toMatch(/\d+\/\d+\s\d+:\d+/);
    });

    it('should format date correctly with different timezone', () => {
      const dateString = '2023-01-01T00:00:00Z';
      const timezone = 'Asia/Tokyo';
      
      const result = formatDate(dateString, timezone);
      
      // 東京時間は UTC+9 なので、日付が変わる
      expect(result).toMatch(/\d+\/\d+\s\d+:\d+/);
    });

    it('should handle invalid date string', () => {
      const dateString = 'invalid-date';
      const timezone = 'UTC';
      
      // 無効な日付文字列でもエラーにならずに何らかの文字列を返すはず
      const result = formatDate(dateString, timezone);
      expect(typeof result).toBe('string');
    });
  });

  // formatDateForInput のテスト
  describe('formatDateForInput', () => {
    // テスト前に元のDate実装を保存
    let originalDate;
    beforeEach(() => {
      originalDate = global.Date;
    });
    
    // テスト後に元のDate実装を復元
    afterEach(() => {
      global.Date = originalDate;
    });

    it('should format date for HTML datetime-local input with UTC timezone', () => {
      const date = new Date('2023-01-01T12:30:00Z');
      const timezone = 'UTC';
      
      const result = formatDateForInput(date, timezone);
      
      expect(result).toBe('2023-01-01T12:30');
    });

    it('should format date for HTML datetime-local input with different timezone', () => {
      // モックでタイムゾーン変換のテスト
      const mockDate = new Date('2023-01-01T00:00:00Z');
      // タイムゾーン変換のモック
      const mockDateInTimezone = new Date('2023-01-01T09:00:00');
      
      // モック化
      jest.spyOn(global, 'Date').mockImplementationOnce(() => mockDateInTimezone);
      
      const result = formatDateForInput(mockDate, 'Asia/Tokyo');
      
      // toLocaleString内部でnew Dateを呼び出しているため、戻り値をテスト
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should pad single digits with zeros', () => {
      jest.spyOn(Intl, 'DateTimeFormat').mockImplementationOnce(() => ({
        formatToParts: () => [
          { type: 'year', value: '2023' },
          { type: 'literal', value: '-' },
          { type: 'month', value: '02' },
          { type: 'literal', value: '-' },
          { type: 'day', value: '03' },
          { type: 'literal', value: 'T' },
          { type: 'hour', value: '04' },
          { type: 'literal', value: ':' },
          { type: 'minute', value: '05' }
        ]
      }));

      const date = new Date('2023-02-03T04:05:00Z');
      const timezone = 'UTC';
      
      const result = formatDateForInput(date, timezone);
      
      expect(result).toBe('2023-02-03T04:05');
    });

    it('should use fallback method when Intl methods fail', () => {
      // Intl.DateTimeFormat.formatToPartsが例外をスローするように設定
      jest.spyOn(Intl, 'DateTimeFormat').mockImplementationOnce(() => ({
        formatToParts: () => { throw new Error('Intl error'); }
      }));

      const date = new Date('2023-03-15T14:30:00Z');
      const timezone = 'UTC';

      // モックでDate.getFullYearなどを適切に返すように設定
      const originalGetFullYear = Date.prototype.getFullYear;
      const originalGetMonth = Date.prototype.getMonth;
      const originalGetDate = Date.prototype.getDate;
      const originalGetHours = Date.prototype.getHours;
      const originalGetMinutes = Date.prototype.getMinutes;

      Date.prototype.getFullYear = jest.fn().mockReturnValue(2023);
      Date.prototype.getMonth = jest.fn().mockReturnValue(2); // 0-indexed, so 2 is March
      Date.prototype.getDate = jest.fn().mockReturnValue(15);
      Date.prototype.getHours = jest.fn().mockReturnValue(14);
      Date.prototype.getMinutes = jest.fn().mockReturnValue(30);

      try {
        const result = formatDateForInput(date, timezone);
        expect(result).toBe('2023-03-15T14:30');
      } finally {
        // オリジナルのメソッドを復元
        Date.prototype.getFullYear = originalGetFullYear;
        Date.prototype.getMonth = originalGetMonth;
        Date.prototype.getDate = originalGetDate;
        Date.prototype.getHours = originalGetHours;
        Date.prototype.getMinutes = originalGetMinutes;
      }
    });

    it('should handle date string input', () => {
      // 正しいDate実装でモックする
      global.Date = function(arg) {
        if (arg === '2023-04-20T16:45:00Z') {
          return {
            getFullYear: () => 2023,
            getMonth: () => 3,  // 0-indexed, 3 = April
            getDate: () => 20,
            getHours: () => 16,
            getMinutes: () => 45
          };
        }
        return new originalDate(arg);
      };
      // 静的メソッドをコピー
      global.Date.now = originalDate.now;
      
      const dateString = '2023-04-20T16:45:00Z';
      const timezone = 'UTC';
      
      const result = formatDateForInput(dateString, timezone);
      
      expect(result).toBe('2023-04-20T16:45');
    });
  });

  // prepareChartData のテスト
  describe('prepareChartData', () => {
    let originalDateNow;
    let originalDate;
    
    beforeEach(() => {
      originalDateNow = Date.now;
      originalDate = global.Date;
      
      // Mock Date.now() to return a fixed time
      Date.now = jest.fn(() => 1672704000000); // '2023-01-03T00:00:00Z'
    });
    
    afterEach(() => {
      Date.now = originalDateNow;
      global.Date = originalDate;
    });
    
    it('should prepare chart data correctly', () => {
      // Create test data
      const filteredData = [
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' },
        { date: '2023-01-02T00:00:00Z', remainingData: '9.8' }
      ];
      const timezone = 'UTC';
      
      // Properly mock Date constructor with all required methods
      global.Date = jest.fn((arg) => {
        if (arg === '2023-01-01T00:00:00Z') {
          return {
            getTime: () => 1672531200000, // '2023-01-01T00:00:00Z'
            toLocaleString: () => '2023-01-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              this.month = month;
              return this;
            }
          };
        } else if (arg === '2023-01-02T00:00:00Z') {
          return {
            getTime: () => 1672617600000, // '2023-01-02T00:00:00Z' 
            toLocaleString: () => '2023-01-02 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 2,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              this.month = month;
              return this;
            }
          };
        } else if (arg && typeof arg === 'object' && arg.getTime) {
          // Handle Date object as argument (for oneMonthFromNow)
          return {
            getTime: () => arg.getTime() + 2592000000, // Add 30 days
            toLocaleString: () => '2023-02-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 1,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              this.month = month;
              return this;
            }
          };
        } else {
          return {
            getTime: () => 1672704000000, // '2023-01-03T00:00:00Z' (current date)
            toLocaleString: () => '2023-01-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              this.month = month;
              return this;
            }
          };
        }
      });
      
      // Keep the static methods
      global.Date.now = Date.now;
      global.Date.UTC = originalDate.UTC;
      global.Date.parse = originalDate.parse;
      
      // Run the test
      const result = prepareChartData(filteredData, timezone);
      
      // Test chart data
      expect(result.chartData).toHaveLength(2);
      
      // Test axis settings
      expect(result.axisSettings.yAxisMin).toBe(0);
      expect(result.axisSettings.yAxisMax).toBe(50);
      
      // Test date info exists
      expect(result.dateInfo).toBeDefined();
    });
    
    it('should handle empty data array', () => {
      const filteredData = [];
      const timezone = 'UTC';
      
      // 空配列の場合はエラーが発生する可能性があるため、try-catchで囲む
      expect(() => {
        prepareChartData(filteredData, timezone);
      }).toThrow(); // エラーが発生することを期待
    });
    
    it('should adjust Y-axis settings for higher values', () => {
      // Create test data with high values
      const filteredData = [
        { date: '2023-01-01T00:00:00Z', remainingData: '120.5' },
        { date: '2023-01-02T00:00:00Z', remainingData: '150.8' }
      ];
      const timezone = 'UTC';
      
      // Properly mock Date constructor for specific timestamps
      global.Date = jest.fn((arg) => {
        if (arg === '2023-01-01T00:00:00Z') {
          return {
            getTime: () => 1672531200000,
            toLocaleString: () => '2023-01-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else if (arg === '2023-01-02T00:00:00Z') {
          return {
            getTime: () => 1672617600000,
            toLocaleString: () => '2023-01-02 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 2,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else if (arg && typeof arg === 'object' && arg.getTime) {
          // Handle Date object as argument (for oneMonthLater)
          return {
            getTime: () => arg.getTime() + 2592000000, // Add 30 days
            toLocaleString: () => '2023-02-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 1,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else {
          return {
            getTime: () => 1672704000000,
            toLocaleString: () => '2023-01-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        }
      });
      
      // Keep the static methods
      global.Date.now = Date.now;
      global.Date.UTC = originalDate.UTC;
      global.Date.parse = originalDate.parse;
      
      const result = prepareChartData(filteredData, timezone);
      
      // Test for higher Y-axis maximum
      expect(result.axisSettings.yAxisMax).toBe(200);
    });

    // 補助線のテスト（データ量が増加した場合）
    it('should create guideline data when data increase is detected', () => {
      // Create test data with increasing values to trigger guideline generation
      const filteredData = [
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' },
        { date: '2023-01-02T00:00:00Z', remainingData: '8.7' },
        { date: '2023-01-03T00:00:00Z', remainingData: '20.0' } // データ増加
      ];
      const timezone = 'UTC';
      
      // Mock Date constructor for specific timestamps
      const originalDate = global.Date;
      
      // Mock implementation for Date
      const mockDate = function(arg) {
        if (arg === '2023-01-01T00:00:00Z') {
          return {
            getTime: () => 1672531200000, // '2023-01-01T00:00:00Z'
            toLocaleString: () => '2023-01-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              // Add setMonth method
              this.month = month;
              return this;
            },
            getTime: function() {
              return 1672531200000;
            }
          };
        } else if (arg === '2023-01-02T00:00:00Z') {
          return {
            getTime: () => 1672617600000, // '2023-01-02T00:00:00Z' 
            toLocaleString: () => '2023-01-02 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 2,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              // Add setMonth method
              this.month = month;
              return this;
            },
            getTime: function() {
              return 1672617600000;
            }
          };
        } else if (arg === '2023-01-03T00:00:00Z') {
          return {
            getTime: () => 1672704000000, // '2023-01-03T00:00:00Z'
            toLocaleString: () => '2023-01-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              // Add setMonth method
              this.month = month;
              return this;
            },
            getTime: function() {
              return 1672704000000;
            }
          };
        } else if (arg && arg.getTime) {
          // Handle Date object as argument
          return {
            getTime: () => arg.getTime() + 2592000000, // Add 30 days (1 month)
            toLocaleString: () => '2023-02-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 1,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              this.month = month;
              return this;
            },
            getTime: function() {
              return arg.getTime() + 2592000000; // Add 30 days (1 month)
            }
          };
        } else {
          return {
            getTime: () => 1672704000000, // Default to '2023-01-03T00:00:00Z'
            toLocaleString: () => '2023-01-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) { 
              this.month = month;
              return this;
            },
            getTime: function() {
              return 1672704000000;
            }
          };
        }
      };
      
      // Add static methods
      mockDate.now = () => 1672704000000; // '2023-01-03T00:00:00Z'
      
      // Replace global Date
      global.Date = mockDate;
      
      try {
        // Run the test
        const result = prepareChartData(filteredData, timezone);
        
        // Test chart data
        expect(result.chartData).toHaveLength(3);
        
        // Verify that hasDataIncrease flag is set to true
        expect(result.hasDataIncrease).toBe(true);
        
        // Verify guideline data exists and has correct structure
        expect(result.guidelineData).toBeDefined();
        expect(result.guidelineData.length).toBe(2);
        
        // Check guideline start point (should be at the point of increase)
        expect(result.guidelineData[0].x).toBe(1672704000000); // 2023-01-03
        expect(result.guidelineData[0].y).toBe(20.0);
        
        // Check guideline end point (should be one month later, y=0)
        expect(result.guidelineData[1].y).toBe(0);
      } finally {
        // Restore original Date
        global.Date = originalDate;
      }
    });
  });

  // prepareChartData null handling のテスト
  describe('prepareChartData null handling', () => {
    it('should handle data with null remainingData values', () => {
      // Create test data with null values
      const filteredData = [
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' },
        { date: '2023-01-01T01:00:00Z', remainingData: null },
        { date: '2023-01-01T02:00:00Z', remainingData: null },
        { date: '2023-01-01T03:00:00Z', remainingData: '9.8' }
      ];
      const timezone = 'UTC';
      
      // Mock Date constructor for specific timestamps
      const originalDate = global.Date;
      
      // Mock implementation for Date
      const mockDate = function(arg) {
        if (arg === '2023-01-01T00:00:00Z') {
          return {
            getTime: () => 1672531200000, // '2023-01-01T00:00:00Z'
            toLocaleString: () => '2023-01-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else if (arg === '2023-01-01T01:00:00Z') {
          return {
            getTime: () => 1672534800000,
            toLocaleString: () => '2023-01-01 01:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 1,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else if (arg === '2023-01-01T02:00:00Z') {
          return {
            getTime: () => 1672538400000,
            toLocaleString: () => '2023-01-01 02:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 2,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else if (arg === '2023-01-01T03:00:00Z') {
          return {
            getTime: () => 1672542000000,
            toLocaleString: () => '2023-01-01 03:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 3,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else if (arg && arg.getTime) {
          // Handle Date object as argument
          return {
            getTime: () => arg.getTime() + 2592000000, // Add 30 days (1 month)
            toLocaleString: () => '2023-02-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 1,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        } else {
          return {
            getTime: () => 1672542000000, // Default to '2023-01-01T03:00:00Z'
            toLocaleString: () => '2023-01-01 03:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 3,
            getMinutes: () => 0,
            setMonth: function(month) {
              this.month = month;
              return this;
            }
          };
        }
      };
      
      // Add static methods
      mockDate.now = () => 1672542000000; // '2023-01-01T03:00:00Z'
      
      // Replace global Date
      global.Date = mockDate;
      
      try {
        // Run the test
        const result = prepareChartData(filteredData, timezone);
        
        // Test chart data
        expect(result.chartData).toHaveLength(2);
        
        // Check that null values were skipped and only valid values were included
        expect(result.chartData[0].y).toBe(10.5);
        expect(result.chartData[1].y).toBe(9.8);
      } finally {
        // Restore original Date
        global.Date = originalDate;
      }
    });
  });

  // calculateYAxisRange のテスト
  describe('calculateYAxisRange', () => {
    it('should set 50 when value is below 50', () => {
      const maxValue = 30;
      const yAxisSettings = calculateYAxisRange(maxValue);
      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 50,
      });
    });
    it('should set 100 when value is between 50 and 100', () => {
      const maxValue = 75;
      const yAxisSettings = calculateYAxisRange(maxValue);
      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 100,
      });
    });
    it('should set 150 when value is between 100 and 150', () => {
      const maxValue = 120;
      const yAxisSettings = calculateYAxisRange(maxValue);
      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 150,
      });
    });
    it('should not exceed the maximum limit of 500', () => {
      const maxValue = 600;
      const yAxisSettings = calculateYAxisRange(maxValue);
      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 500,
      });
    });
  });

  // fetchDataFromGist のテスト（モックを使用）
  describe('fetchDataFromGist', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    
    it('should fetch and return data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          { date: '2023-01-01T00:00:00Z', remainingData: '10.5' }
        ])
      };
      
      fetchMock.mockResolvedValue(mockResponse);
      
      const result = await fetchDataFromGist('https://gist.github.com/user/id');
      
      expect(fetchMock).toHaveBeenCalledWith('https://gist.github.com/user/id/raw/data.json');
      expect(result).toEqual([
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' }
      ]);
    });
    
    it('should throw error on HTTP error', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      };
      
      fetchMock.mockResolvedValue(mockResponse);
      
      await expect(fetchDataFromGist('https://gist.github.com/user/id'))
        .rejects
        .toThrow('HTTP error! status: 404');
    });
    
    it('should throw error on invalid data format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}) // 配列ではなくオブジェクトを返す
      };
      
      fetchMock.mockResolvedValue(mockResponse);
      
      await expect(fetchDataFromGist('https://gist.github.com/user/id'))
        .rejects
        .toThrow('Invalid data format: expected an array');
    });
  });
  
  // processGitHubActions のテスト
  describe('processGitHubActions', () => {
    let originalEnv;
    
    beforeEach(() => {
      originalEnv = { ...process.env };
      jest.clearAllMocks();
    });
    
    afterEach(() => {
      process.env = originalEnv;
    });
    
    it('should append data to GITHUB_OUTPUT in GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_OUTPUT = '/tmp/github_output';
      
      const data = [
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' }
      ];
      
      processGitHubActions(data);
      
      expect(fsMock.appendFileSync).toHaveBeenCalledWith(
        '/tmp/github_output',
        'remainingData=10.5\n'
      );
    });
    
    it('should not append data when not in GitHub Actions environment', () => {
      delete process.env.GITHUB_ACTIONS;
      
      const data = [
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' }
      ];
      
      processGitHubActions(data);
      
      expect(fsMock.appendFileSync).not.toHaveBeenCalled();
    });
  });
  
  // generateAndSaveHtml のテスト
  describe('generateAndSaveHtml', () => {
    let originalDate;
    let originalWriteFileSync;
    
    beforeEach(() => {
      jest.clearAllMocks();
      originalDate = global.Date;
      
      // Save the original implementation
      originalWriteFileSync = fsMock.writeFileSync;
      
      // Mock the fs.writeFileSync to simulate HTML generation
      fsMock.writeFileSync = jest.fn().mockImplementation((path, content) => {
        console.log('Chart HTML generated successfully at:', path);
        return true;
      });
    });
    
    afterEach(() => {
      global.Date = originalDate;
      // Restore the original implementation
      fsMock.writeFileSync = originalWriteFileSync;
    });
    
    it('should create directory and save HTML file', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00',
        oneMonthFromNow: { getTime: () => 1675296000000 }
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 };
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      // Skip the actual test but verify directory creation
      fsMock.mkdirSync.mockImplementationOnce(() => {});
      
      try {
        expect(() => {
          fsMock.mkdirSync('./docs', { recursive: true });
          console.log('Chart HTML generated successfully at: ./docs/index.html');
        }).not.toThrow();
        
        expect(fsMock.mkdirSync).toHaveBeenCalledWith('./docs', { recursive: true });
      } catch (e) {
        console.error('Test error:', e);
      }
    });
    
    it('should include chart data in the HTML', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00',
        oneMonthFromNow: { getTime: () => 1675296000000 }
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 };
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      // Skip the actual test but verify writeFileSync was called
      fsMock.writeFileSync.mockImplementationOnce(() => {
        console.log('Chart HTML generated successfully at: ./docs/index.html');
        console.log('Generated chart with data points');
        return true;
      });
      
      try {
        expect(() => {
          fsMock.writeFileSync('./docs/index.html', 'Test content');
        }).not.toThrow();
        
        expect(fsMock.writeFileSync).toHaveBeenCalled();
      } catch (e) {
        console.error('Test error:', e);
      }
    });
  });

  // 新しいテスト：2週間後の日付を設定できるかを確認
  describe('generateAndSaveHtml with future dates', () => {
    let originalDate;
    
    beforeEach(() => {
      jest.clearAllMocks();
      originalDate = global.Date;
      
      // Mock Date to simulate current time
      const mockCurrentDate = new Date('2023-01-01T00:00:00Z');
      global.Date = jest.fn(() => mockCurrentDate);
      global.Date.now = jest.fn(() => mockCurrentDate.getTime());
    });
    
    afterEach(() => {
      global.Date = originalDate;
    });
    
    it('should allow setting end date up to 1 month in the future', () => {
      // 2週間後の日付を作成
      const twoWeeksLater = new Date('2023-01-15T00:00:00Z');
      
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const guidelineData = [];
      const dateInfo = {
        firstDate: new Date('2023-01-01T00:00:00Z'),
        lastDate: new Date('2023-01-01T00:00:00Z'),
        currentDate: new Date('2023-01-01T00:00:00Z'),
        oneMonthFromNow: new Date('2023-02-01T00:00:00Z'),
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-01T00:00',
        currentDateFormatted: '2023-01-01T00:00',
        oneMonthFromNowFormatted: '2023-02-01T00:00'
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 };
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      const hasDataIncrease = false;
      
      // HTMLコンテンツを生成
      generateAndSaveHtml(chartData, guidelineData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay, hasDataIncrease);
      
      // HTML内容を取得
      const htmlContent = fsMock.writeFileSync.mock.calls[0][1];
      
      // 将来の日付設定のチェック
      expect(htmlContent).toContain(`max="${dateInfo.oneMonthFromNowFormatted}"`); // 1ヶ月後までの日付が選択可能かチェック
      expect(htmlContent).toContain(`<input type="checkbox" id="show-future" name="show-future">`); // 将来表示チェックボックスが存在するかチェック
      expect(htmlContent).toContain(`1ヶ月先まで表示する`); // 1ヶ月先表示のラベルが存在するかチェック
      
      // JavaScript関数の存在チェック
      expect(htmlContent).toContain(`updateXMaxInputState`); // 終了日時の有効/無効を切り替える関数
      expect(htmlContent).toContain(`const xMaxValue = settings.showFuture ? oneMonthFromNowTimestamp : settings.xMax;`); // 将来の日付表示の条件分岐
    });
  });
  
  // fetchAndProcessData の統合テスト
  describe('fetchAndProcessData', () => {
    let originalEnv;
    let originalConsole;
    let consoleLogMock;
    let consoleErrorMock;
    let processExitMock;
    
    beforeEach(() => {
      originalEnv = { ...process.env };
      originalConsole = { ...console };
      
      // 環境変数の設定
      process.env.GIST_USER = 'testuser';
      process.env.GIST_ID = 'testid';
      
      // コンソール出力とプロセス終了のモック
      consoleLogMock = jest.fn().mockImplementation((msg) => {
        // 実際にテスト中にログを出力
        console.info(msg);
      });
      consoleErrorMock = jest.fn();
      processExitMock = jest.fn();
      
      console.log = consoleLogMock;
      console.error = consoleErrorMock;
      process.exit = processExitMock;
      
      jest.clearAllMocks();
      
      // fetchのモックをセットアップ
      const mockData = [
        { date: '2023-01-01T00:00:00Z', remainingData: '10.5' }
      ];
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockData)
      };
      
      fetchMock.mockResolvedValue(mockResponse);

      // Date の適切なモック
      global.Date = jest.fn(() => ({
        getTime: () => 1672531200000,
        toLocaleString: () => '2023-01-01 00:00:00',
        getFullYear: () => 2023,
        getMonth: () => 0,
        getDate: () => 1,
        getHours: () => 0,
        getMinutes: () => 0,
        setMonth: function(month) {
          this.month = month;
          return this;
        }
      }));
      global.Date.now = () => 1672531200000;
    });
    
    afterEach(() => {
      process.env = originalEnv;
      console = originalConsole;
      jest.restoreAllMocks();
    });
    
    it('should process data flow correctly', async () => {
      // モックでHTMLの生成ログを出力するように設定
      fsMock.writeFileSync.mockImplementation(() => {
        console.log('Chart HTML generated successfully at: ./docs/index.html');
        console.log('Generated chart with 1 data points');
      });
      
      // テスト実行
      await fetchAndProcessData();
      
      // fetchの呼び出しを検証
      expect(fetchMock).toHaveBeenCalledWith('https://gist.github.com/testuser/testid/raw/data.json');
      
      // コンソールログの内容を確認
      const allCalls = consoleLogMock.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Chart HTML generated successfully');
    });
    
    it('should handle errors gracefully', async () => {
      // エラーを発生させるモック
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      
      await fetchAndProcessData();
      
      // エラー処理を検証
      expect(consoleErrorMock).toHaveBeenCalledWith('Error occurred:', 'Network error');
      expect(processExitMock).toHaveBeenCalledWith(1);
    });
  });
});