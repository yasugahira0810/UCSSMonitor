# scraper.js テストケース設計書

## 概要
scraper.jsのユニットテストケースを設計するためのドキュメントです。Jestフレームワークを使用して実施可能なテストケースを詳細に記述します。

## テスト環境のセットアップ

```javascript
import puppeteer from 'puppeteer';
import { jest } from '@jest/globals';

// fsモジュールのモック
const fsMock = {
  writeFileSync: jest.fn()
};

// モジュールのモック設定
jest.unstable_mockModule('fs', () => ({
  default: fsMock
}));

// モック設定後にスクリプトをインポート
const { logErrorDetails, isLoggedIn, login, waitForPostLoginElements, getRemainingData } = await import('./scraper.js');

describe('scraper.js', () => {
  let browser;
  let page;
  
  // テスト前の準備
  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: "new"
    });
    page = await browser.newPage();
  });
  
  // テスト後のクリーンアップ
  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });
  
  // 各テスト前にモックをリセット
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // 実際のテストケース...
});
```

## テストケース

### 1. logErrorDetails関数のテスト

#### テストケース 1.1: エラー詳細のログ出力
- **目的**: エラー情報が正しくJSONファイルに出力されることを確認する
- **前提条件**: モックされたfsモジュールと有効なPageオブジェクト
- **入力**: 
  - page: { url: () => 'https://example.com' }
  - errorMessage: "テストエラーメッセージ"
- **期待される結果**: 
  - fs.writeFileSyncが正しいパラメータで呼び出される
  - 出力されるJSONオブジェクトが正しい形式（日付、ステータス、エラー、URL）である

```javascript
describe('logErrorDetails', () => {
  it('エラー詳細を正しくJSONファイルに出力する', async () => {
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
});
```

#### テストケース 1.2: 複雑なエラーメッセージでのログ出力
- **目的**: 特殊文字や長いエラーメッセージも正しく処理されることを確認
- **前提条件**: モックされたfsモジュールと有効なPageオブジェクト
- **入力**: 
  - page: { url: () => 'https://example.com' }
  - errorMessage: 特殊文字（"\n", "\"", "\\"など）を含む長いエラーメッセージ
- **期待される結果**: 
  - エラーメッセージが正しくJSONに格納される
  - 特殊文字が適切にエスケープされる

```javascript
it('特殊文字を含む複雑なエラーメッセージを正しく処理する', async () => {
  const mockPage = { url: () => 'https://example.com' };
  const complexError = 'エラー発生:\n"引用符"と\\バックスラッシュを含む\n複数行のエラー';
  
  await logErrorDetails(mockPage, complexError);
  
  const jsonArg = JSON.parse(fsMock.writeFileSync.mock.calls[0][1]);
  expect(jsonArg.error).toBe(complexError);
});
```

### 2. isLoggedIn関数のテスト

#### テストケース 2.1: ログイン状態の検出 - ログイン済み
- **目的**: サービス詳細ボタンが存在する場合にtrueを返すことを確認
- **前提条件**: サービス詳細ボタンを含むHTMLページがロードされている
- **入力**: 
  - page: サービス詳細ボタンを含むページオブジェクト
- **期待される結果**: 関数がtrueを返す

```javascript
describe('isLoggedIn', () => {
  it('サービス詳細ボタンが存在する場合はtrueを返す', async () => {
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
```

#### テストケース 2.2: ログイン状態の検出 - 未ログイン
- **目的**: サービス詳細ボタンが存在しない場合にfalseを返すことを確認
- **前提条件**: サービス詳細ボタンを含まないHTMLページがロードされている
- **入力**: 
  - page: サービス詳細ボタンを含まないページオブジェクト
- **期待される結果**: 関数がfalseを返す

```javascript
  it('サービス詳細ボタンが存在しない場合はfalseを返す', async () => {
    await page.setContent('<div>ログインページ</div>');
    
    const result = await isLoggedIn(page);
    expect(result).toBe(false);
  });
});
```

### 3. login関数のテスト

#### テストケース 3.1: 認証情報なしでのログイン試行
- **目的**: メールまたはパスワードが未設定の場合に適切なエラーがスローされることを確認
- **前提条件**: 認証情報が未設定の状態
- **入力**: 
  - page: 有効なページオブジェクト
  - email: null
  - password: "password" または null/undefined
- **期待される結果**: 
  - "環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません"というエラーメッセージでエラーがスローされる

```javascript
describe('login', () => {
  it('メールまたはパスワードが未設定の場合はエラーをスローする', async () => {
    await expect(login(page, null, 'password'))
      .rejects
      .toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
      
    await expect(login(page, 'email', null))
      .rejects
      .toThrow('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
  });
```

