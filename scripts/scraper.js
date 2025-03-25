const puppeteer = require('puppeteer');
const fs = require('fs');

// Update the scraper.js file to include the CSS selectors for email and password input fields
const emailSelector = '#inputEmail';
const passwordSelector = '#inputPassword';

// Update the CSS selector for the service details button click
const serviceDetailsLinkSelector = '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button';
const remainingDataSelector = '#traffic-header > p.free-traffic > span.traffic-number';

// Function to check if login was successful
async function isLoggedIn(page) {
  try {
    // Check for a specific element that only appears when logged in
    await page.waitForSelector('#logoutButton', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to log detailed error information
async function logErrorDetails(page, errorMessage) {
  const currentUrl = page.url();
  console.error(errorMessage);
  console.error('現在のURL:', currentUrl);
  const failureData = {
    date: new Date().toISOString(),
    status: 'エラー',
    error: errorMessage,
    url: currentUrl
  };
  fs.writeFileSync('error_details.json', JSON.stringify(failureData, null, 2));
  console.log('エラーデータが記録されました:', JSON.stringify(failureData, null, 2));
}

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  try {
    await page.goto('https://my.undercurrentss.biz/index.php?rp=/login');

    // Verify the presence of login elements before proceeding
    try {
        await page.waitForSelector(emailSelector, { timeout: 5000 });
        await page.waitForSelector(passwordSelector, { timeout: 5000 });
        await page.waitForSelector('#login', { timeout: 5000 });
        console.log('ログインページの要素が確認されました');
    } catch (error) {
        await logErrorDetails(page, 'ログインページの要素が見つかりません');
        await browser.close();
        process.exit(1);
    }

    const email = process.env.UCSS_EMAIL;
    const password = process.env.UCSS_PASSWORD;

    // Update the email logging to include masking with character count
    if (email && password) {
        const maskedEmail = `${email[0]}***${email.slice(1, -1).replace(/./g, '*')}${email[email.length - 1]}`;
        console.log(`Email: ${maskedEmail} (length: ${email.length})`);
        console.log(`Password length: ${password.length}`);
    } else {
        console.error('環境変数 UCSS_EMAIL または UCSS_PASSWORD が設定されていません');
        await browser.close();
        process.exit(1);
    }

    await page.type(emailSelector, process.env.UCSS_EMAIL);
    await page.type(passwordSelector, process.env.UCSS_PASSWORD);
    await page.click('#login');

    try {
        await page.waitForNavigation({ timeout: 10000 });
    } catch (error) {
        await logErrorDetails(page, 'ログイン後のページへの遷移に失敗しました');
        await browser.close();
        process.exit(1);
    }

    // Check for login failure message
    const loginFailureSelector = 'body > div.app-main > div.main-body > div > div > div > div > div > div';

    // Update the login failure detection logic
    try {
        const errorMessageElement = await page.$(loginFailureSelector);
        if (errorMessageElement) {
            const errorMessageText = await page.evaluate(el => el.innerText, errorMessageElement);
            if (errorMessageText.includes('ログイン失敗') || errorMessageText.includes('エラー')) {
                await logErrorDetails(page, `ログイン失敗: エラーメッセージが表示されました - ${errorMessageText}`);
                await browser.close();
                process.exit(1);
            }
        }
    } catch (error) {
        console.error('ログイン失敗メッセージの検出中にエラーが発生しました:', error);
        await logErrorDetails(page, 'CSS セレクターの処理中にエラーが発生しました');
        await browser.close();
        process.exit(1);
    }

    // Log the URL and success message after successful login
    if (await isLoggedIn(page)) {
      console.log('ログイン成功');
      console.log('現在のURL:', page.url());

      // Wait for the specified element after login
      const postLoginSelector = '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button';
      try {
          await page.waitForSelector(postLoginSelector, { visible: true, timeout: 10000 });
          console.log('ログイン後の要素が確認されました');
      } catch (error) {
          // Log all elements on the page for debugging
          const allElements = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('*')).map(el => el.outerHTML);
          });
          console.log('ログイン後のページに存在する要素:', allElements);
          await logErrorDetails(page, 'ログイン後の要素が見つかりません');
          await browser.close();
          process.exit(1);
      }

      // Proceed with the rest of the script
      await page.waitForSelector(serviceDetailsLinkSelector, { visible: true });
      await page.evaluate((selector) => {
        document.querySelector(selector).click();
      }, serviceDetailsLinkSelector);

      await page.waitForNavigation();

      const remainingData = await page.evaluate((selector) => {
        return document.querySelector(selector).innerText;
      }, remainingDataSelector);

      console.log('残りデータ通信量:', remainingData);

      const data = {
        date: new Date().toISOString(),
        remainingData: parseFloat(remainingData)
      };

      fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

      console.log('データ取得成功:', JSON.stringify(data, null, 2));
    } else {
      await logErrorDetails(page, 'ログイン後のページに必要な要素が見つかりません');
      await browser.close();
      process.exit(1);
    }
  } catch (error) {
    const currentUrl = page.url();
    console.error('ログイン失敗:', error);
    console.error('失敗時のURL:', currentUrl);

    // Record login failure
    const failureData = {
      date: new Date().toISOString(),
      status: 'ログイン失敗',
      error: error.message,
      url: currentUrl
    };
    fs.writeFileSync('login_status.json', JSON.stringify(failureData, null, 2));

    console.log('ログイン失敗データ:', JSON.stringify(failureData, null, 2));
  } finally {
    await browser.close();
  }
})();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});