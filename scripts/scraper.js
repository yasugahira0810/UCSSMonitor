const puppeteer = require('puppeteer');
const fs = require('fs');

const SELECTORS = {
  email: '#inputEmail',
  password: '#inputPassword',
  loginButton: '#login',
  serviceDetailsLink: '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button',
  remainingData: '#traffic-header > p.free-traffic > span.traffic-number',
  loginFailureMessage: 'body > div.app-main > div.main-body > div > div > div > div > div > div',
};

async function logErrorDetails(page, errorMessage) {
  const currentUrl = page.url();
  const failureData = {
    date: new Date().toISOString(),
    status: 'エラー',
    error: errorMessage,
    url: currentUrl
  };
  fs.writeFileSync('error_details.json', JSON.stringify(failureData, null, 2));
}

async function isLoggedIn(page) {
  try {
    await page.waitForSelector(SELECTORS.serviceDetailsLink, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function login(page, email, password) {
  try {
    await page.goto('https://my.undercurrentss.biz/index.php?rp=/login');
    await page.waitForSelector(SELECTORS.email, { timeout: 5000 });
    await page.waitForSelector(SELECTORS.password, { timeout: 5000 });
    await page.waitForSelector(SELECTORS.loginButton, { timeout: 5000 });

    if (!email || !password) {
      throw new Error('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
    }

    await page.type(SELECTORS.email, email);
    await page.type(SELECTORS.password, password);
    await page.click(SELECTORS.loginButton);
    await page.waitForNavigation({ timeout: 10000 });

    const errorMessageElement = await page.$(SELECTORS.loginFailureMessage);
    if (errorMessageElement) {
      const errorMessageText = await page.evaluate(el => el.innerText, errorMessageElement);
      if (errorMessageText.includes('ログイン失敗') || errorMessageText.includes('エラー')) {
        throw new Error(`ログイン失敗: ${errorMessageText}`);
      }
    }

    if (!(await isLoggedIn(page))) {
      throw new Error('ログイン後のページに必要な要素が見つかりません');
    }
  } catch (error) {
    await logErrorDetails(page, error.message);
    throw error;
  }
}

async function waitForPostLoginText(page) {
  try {
    await page.waitForSelector(SELECTORS.serviceDetailsLink, { timeout: 10000 });
  } catch (error) {
    await logErrorDetails(page, '「サービスの詳細」ページへのリンクが見つかりません');
    throw error;
  }
}

async function logRemainingData(page) {
  try {
    await page.click(SELECTORS.serviceDetailsLink);
    await page.waitForSelector(SELECTORS.remainingData, { timeout: 10000 });
    const remainingData = await page.$eval(SELECTORS.remainingData, el => el.innerText);
    console.log(remainingData); // Output only the remainingData value for GitHub Actions
    console.log(`::set-output name=remainingData::${remainingData}`); // Add GitHub Actions output format
  } catch (error) {
    await logErrorDetails(page, '残りデータ通信量の取得に失敗しました');
    throw error;
  }
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  try {
    const email = process.env.UCSS_EMAIL;
    const password = process.env.UCSS_PASSWORD;

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

process.on('unhandledRejection', (reason, promise) => {
  process.exit(1);
});
