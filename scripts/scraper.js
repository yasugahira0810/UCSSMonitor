const puppeteer = require('puppeteer');
const fs = require('fs');

// Update the scraper.js file to include the CSS selectors for email and password input fields
const emailSelector = '#inputEmail';
const passwordSelector = '#inputPassword';

// Update the scraper.js file to use CSS selector for the service details link
const serviceDetailsLinkSelector = '#ClientAreaHomePagePanels-Active_Products_Services-0 > div > div.panel-footer > button';
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

    // Wait for the service details link to appear and ensure it is interactable
    await page.waitForSelector(serviceDetailsLinkSelector, { visible: true });
    const serviceDetailsButton = await page.$(serviceDetailsLinkSelector);
    if (serviceDetailsButton) {
      // Ensure the button is interactable
      const isDisabled = await page.evaluate(button => button.disabled, serviceDetailsButton);
      if (!isDisabled) {
        await serviceDetailsButton.click();
        // Wait for navigation to complete by checking for a specific element on the next page
        await page.waitForSelector(remainingDataSelector, { timeout: 10000 });
      } else {
        throw new Error('Service Details button is disabled');
      }
    } else {
      throw new Error('Service Details button not found');
    }

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