#### テストケース 3.2: 正常なログイン処理
- **目的**: 認証情報が正しく、ログインが成功する場合の動作を確認
- **前提条件**: ログインページとログイン後のページを模したHTML
- **入力**: 
  - page: モックされたページオブジェクト
  - email: "test@example.com"
  - password: "password123"
- **期待される結果**: 
  - 適切なURLに遷移する
  - フォームに入力が行われる
  - ログインボタンがクリックされる
  - isLoggedInがtrueを返す
  - エラーをスローしない

```javascript
  it('正常にログインできる場合はエラーをスローしない', async () => {
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
```

#### テストケース 3.3: ログインエラーメッセージが表示された場合
- **目的**: ログインエラーメッセージが表示された場合の処理を確認
- **前提条件**: ログインエラーメッセージを含むHTML
- **入力**: 
  - page: エラーメッセージを表示するページ
  - email: "test@example.com"
  - password: "wrongPassword"
- **期待される結果**: 
  - "ログイン失敗: {エラーメッセージ}"でエラーがスローされる
  - logErrorDetailsが呼び出される

```javascript
  it('ログインエラーメッセージが表示された場合はエラーをスローする', async () => {
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
```

#### テストケース 3.4: 入力フィールドが見つからない場合
- **目的**: 必要な入力フィールドがページに存在しない場合のエラー処理を確認
- **前提条件**: 破損したログインページをシミュレート
- **入力**: 
  - page: メールアドレス入力フィールドを含まないHTML
  - email: "test@example.com"
  - password: "testPassword"
- **期待される結果**: 
  - "メールアドレス入力フィールドが見つかりません"のエラーがスローされる
  - logErrorDetailsが呼び出される

```javascript
  it('入力フィールドが見つからない場合はエラーをスローする', async () => {
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
```

### 4. waitForPostLoginElements関数のテスト

#### テストケース 4.1: ログイン後の要素が正常に表示される場合
- **目的**: ログイン後の要素（サービス詳細ボタン）が表示される場合に正常に処理されることを確認
- **前提条件**: サービス詳細ボタンを含むHTMLがロードされている
- **入力**: 
  - page: サービス詳細ボタンを含むページオブジェクト
- **期待される結果**: 関数が正常に終了し、エラーをスローしない

```javascript
describe('waitForPostLoginElements', () => {
  it('サービス詳細ボタンが表示されている場合はエラーをスローしない', async () => {
    // ボタンを含むHTMLをセット
    await page.setContent(`
      <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
        <div>
          <div class="list-group-item-actions">
            <button>サービスの詳細</button>
          </div>
        </div>
      </div>
    `);
    
    // エラーがスローされないことを確認
    await expect(waitForPostLoginElements(page)).resolves.not.toThrow();
  });
```

#### テストケース 4.2: ログイン後の要素が表示されない場合
- **目的**: サービス詳細ボタンが表示されない場合のエラー処理を確認
- **前提条件**: サービス詳細ボタンを含まないHTMLがロードされている
- **入力**: 
  - page: サービス詳細ボタンを含まないページオブジェクト
- **期待される結果**: 
  - "「サービスの詳細」ページへのリンクが見つかりません"のエラーがスローされる
  - logErrorDetailsが呼び出される

```javascript
  it('サービス詳細ボタンが表示されない場合はエラーをスローする', async () => {
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
```

### 5. getRemainingData関数のテスト

#### テストケース 5.1: データ通信量の取得 - 正常
- **目的**: 残りデータ通信量が正常に取得できることを確認
- **前提条件**: サービス詳細ボタンと通信量表示要素を含むHTML
- **入力**: 
  - page: 必要な要素を含むページオブジェクト
- **期待される結果**: 
  - 関数が通信量文字列を返す
  - 適切なセレクタに対してクリックが行われる

```javascript
describe('getRemainingData', () => {
  it('残りデータ通信量を正常に取得できる', async () => {
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
    jest.spyOn(page, '$eval').mockResolvedValue('123 GB');
    
    // 関数実行
    const result = await getRemainingData(page);
    
    // 検証
    expect(mockClick).toHaveBeenCalledWith(
      '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button'
    );
    expect(result).toBe('123 GB');
  });
```

#### テストケース 5.2: データ通信量の取得 - 要素が見つからない
- **目的**: 通信量表示要素が存在しない場合のエラー処理を確認
- **前提条件**: 通信量表示要素を含まないHTMLページがロードされている
- **入力**: 
  - page: 通信量表示要素を含まないページオブジェクト
- **期待される結果**: 
  - 適切なエラーメッセージでエラーがスローされる
  - logErrorDetailsが呼び出される

