import { jest } from '@jest/globals';
import * as dotenv from 'dotenv';

// .envファイルから環境変数を読み込む
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
const updateGistModule = await import('./update_gist.js');
const { updateGist, fetchGistData, saveGistData, generateFiles } = updateGistModule;

describe('update_gist.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // テスト環境をリセット
        setupTestEnv();
        
        // コンソール出力をモック
        console.error = jest.fn();
        console.log = jest.fn();
    });

    describe('updateGist', () => {
        // テストケース1: 新しいデータでGistを正常に更新できること
        it('should update the Gist with new data', async () => {
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

        // テストケース2: エラーが発生した場合でも例外をスローせずに処理すること
        it('should handle errors gracefully', async () => {
            const mockError = new Error('Failed to fetch Gist');
            mockError.response = { data: 'Error response data' };
            mockGistGet.mockRejectedValueOnce(mockError);

            // テスト実行 - エラーはキャッチされるはず
            await expect(updateGist()).resolves.not.toThrow();
            
            // エラーログが出力されていることを確認
            expect(console.error).toHaveBeenCalledWith('Error updating Gist:', 'Failed to fetch Gist');
            expect(console.error).toHaveBeenCalledWith('Response data:', 'Error response data');
        });
    });

    describe('fetchGistData', () => {
        // テストケース1: Gistから既存データを正常に取得・解析できること
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
            expect(mockGistGet).toHaveBeenCalledWith({ gist_id: 'test-gist-id' });
        });

        // テストケース2: Gistにファイルが見つからない場合にエラーをスローすること
        it('should throw an error if no files are found in the Gist', async () => {
            mockGistGet.mockResolvedValueOnce({ 
                data: { 
                    files: {} 
                } 
            });

            await expect(fetchGistData(mockOctokit))
                .rejects
                .toThrow('No files found in the Gist');
        });

        // テストケース3: Gistの内容が有効なJSONでない場合にエラーをスローすること
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
                
            expect(console.error).toHaveBeenCalledWith(
                'Error parsing Gist content:',
                expect.any(Error)
            );
        });
        
        // テストケース4: GIST_IDが未定義の場合にエラーをスローすること
        it('should throw an error if GIST_ID is not defined', async () => {
            // テスト内でモジュールを再読み込みするために元の環境変数を保存
            const originalGistId = process.env.GIST_ID;
            
            try {
                // GIST_IDを一時的に削除
                delete process.env.GIST_ID;
                
                // 直接関数を呼び出す代わりにモジュールを再インポートする
                // これにより、モジュール内の定数がプロセス環境から再評価される
                jest.resetModules();
                
                // モジュールを再インポート
                const { fetchGistData: freshFetchGistData } = await import('./update_gist.js');
                
                // 再インポートした関数を呼び出し
                await expect(freshFetchGistData(mockOctokit))
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
        // テストケース1: 更新したデータをGistに正常に保存できること
        it('should save updated data to the Gist', async () => {
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
        // テストケース1: ディレクトリが存在しない場合にHTMLファイルを正常に生成できること
        it('should create directory and generate HTML files if directory does not exist', () => {
            // Directory does not exist
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
            
            // Verify that logs were output
            expect(console.log).toHaveBeenCalledWith('chart.html was generated in docs');
            expect(console.log).toHaveBeenCalledWith('index.html was generated in docs');
        });

        // テストケース2: ディレクトリが既に存在する場合にHTMLファイルのみを生成すること
        it('should not create the directory if it already exists', () => {
            // Directory already exists
            mockExistSync.mockReturnValueOnce(true);

            generateFiles();

            expect(mockExistSync).toHaveBeenCalledWith('docs');
            expect(mockMkdirSync).not.toHaveBeenCalled();
            
            // Verify files are still generated
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/chart.html',
                expect.stringContaining('<title>Chart</title>')
            );
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/index.html',
                expect.stringContaining('<title>Index</title>')
            );
        });
        
        // ファイルの内容を詳細に検証
        it('should generate HTML files with correct content', () => {
            mockExistSync.mockReturnValueOnce(true);
            
            generateFiles();
            
            // Chart.js が含まれていることを確認
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/chart.html',
                expect.stringContaining('https://cdn.jsdelivr.net/npm/chart.js')
            );
            
            // Canvas要素が含まれていることを確認
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/chart.html',
                expect.stringContaining('<canvas id="myChart"')
            );
            
            // Index ページの内容を確認
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                'docs/index.html',
                expect.stringContaining('<h1>Index Page</h1>')
            );
        });
    });
});