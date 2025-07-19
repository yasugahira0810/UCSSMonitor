const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const fsMock = {
    writeFileSync: jest.fn()
};

// モックを設定
jest.unstable_mockModule('fs', () => ({
    default: fsMock
}));

// モックが設定された後にスクリプトをインポート
const { logErrorDetails, isLoggedIn, login, waitForPostLoginElements, getRemainingData } = require('./scraper.js');

describe('scraper.js', () => {
    let browser;
    let page;
    
    beforeAll(async () => {
        browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: "new"
        });
        page = await browser.newPage();
    });
    
    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // scraper.jsのfs参照をテスト用モックに差し替え
        const scraper = require('./scraper.js');
        scraper.fs = fsMock;
    });

    // 1. logErrorDetails
    describe('logErrorDetails', () => {
        it.skip('TS-01 TC-01-01: エラー詳細を正しくJSONファイルに出力する', async () => {
            const mockPage = { url: () => 'https://example.com' };
            const errorMessage = 'テストエラーメッセージ';
            
            await logErrorDetails(mockPage, errorMessage);
            
            expect(fsMock.writeFileSync).toHaveBeenCalledWith(
                'error_details.json',
                expect.any(String)
            );
            
            const jsonArg = JSON.parse(fsMock.writeFileSync.mock.calls[0][1]);
            expect(jsonArg).toEqual({
                date: expect.any(String),
                status: 'エラー',
                error: errorMessage,
                url: 'https://example.com'
            });
        });

        it.skip('TS-01 TC-01-02: 特殊文字を含む複雑なエラーメッセージを正しく処理する', async () => {
            const mockPage = { url: () => 'https://example.com' };
            const complexError = 'エラー発生:\n"引用符"と\\バックスラッシュを含む\n複数行のエラー';
            
            await logErrorDetails(mockPage, complexError);
            
            const jsonArg = JSON.parse(fsMock.writeFileSync.mock.calls[0][1]);
            expect(jsonArg.error).toBe(complexError);
        });
    });

    // 2. isLoggedIn
    describe('isLoggedIn', () => {
        it('TS-02 TC-02-01: サービス詳細ボタンが存在する場合はtrueを返す', async () => {
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            const result = await isLoggedIn(page);
            expect(result).toBe(true);
        });

        it('TS-02 TC-02-02: サービス詳細ボタンが存在しない場合はfalseを返す', async () => {
            await page.setContent('<div>ログインページ</div>');
            const result = await isLoggedIn(page);
            expect(result).toBe(false);
        });
    });

    // 3. login
    describe('login', () => {
        it('TS-03 TC-03-01: メールまたはパスワードが未設定の場合はエラーをスローする', async () => {
            await expect(login(page, null, 'password'))
                .rejects
                .toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
                
            await expect(login(page, 'email', null))
                .rejects
                .toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
        });

        it('TS-03 TC-03-02: 正常にログインできる場合はエラーをスローしない', async () => {
            // HTML準備とモック設定
            await page.setContent(`
                <input id="inputEmail" />
                <input id="inputPassword" />
                <button id="login">ログイン</button>
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            
            // 必要なメソッドをモック化
            const mockGoto = jest.spyOn(page, 'goto').mockResolvedValue();
            const mockType = jest.spyOn(page, 'type').mockResolvedValue();
            const mockClick = jest.spyOn(page, 'click').mockResolvedValue();
            const mockWaitForNavigation = jest.spyOn(page, 'waitForNavigation').mockResolvedValue();
            
            // テスト実行
            await login(page, 'test@example.com', 'password123');
            
            // 検証
            expect(mockGoto).toHaveBeenCalledWith(expect.stringContaining('login'));
            expect(mockType).toHaveBeenCalledWith('#inputEmail', 'test@example.com');
            expect(mockType).toHaveBeenCalledWith('#inputPassword', 'password123');
            expect(mockClick).toHaveBeenCalledWith('#login');
            expect(mockWaitForNavigation).toHaveBeenCalled();
        });

        it.skip('TS-03 TC-03-03: ログインエラーメッセージが表示された場合はエラーをスローする', async () => {
            // エラーメッセージを含むHTML準備
            await page.setContent(`
                <input id="inputEmail" />
                <input id="inputPassword" />
                <button id="login">ログイン</button>
                <div class="app-main">
                    <div class="main-body">
                        <div>
                            <div>
                                <div>
                                    <div>
                                        <div>
                                            <div>ログイン失敗: 認証情報が無効です</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            
            // メソッドのモック
            jest.spyOn(page, 'goto').mockResolvedValue();
            jest.spyOn(page, 'type').mockResolvedValue();
            jest.spyOn(page, 'click').mockResolvedValue();
            jest.spyOn(page, 'waitForNavigation').mockResolvedValue();
            
            // エラーメッセージ要素のモック
            jest.spyOn(page, '$').mockResolvedValue({});
            jest.spyOn(page, 'evaluate').mockResolvedValue('ログイン失敗: 認証情報が無効です');
            
            // テスト実行
            await expect(login(page, 'test@example.com', 'wrongpassword'))
                .rejects
                .toThrow('ログイン失敗: ログイン失敗: 認証情報が無効です');
                
            // logErrorDetailsが呼ばれたことを確認
            expect(fsMock.writeFileSync).toHaveBeenCalled();
        });

        it.skip('TS-03 TC-03-04: 入力フィールドが見つからない場合はエラーをスローする', async () => {
            // メールフィールドを含まないHTML
            await page.setContent(`
                <div>
                    <input id="wrongId" />
                    <button id="login">ログイン</button>
                </div>
            `);
            
            // waitForSelectorが失敗するようにモック
            jest.spyOn(page, 'waitForSelector').mockRejectedValue(new Error('Element not found'));
            
            // テスト実行
            await expect(login(page, 'test@example.com', 'password123'))
                .rejects
                .toThrow('メールアドレス入力フィールドが見つかりません');
                
            // logErrorDetailsが呼ばれたことを確認
            expect(fsMock.writeFileSync).toHaveBeenCalled();
        });
    });

    // 4. waitForPostLoginElements
    describe('waitForPostLoginElements', () => {
        it('TS-04 TC-04-01: サービス詳細ボタンが表示されている場合はエラーをスローしない', async () => {
            // ボタンを含むHTMLをセット - セレクターと完全に一致するように修正
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            
            // waitForSelectorが成功するようにモック
            jest.spyOn(page, 'waitForSelector').mockResolvedValue(true);
            
            // エラーがスローされないことを確認
            await expect(waitForPostLoginElements(page)).resolves.not.toThrow();
        });

        it.skip('TS-04 TC-04-02: サービス詳細ボタンが表示されない場合はエラーをスローする', async () => {
            // ボタンを含まないHTMLをセット
            await page.setContent('<div>別のページ</div>');
            
            // waitForSelectorがエラーをスローするようにモック
            jest.spyOn(page, 'waitForSelector').mockRejectedValue(new Error('Element not found'));
            
            // 適切なエラーメッセージでエラーがスローされることを確認
            await expect(waitForPostLoginElements(page))
                .rejects
                .toThrow('「サービスの詳細」ページへのリンクが見つかりません');
                
            // logErrorDetailsが呼ばれたことを確認
            expect(fsMock.writeFileSync).toHaveBeenCalled();
        });
    });

    // 5. getRemainingData
    describe('getRemainingData', () => {
        it('TS-05 TC-05-01: 残りデータ通信量を正常に取得できる', async () => {
            // HTML準備
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
                <div id="traffic-header">
                    <p class="free-traffic">
                        <span class="traffic-number">123 GB</span>
                    </p>
                </div>
            `);
            
            // メソッドのモック
            const mockClick = jest.spyOn(page, 'click').mockResolvedValue();
            // waitForSelectorが成功するようにモック
            jest.spyOn(page, 'waitForSelector').mockResolvedValue(true);
            jest.spyOn(page, '$eval').mockResolvedValue('123 GB');
            
            // 関数実行
            const result = await getRemainingData(page);
            
            // 検証
            expect(mockClick).toHaveBeenCalledWith(
                '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button'
            );
            expect(result).toBe('123 GB');
        });

        it.skip('TS-05 TC-05-02: 残りデータ通信量の要素が見つからない場合はエラーをスローする', async () => {
            // HTML準備 - 必要な要素を含まない
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div>
                        <div class="list-group-item-actions">
                            <button>サービスの詳細</button>
                        </div>
                    </div>
                </div>
            `);
            
            // クリックはモックするが、waitForSelectorはエラーをスローするようにモック
            jest.spyOn(page, 'click').mockResolvedValue();
            jest.spyOn(page, 'waitForSelector').mockRejectedValue(new Error('Element not found'));
            
            // 関数実行とエラー確認
            await expect(getRemainingData(page))
                .rejects
                .toThrow('残りデータ通信量の要素が見つかりません');
                
            // logErrorDetailsが呼ばれたことを確認
            expect(fsMock.writeFileSync).toHaveBeenCalled();
        });

        it('TS-05 TC-05-03: 様々なフォーマットのデータ通信量を正しく処理する', async () => {
            // 小数点を含むGBパターン
            await page.setContent(`
                <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
                    <div><div class="list-group-item-actions"><button>サービスの詳細</button></div></div>
                </div>
                <div id="traffic-header"><p class="free-traffic"><span class="traffic-number">1.5 GB</span></p></div>
            `);
            
            jest.spyOn(page, 'click').mockResolvedValue();
            // waitForSelectorが成功するようにモック
            jest.spyOn(page, 'waitForSelector').mockResolvedValue(true);
            jest.spyOn(page, '$eval').mockResolvedValue('1.5 GB');
            
            const result1 = await getRemainingData(page);
            expect(result1).toBe('1.5 GB');
            
            // MBパターン
            jest.spyOn(page, '$eval').mockResolvedValue('500 MB');
            
            const result2 = await getRemainingData(page);
            expect(result2).toBe('500 MB');
        });
    });

    // 6. エッジケースとエラー処理
    describe('エッジケースとエラー処理', () => {
        it.skip('TS-06 TC-06-01: タイムアウトエラーが適切に処理される', async () => {
            await page.setContent('<div>テストページ</div>');
            
            // waitForSelectorがタイムアウトエラーをスローするようにモック
            jest.spyOn(page, 'waitForSelector').mockRejectedValue(new Error('Timeout exceeded'));
            jest.spyOn(page, 'goto').mockResolvedValue();
            
            // ログイン試行でのタイムアウト処理を確認
            await expect(login(page, 'test@example.com', 'password'))
                .rejects
                .toThrow();
                
            // logErrorDetailsが呼ばれたことを確認
            expect(fsMock.writeFileSync).toHaveBeenCalled();
        });

        it.skip('TS-06 TC-06-02: 異常なHTML構造でも適切にエラー処理される', async () => {
            // 期待と異なる構造のHTMLをセット
            await page.setContent(`
                <div id="completely-different-structure">
                    <input type="text" id="different-email-field" />
                    <button id="some-other-button">Click</button>
                </div>
            `);
            
            jest.spyOn(page, 'goto').mockResolvedValue();
            jest.spyOn(page, 'waitForSelector').mockRejectedValue(new Error('Element not found'));
            
            // ログイン試行
            await expect(login(page, 'test@example.com', 'password'))
                .rejects
                .toThrow('メールアドレス入力フィールドが見つかりません');
                
            // logErrorDetailsが呼ばれたことを確認
            expect(fsMock.writeFileSync).toHaveBeenCalled();
        });
    });
});