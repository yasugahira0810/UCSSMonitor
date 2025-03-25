const puppeteer = require('puppeteer');
const fs = require('fs');

// Update the scraper.js file to include the CSS selectors for email and password input fields
const emailSelector = '#inputEmail';
const passwordSelector = '#inputPassword';

// Add navigation to the "Service Details" page and extract remaining data
const serviceDetailsLinkSelector = '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.list-group-item-actions > button';
const remainingDataSelector = '#traffic-header > p.free-traffic > span.traffic-number';

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

    console.log('ログイン成功');

    // Log the current page URL after login
    const currentUrl = page.url();
    console.log('ログイン後のURL:', currentUrl);

    // Record login success
    const successData = {
      date: new Date().toISOString(),
      status: 'ログイン成功',
      url: currentUrl
    };
    fs.writeFileSync('login_status.json', JSON.stringify(successData, null, 2));

    console.log('ログイン成功データ:', JSON.stringify(successData, null, 2));

    await page.goto('https://my.undercurrentss.biz/clientarea.php');

    // Wait for the service details link to appear
    await page.waitForSelector(serviceDetailsLinkSelector);
    await page.click(serviceDetailsLinkSelector);
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
  } catch (error) {
    console.error('ログイン失敗:', error);

    // Record login failure
    const failureData = {
      date: new Date().toISOString(),
      status: 'ログイン失敗',
      error: error.message
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