```javascript
  it('残りデータ通信量の要素が見つからない場合はエラーをスローする', async () => {
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
      .toThrow();
      
    // logErrorDetailsが呼ばれ、正しいエラーメッセージが使われているか確認
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      'error_details.json',
      expect.stringContaining('残りデータ通信量の取得に失敗しました')
    );
  });
```

#### テストケース 5.3: 様々なフォーマットのデータ通信量
- **目的**: 異なるフォーマットのデータ通信量表示でも正しく処理されることを確認
- **前提条件**: 様々なフォーマットの通信量表示をシミュレート
- **入力**: 様々なフォーマットの通信量表示を含むページ
- **期待される結果**: それぞれのケースで正しく値が抽出される

```javascript
  it('様々なフォーマットのデータ通信量を正しく処理する', async () => {
    // 小数点を含むGBパターン
    await page.setContent(`
      <div id="ClientAreaHomePagePanels-Active_Products_Services-0">
        <div><div class="list-group-item-actions"><button>サービスの詳細</button></div></div>
      </div>
      <div id="traffic-header"><p class="free-traffic"><span class="traffic-number">1.5 GB</span></p></div>
    `);
    
    jest.spyOn(page, 'click').mockResolvedValue();
    jest.spyOn(page, '$eval').mockResolvedValue('1.5 GB');
    
    const result1 = await getRemainingData(page);
    expect(result1).toBe('1.5 GB');
    
    // MBパターン
    jest.spyOn(page, '$eval').mockResolvedValue('500 MB');
    
    const result2 = await getRemainingData(page);
    expect(result2).toBe('500 MB');
  });
});
```

### 6. エッジケースとエラー条件のテスト

#### テストケース 6.1: タイムアウトエラー
- **目的**: 各関数でのタイムアウト時の処理を確認
- **前提条件**: waitForSelectorがタイムアウトするようにモック
- **入力**: モックページオブジェクト
- **期待される結果**: 適切なエラーメッセージでエラーがスローされ、logErrorDetailsが呼び出される

```javascript
describe('エッジケースとエラー処理', () => {
  it('タイムアウトエラーが適切に処理される', async () => {
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
```

#### テストケース 6.2: 異常なHTMLフォーマット
- **目的**: ページの構造が予期せず変わった場合の堅牢性を確認
- **前提条件**: 異なる構造のHTMLを含むページ
- **入力**: 予期しない構造のHTMLを含むページオブジェクト 
- **期待される結果**: 適切なエラーハンドリングが行われ、具体的なエラーメッセージが提供される

```javascript
  it('異常なHTML構造でも適切にエラー処理される', async () => {
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
```

#### テストケース 6.3: ウェブサイト自体の変更に対する耐性
- **目的**: セレクタが変更された場合の影響を検証
- **前提条件**: SELECTORSオブジェクトのモックとテスト環境
- **入力**: 変更されたセレクタ
- **期待される結果**: 適切なエラーメッセージを表示し、スクリプトの保守性が確認できる

```javascript
  it('セレクタが変更された場合に適切にエラーハンドリングされる', async () => {
    // オリジナルのSELECTORSをバックアップ
    const originalSelectors = { ...SELECTORS };
    
    // セレクタを一時的に変更
    SELECTORS.emailInput = '#changedEmailSelector';
    
    await page.setContent(`
      <input id="inputEmail" />
      <input id="inputPassword" />
    `);
    
    jest.spyOn(page, 'goto').mockResolvedValue();
    jest.spyOn(page, 'waitForSelector').mockRejectedValue(new Error('Element not found'));
    
    // 変更されたセレクタでログイン試行
    await expect(login(page, 'test@example.com', 'password'))
      .rejects
      .toThrow('メールアドレス入力フィールドが見つかりません');
    
    // クリーンアップ - セレクタを元に戻す
    SELECTORS = originalSelectors;
  });
});
```

## まとめ

これらのテストケースは、scraper.jsの以下の側面をカバーしています：

1. **基本機能**: 各関数の基本動作の確認
2. **エラー処理**: 様々なエラーシナリオでの適切な処理
3. **エッジケース**: 特殊な入力や境界条件での動作
4. **堅牢性**: ウェブサイトの変更やHTMLの変更に対する耐性

テストを実装する際の注意点：
- Puppeteerのページオブジェクトとブラウザを適切にセットアップしモック化する
- fsモジュールをモック化してファイル書き込みをテスト
- waitForSelector, click, goto などの非同期メソッドを適切にモック化
- エラーのスローと捕捉を確認
- HTML構造のバリエーションをシミュレート

これらのテストケースを実装することで、scraper.jsの信頼性と保守性を高めることができます。