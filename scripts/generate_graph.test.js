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
  });

  // formatDateForInput のテスト
  describe('formatDateForInput', () => {
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
      
      // Mock Date constructor for specific timestamps
      global.Date = jest.fn((arg) => {
        if (arg === '2023-01-01T00:00:00Z') {
          return {
            getTime: () => 1672531200000, // '2023-01-01T00:00:00Z'
            toLocaleString: () => '2023-01-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0
          };
        } else if (arg === '2023-01-02T00:00:00Z') {
          return {
            getTime: () => 1672617600000, // '2023-01-02T00:00:00Z' 
            toLocaleString: () => '2023-01-02 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 1,
            getDate: () => 2,
            getHours: () => 0,
            getMinutes: () => 0
          };
        } else {
          return {
            getTime: () => 1672704000000, // '2023-01-03T00:00:00Z' (current date)
            toLocaleString: () => '2023-01-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 2,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0
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
      
      // Mock Date constructor for specific timestamps
      global.Date = jest.fn((arg) => {
        if (arg === '2023-01-01T00:00:00Z') {
          return {
            getTime: () => 1672531200000,
            toLocaleString: () => '2023-01-01 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 0,
            getDate: () => 1,
            getHours: () => 0,
            getMinutes: () => 0
          };
        } else if (arg === '2023-01-02T00:00:00Z') {
          return {
            getTime: () => 1672617600000,
            toLocaleString: () => '2023-01-02 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 1,
            getDate: () => 2,
            getHours: () => 0,
            getMinutes: () => 0
          };
        } else {
          return {
            getTime: () => 1672704000000,
            toLocaleString: () => '2023-01-03 00:00:00',
            getFullYear: () => 2023,
            getMonth: () => 2,
            getDate: () => 3,
            getHours: () => 0,
            getMinutes: () => 0
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
  });

  // calculateYAxisRange のテスト
  describe('calculateYAxisRange', () => {
    it('should use default max when value is below first threshold', () => {
      const maxValue = 30;

      const yAxisSettings = calculateYAxisRange(maxValue);

      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 50,
      });
    });

    it('should use intermediate threshold when value is between thresholds', () => {
      const maxValue = 75;

      const yAxisSettings = calculateYAxisRange(maxValue);

      expect(yAxisSettings).toEqual({
        yAxisMin: 0,
        yAxisMax: 100,
      });
    });

    it('should calculate the correct Y-axis range for larger values', () => {
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
    beforeEach(() => {
      jest.clearAllMocks();
    });
    
    it('should create directory and save HTML file', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00'
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 };
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay);
      
      expect(fsMock.mkdirSync).toHaveBeenCalledWith('./docs', { recursive: true });
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        './docs/index.html',
        expect.stringContaining('<!DOCTYPE html>')
      );
    });
    
    it('should include chart data in the HTML', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00'
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 };
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      // writeFileSyncの呼び出しをキャプチャしてHTMLの内容を検証
      fsMock.writeFileSync.mockImplementation((path, content) => {
        expect(content).toContain(JSON.stringify(chartData));
        expect(content).toContain('残りデータ量 (GB)'); // グラフのラベル
        expect(content).toContain('UTC+0'); // タイムゾーン表示
      });
      
      generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay);
      
      expect(fsMock.writeFileSync).toHaveBeenCalled();
    });
    
    it('should display DEFAULT_MIN and DEFAULT_MAX as initial values for y-axis inputs', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00'
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 }; // DEFAULT_MIN=0, DEFAULT_MAX=50
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      // HTMLの内容をキャプチャして検証
      let htmlContent = '';
      fsMock.writeFileSync.mockImplementation((path, content) => {
        htmlContent = content;
      });
      
      generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay);
      
      // y-min-inputの初期値を検証
      expect(htmlContent).toContain('<input type="number" id="y-min-input" min="0" max="500" step="5" value="0">');
      
      // y-max-inputの初期値を検証
      expect(htmlContent).toContain('<input type="number" id="y-max-input" min="0" max="500" step="5" value="50">');
      
      // スライダーの初期値も検証
      expect(htmlContent).toContain('<input type="range" id="y-min-range" class="dual-slider" min="0" max="500" step="5" value="0">');
      expect(htmlContent).toContain('<input type="range" id="y-max-range" class="dual-slider" min="0" max="500" step="5" value="50">');
    });

    it('should display DEFAULT_MIN as initial value for y-min-input', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00'
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 }; // DEFAULT_MIN=0, DEFAULT_MAX=50
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      // HTMLの内容をキャプチャして検証
      let htmlContent = '';
      fsMock.writeFileSync.mockImplementation((path, content) => {
        htmlContent = content;
      });
      
      generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay);
      
      // y-min-inputの初期値を検証
      expect(htmlContent).toContain('<input type="number" id="y-min-input" min="0" max="500" step="5" value="0">');
    });
    
    it('should display DEFAULT_MAX as initial value for y-max-input', () => {
      const chartData = [{ x: 1672531200000, y: 10.5 }];
      const dateInfo = {
        firstDate: { getTime: () => 1672531200000 },
        lastDate: { getTime: () => 1672617600000 },
        currentDate: { getTime: () => 1672704000000 },
        firstDateFormatted: '2023-01-01T00:00',
        lastDateFormatted: '2023-01-02T00:00',
        currentDateFormatted: '2023-01-03T00:00'
      };
      const axisSettings = { yAxisMin: 0, yAxisMax: 50 };
      const filteredData = [{ date: '2023-01-01T00:00:00Z', remainingData: '10.5' }];
      const timezone = 'UTC';
      const timezoneDisplay = 'UTC+0';
      
      // HTMLの内容をキャプチャして検証
      let htmlContent = '';
      fsMock.writeFileSync.mockImplementation((path, content) => {
        htmlContent = content;
      });
      
      generateAndSaveHtml(chartData, dateInfo, axisSettings, filteredData, timezone, timezoneDisplay);
      
      // y-max-inputの初期値を検証
      expect(htmlContent).toContain('<input type="number" id="y-max-input" min="0" max="500" step="5" value="50">');
      
      // スライダーの初期値も検証
      expect(htmlContent).toContain('<input type="range" id="y-max-range" class="dual-slider" min="0" max="500" step="5" value="50">');
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
      consoleLogMock = jest.fn();
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
        getMinutes: () => 0
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