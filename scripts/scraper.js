import puppeteer from 'puppeteer';
import fs from 'fs';

const SELECTORS = {
  emailInput: '#inputEmail',
  passwordInput: '#inputPassword',
  loginButton: '#login',
  serviceDetailsButton: '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button',
  remainingDataText: '#traffic-header > p.free-traffic > span.traffic-number',
  loginErrorMessage: 'body > div.app-main > div.main-body > div > div > div > div > div > div',
};

export const logErrorDetails = async (page, errorMessage) => {
  const currentUrl = page.url();
  const failureData = {
    date: new Date().toISOString(),
    status: 'エラー',
    error: errorMessage,
    url: currentUrl,
  };
  fs.writeFileSync('error_details.json', JSON.stringify(failureData, null, 2));
};

export const isLoggedIn = async (page) => {
  try {
    await page.waitForSelector(SELECTORS.serviceDetailsButton, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

export const login = async (page, email, password) => {
  try {
    await page.goto('https://my.undercurrentss.biz/index.php?rp=/login');
    await page.waitForSelector(SELECTORS.emailInput, { timeout: 5000 });
    await page.waitForSelector(SELECTORS.passwordInput, { timeout: 5000 });
    await page.waitForSelector(SELECTORS.loginButton, { timeout: 5000 });

    if (!email || !password) {
      throw new Error('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    }

    await page.type(SELECTORS.emailInput, email);
    await page.type(SELECTORS.passwordInput, password);
    await page.click(SELECTORS.loginButton);
    await page.waitForNavigation({ timeout: 10000 });

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

    const currentUrl = page.url();
    console.log(`ログイン成功: ${currentUrl}`);
  } catch (error) {
    await logErrorDetails(page, error.message);
    throw error;
  }
};

export const waitForPostLoginText = async (page) => {
  try {
    await page.waitForSelector(SELECTORS.serviceDetailsButton, { timeout: 10000 });
  } catch (error) {
    await logErrorDetails(page, '「サービスの詳細」ページへのリンクが見つかりません');
    throw error;
  }
};

export const logRemainingData = async (page) => {
  try {
    await page.click(SELECTORS.serviceDetailsButton);
    await page.waitForSelector(SELECTORS.remainingDataText, { timeout: 10000 });
    const remainingData = await page.$eval(SELECTORS.remainingDataText, el => el.innerText);
    
    // GitHub Actionsで安全に処理できるよう、値を出力する前に明示的に文字列としてフォーマット
    console.log(`remaining_data:${remainingData.trim()}`);
  } catch (error) {
    await logErrorDetails(page, '残りデータ通信量の取得に失敗しました');
    throw error;
  }
};

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

process.on('unhandledRejection', () => {
  process.exit(1);
});
