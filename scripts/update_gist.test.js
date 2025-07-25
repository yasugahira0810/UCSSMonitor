// import文をrequireに書き換え、CommonJS形式に統一
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
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

// Mock fetch
jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn()
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

// @octokit/restのrequireを削除
// jest.unstable_mockModuleで完全にモック
jest.unstable_mockModule('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

// 環境変数をモックする直接的なアプローチを取る
// 実際のアプリケーションコードの実行時に評価される値を設定するため、
// ここで直接 process.env を設定する
// 元の環境変数を保存
const originalEnv = { ...process.env };

// テスト用の環境変数をセット
const setupTestEnv = () => {
  // 環境変数を元に戻す
  process.env = { ...originalEnv };
  
  // テスト用の値を明示的に設定
  process.env.REMAINING_DATA = '50.5';
  process.env.GIST_ID = 'test-gist-id';
  process.env.GIST_USER = 'test-user';
  process.env.GH_PAT = 'test-token';
  
  return process.env;
};

// テスト環境をセットアップ
setupTestEnv();

// モジュールをインポート
const updateGistModule = require('./update_gist.js');
const { updateGist, fetchGistData, saveGistData, generateFiles } = updateGistModule;

describe('update_gist.js', () => {
    let exitSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // テスト環境をリセット
        setupTestEnv();
        
        // コンソール出力をモック
        console.error = jest.fn();
        console.log = jest.fn();
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    describe('updateGist', () => {
        it('TS-01 TC-01-01: 新しいデータでGistを正常に更新できること', async () => {
            const mockExistingData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 100 }];
            const mockNewDate = new Date('2023-01-02T00:00:00.000Z');
            
            // 日付をモック
            jest.spyOn(global, 'Date').mockImplementation(() => mockNewDate);
            mockNewDate.toISOString = () => '2023-01-02T00:00:00.000Z';

            // API呼び出しをモック
            mockGistGet.mockResolvedValueOnce({
                data: {
                    files: {
                        'data.json': { content: JSON.stringify(mockExistingData) },
                    },
                },
            });
            mockGistUpdate.mockResolvedValueOnce({});

            // 関数を実行
            await updateGist();

            // 検証
            expect(mockGistGet).toHaveBeenCalledWith({ gist_id: 'test-gist-id' });
            
            // モックされた関数の呼び出し引数を検証
            const updateCallArgs = mockGistUpdate.mock.calls[0][0];
            const updatedContent = JSON.parse(updateCallArgs.files['data.json'].content);
            
            // 追加されたデータを検証
            expect(updatedContent).toHaveLength(2);
            expect(updatedContent[0]).toEqual(mockExistingData[0]);
            expect(updatedContent[1]).toEqual({
                date: '2023-01-02T00:00:00.000Z',
                remainingData: 50.5
            });
            
            // ログメッセージを検証
            expect(console.log).toHaveBeenCalledWith(
                'Gist updated successfully with new data:',
                {
                    date: '2023-01-02T00:00:00.000Z',
                    remainingData: 50.5
                }
            );
            
            // モックを元に戻す
            global.Date.mockRestore();
        });

        it('TS-01 TC-01-02: エラーが発生した場合でも例外をスローせずに処理すること', async () => {
            const mockError = new Error('Failed to fetch Gist');
            mockError.response = { data: 'Error response data' };
            mockGistGet.mockRejectedValueOnce(mockError);

            // 関数を実行
            await updateGist();
            
            // エラーログが出力されていることを確認
            expect(console.error).toHaveBeenCalledWith('Error updating Gist:', 'Failed to fetch Gist');
            expect(console.error).toHaveBeenCalledWith('Full error response:', JSON.stringify(mockError.response, null, 2));
            
            // プロセスが終了コード1で終了することを確認
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('fetchGistData', () => {
        it('TS-02 TC-02-01: Gistから既存データを正常に取得・解析できること', async () => {
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
            expect(mockGistGet).toHaveBeenCalledWith({ gist_id: 'test-gist-id' });
        });

        it('TS-02 TC-02-02: Gistにファイルが見つからない場合にエラーをスローすること', async () => {
            mockGistGet.mockResolvedValueOnce({ 
                data: { 
                    files: {} 
                } 
            });

            await expect(fetchGistData(mockOctokit))
                .rejects
                .toThrow('No files found in the Gist');
        });

        it('TS-02 TC-02-03: Gistの内容が有効なJSONでない場合にエラーをスローすること', async () => {
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
                
            expect(console.error).toHaveBeenCalledWith(
                'Error parsing Gist content:',
                expect.any(Error)
            );
        });
        
        // テストケース4: GIST_IDが未定義の場合にエラーをスローすること
        it('TS-02 TC-02-04: GIST_IDが未定義の場合にエラーをスローすること', async () => {
            // テスト内でモジュールを再読み込みするために元の環境変数を保存
            const originalGistId = process.env.GIST_ID;
            
            try {
                // GIST_IDを一時的に削除
                delete process.env.GIST_ID;
                
                // fetchGistDataを呼び出し、エラーがスローされることを確認
                await expect(fetchGistData(mockOctokit))
                    .rejects
                    .toThrow('GIST_ID is not defined in the environment variables');
                
                // API呼び出しは行われないはず
                expect(mockGistGet).not.toHaveBeenCalled();
            } finally {
                // テスト終了後に環境変数を復元
                process.env.GIST_ID = originalGistId;
            }
        });
    });

    describe('saveGistData', () => {
        it('TS-03 TC-03-01: 更新したデータをGistに正常に保存できること', async () => {
            const mockUpdatedData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 50 }];

            mockGistUpdate.mockResolvedValueOnce({});

            await saveGistData(mockOctokit, mockUpdatedData);

            // gist_idと更新内容を検証
            expect(mockGistUpdate).toHaveBeenCalledWith({
                gist_id: 'test-gist-id',
                files: {
                    'data.json': {
                        content: JSON.stringify(mockUpdatedData, null, 2)
                    }
                }
            });
        });
        
        // エラーが発生した場合の処理をテスト
        it('should propagate errors that occur during Gist update', async () => {
            const mockUpdatedData = [{ date: '2023-01-01T00:00:00.000Z', remainingData: 50 }];
            const mockError = new Error('Failed to update Gist');
            
            mockGistUpdate.mockRejectedValueOnce(mockError);
            
            await expect(saveGistData(mockOctokit, mockUpdatedData))
                .rejects
                .toThrow('Failed to update Gist');
        });
    });

    describe('generateFiles', () => {
      let mockExistSync, mockMkdirSync, mockWriteFileSync, mockJoin;
      beforeEach(() => {
        jest.resetModules();
        mockExistSync = jest.fn();
        mockMkdirSync = jest.fn();
        mockWriteFileSync = jest.fn();
        mockJoin = (...parts) => parts.join('/');
        jest.doMock('fs', () => ({
          __esModule: true,
          ...jest.requireActual('fs'),
          existsSync: mockExistSync,
          mkdirSync: mockMkdirSync,
          writeFileSync: mockWriteFileSync
        }));
        jest.doMock('path', () => ({
          __esModule: true,
          ...jest.requireActual('path'),
          join: mockJoin
        }));
      });
      afterEach(() => {
        jest.resetModules();
        jest.dontMock('fs');
        jest.dontMock('path');
      });
      it('TS-04 TC-04-01: ディレクトリが存在しない場合にHTMLファイルを正常に生成できること', () => {
        mockExistSync.mockReturnValue(false);
        const { generateFiles } = require('./update_gist.js');
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
      it('TS-04 TC-04-02: ディレクトリが既に存在する場合にHTMLファイルのみを生成すること', () => {
        mockExistSync.mockReturnValue(true);
        const { generateFiles } = require('./update_gist.js');
        generateFiles();
        expect(mockExistSync).toHaveBeenCalledWith('docs');
        expect(mockMkdirSync).not.toHaveBeenCalled();
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          'docs/chart.html',
          expect.stringContaining('<title>Chart</title>')
        );
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          'docs/index.html',
          expect.stringContaining('<title>Index</title>')
        );
      });
      it('should generate HTML files with correct content', () => {
        mockExistSync.mockReturnValue(true);
        const { generateFiles } = require('./update_gist.js');
        generateFiles();
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          'docs/chart.html',
          expect.stringContaining('https://cdn.jsdelivr.net/npm/chart.js')
        );
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          'docs/index.html',
          expect.stringContaining('<title>Index</title>')
        );
      });
    });
});