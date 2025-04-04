import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

// .envファイルから環境変数を読み込む
dotenv.config();

// Constants
const SELECTORS = {
  emailInput: '#inputEmail',
  passwordInput: '#inputPassword',
  loginButton: '#login',
  serviceDetailsButton: '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button',
  remainingDataText: '#traffic-header > p.free-traffic > span.traffic-number',
  loginErrorMessage: 'body > div.app-main > div.main-body > div > div > div > div > div > div'
};

const TIMEOUT = {
  short: 5000,
  medium: 10000
};

const URLS = {
  login: 'https://my.undercurrentss.biz/index.php?rp=/login'
};

/**
 * Logs error details to a file
 */
export const logErrorDetails = async (page, errorMessage) => {
  const failureData = {
    date: new Date().toISOString(),
    status: 'エラー',
    error: errorMessage,
    url: page.url()
  };
  fs.writeFileSync('error_details.json', JSON.stringify(failureData, null, 2));
};

/**
 * Wait for a selector to be available on the page
 */
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

/**
 * Check if user is logged in
 */
export const isLoggedIn = async (page) => {
  return await waitForSelector(page, SELECTORS.serviceDetailsButton);
};

/**
 * Log in to the service
 */
export const login = async (page, email, password) => {
  try {
    if (!email || !password) {
      throw new Error('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    }

    await page.goto(URLS.login);
    
    await waitForSelector(page, SELECTORS.emailInput, TIMEOUT.short, 'メールアドレス入力フィールドが見つかりません');
    await waitForSelector(page, SELECTORS.passwordInput, TIMEOUT.short, 'パスワード入力フィールドが見つかりません');
    await waitForSelector(page, SELECTORS.loginButton, TIMEOUT.short, 'ログインボタンが見つかりません');
    
    await page.type(SELECTORS.emailInput, email);
    await page.type(SELECTORS.passwordInput, password);
    await page.click(SELECTORS.loginButton);
    await page.waitForNavigation({ timeout: TIMEOUT.medium });
    
    // Check for login errors
    const errorMessageElement = await page.$(SELECTORS.loginErrorMessage);
    if (errorMessageElement) {
      const errorMessageText = await page.evaluate(el => el.innerText, errorMessageElement);
      if (errorMessageText.includes('ログイン失敗') || errorMessageText.includes('エラー')) {
        throw new Error(`ログイン失敗: ${errorMessageText}`);
      }
    }
    
    if (!(await isLoggedIn(page))) {
      throw new Error('ログイン後のページに必要な要素が見つかりません');
    }
    
    console.log(`ログイン成功: ${page.url()}`);
  } catch (error) {
    await logErrorDetails(page, error.message);
    throw error;
  }
};

/**
 * Wait for post-login page elements to load
 */
export const waitForPostLoginElements = async (page) => {
  await waitForSelector(
    page, 
    SELECTORS.serviceDetailsButton, 
    TIMEOUT.medium, 
    '「サービスの詳細」ページへのリンクが見つかりません'
  );
};

/**
 * Extract and log the remaining data
 */
export const getRemainingData = async (page) => {
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
    return remainingData.trim();
  } catch (error) {
    await logErrorDetails(page, '残りデータ通信量の取得に失敗しました');
    throw error;
  }
};

/**
 * Main execution function
 */
async function main() {
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  
  try {
    const { UCSS_EMAIL: email, UCSS_PASSWORD: password } = process.env;
    
    if (!email || !password) {
      throw new Error('GitHub Actions Secrets UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    }
    
    await login(page, email, password);
    await waitForPostLoginElements(page);
    await getRemainingData(page);
  } catch (error) {
    console.error('エラー:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

// Start the application
main();

// Catch unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('未処理のPromise拒否:', error);
  process.exit(1);
});
