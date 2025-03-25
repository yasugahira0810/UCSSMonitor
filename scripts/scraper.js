const puppeteer = require('puppeteer');
const fs = require('fs');

// Update the scraper.js file to include the CSS selectors for email and password input fields
const emailSelector = '#inputEmail';
const passwordSelector = '#inputPassword';

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

    // Record login success
    const successData = {
      date: new Date().toISOString(),
      status: 'ログイン成功'
    };
    fs.writeFileSync('login_status.json', JSON.stringify(successData, null, 2));

    console.log('ログイン成功データ:', JSON.stringify(successData, null, 2));

    await page.goto('https://my.undercurrentss.biz/clientarea.php');

    const remainingData = await page.evaluate(() => {
      return document.querySelector('#remainingData').innerText;
    });

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