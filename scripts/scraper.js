const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://ucss.example.com/login');

  await page.type('#email', process.env.UCSS_EMAIL);
  await page.type('#password', process.env.UCSS_PASSWORD);
  await page.click('#loginButton');

  await page.waitForNavigation();
  await page.goto('https://ucss.example.com/service-details');

  const remainingData = await page.evaluate(() => {
    return document.querySelector('#remainingData').innerText;
  });

  const data = {
    date: new Date().toISOString(),
    remainingData: parseFloat(remainingData)
  };

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

  await browser.close();
})();