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

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  try {
    await page.goto('https://my.undercurrentss.biz/index.php?rp=/login');

    await page.type(emailSelector, process.env.UCSS_EMAIL);
    await page.type(passwordSelector, process.env.UCSS_PASSWORD);
    await page.click('#login');

    await page.waitForNavigation();

    // Log the HTML of the page after login for debugging
    const pageContent = await page.content();
    console.log('ログイン後のページHTML:', pageContent);

    // Check if login was successful
    if (await isLoggedIn(page)) {
      console.log('ログイン成功');

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
      const currentUrl = page.url();
      console.error('ログイン失敗: ログイン後のページに必要な要素が見つかりません');
      console.error('失敗時のURL:', currentUrl);

      const failureData = {
        date: new Date().toISOString(),
        status: 'ログイン失敗',
        error: 'ログイン後のページに必要な要素が見つかりません',
        url: currentUrl
      };
      fs.writeFileSync('login_status.json', JSON.stringify(failureData, null, 2));

      console.log('ログイン失敗データ:', JSON.stringify(failureData, null, 2));
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