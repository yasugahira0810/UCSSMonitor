const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto('https://my.undercurrentss.biz/index.php?rp=/login');

    await page.type('#email', process.env.UCSS_EMAIL);
    await page.type('#password', process.env.UCSS_PASSWORD);
    await page.click('#login');

    await page.waitForNavigation();

    console.log('ログイン成功');

    await page.goto('https://my.undercurrentss.biz/clientarea.php');

    const remainingData = await page.evaluate(() => {
      return document.querySelector('#remainingData').innerText;
    });

    const data = {
      date: new Date().toISOString(),
      remainingData: parseFloat(remainingData)
    };

    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('ログイン失敗:', error);
  } finally {
    await browser.close();
  }
})();