import puppeteer from 'puppeteer';
import fs from 'fs';

// 定数定義をグループ化
const SELECTORS = {
  emailInput: '#inputEmail',
  passwordInput: '#inputPassword',
  loginButton: '#login',
  serviceDetailsButton: '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button',
  remainingDataText: '#traffic-header > p.free-traffic > span.traffic-number',
  loginErrorMessage: 'body > div.app-main > div.main-body > div > div > div > div > div > div',
};

const TIMEOUT = {
  short: 5000,
  medium: 10000
};

const URLS = {
  login: 'https://my.undercurrentss.biz/index.php?rp=/login'
};

// ユーティリティ関数
export const logErrorDetails = async (page, errorMessage) => {
  const failureData = {
    date: new Date().toISOString(),
    status: 'エラー',
    error: errorMessage,
    url: page.url(),
  };
  fs.writeFileSync('error_details.json', JSON.stringify(failureData, null, 2));
};

// セレクタが存在するか確認するヘルパー関数
const waitForSelector = async (page, selector, timeoutMs = TIMEOUT.short, errorMessage) => {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
    return true;
  } catch (error) {
    if (errorMessage) {
      await logErrorDetails(page, errorMessage);
      throw new Error(errorMessage);
    }
    return false;
  }
};

export const isLoggedIn = async (page) => {
  return await waitForSelector(page, SELECTORS.serviceDetailsButton);
};

export const login = async (page, email, password) => {
  try {
    // 環境変数チェック
    if (!email || !password) {
      throw new Error('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    }

    // ログインページへ移動
    await page.goto(URLS.login);
    
    // 入力フォームの確認
    await waitForSelector(page, SELECTORS.emailInput, TIMEOUT.short, 'メールアドレス入力フィールドが見つかりません');
    await waitForSelector(page, SELECTORS.passwordInput, TIMEOUT.short, 'パスワード入力フィールドが見つかりません');
    await waitForSelector(page, SELECTORS.loginButton, TIMEOUT.short, 'ログインボタンが見つかりません');

    // ログイン情報入力
    await page.type(SELECTORS.emailInput, email);
    await page.type(SELECTORS.passwordInput, password);
    await page.click(SELECTORS.loginButton);
    await page.waitForNavigation({ timeout: TIMEOUT.medium });

    // ログインエラーチェック
    const errorMessageElement = await page.$(SELECTORS.loginErrorMessage);
    if (errorMessageElement) {
      const errorMessageText = await page.evaluate(el => el.innerText, errorMessageElement);
      if (errorMessageText.includes('ログイン失敗') || errorMessageText.includes('エラー')) {
        throw new Error(`ログイン失敗: ${errorMessageText}`);
      }
    }

    // ログイン成功の確認
    if (!(await isLoggedIn(page))) {
      throw new Error('ログイン後のページに必要な要素が見つかりません');
    }

    console.log(`ログイン成功: ${page.url()}`);
  } catch (error) {
    await logErrorDetails(page, error.message);
    throw error;
  }
};

export const waitForPostLoginText = async (page) => {
  await waitForSelector(
    page, 
    SELECTORS.serviceDetailsButton, 
    TIMEOUT.medium, 
    '「サービスの詳細」ページへのリンクが見つかりません'
  );
};

export const logRemainingData = async (page) => {
  try {
    await page.click(SELECTORS.serviceDetailsButton);
    await waitForSelector(
      page, 
      SELECTORS.remainingDataText, 
      TIMEOUT.medium, 
      '残りデータ通信量の要素が見つかりません'
    );
    
    const remainingData = await page.$eval(SELECTORS.remainingDataText, el => el.innerText);
    console.log(`remaining_data:${remainingData.trim()}`);
  } catch (error) {
    await logErrorDetails(page, '残りデータ通信量の取得に失敗しました');
    throw error;
  }
};

// メイン処理
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  try {
    const { UCSS_EMAIL: email, UCSS_PASSWORD: password } = process.env;
    
    if (!email || !password) {
      throw new Error('GitHub Actions Secrets UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    }
    
    await login(page, email, password);
    await waitForPostLoginText(page);
    await logRemainingData(page);
  } catch (error) {
    console.error('エラー:', error.message);
  } finally {
    await browser.close();
  }
})();

// 未処理のPromiseエラーを捕捉
process.on('unhandledRejection', () => {
  process.exit(1);
});
