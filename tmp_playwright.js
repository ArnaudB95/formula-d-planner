const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://tabletop-calendar.preview.emergentagent.com/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'tmp_dashboard.png', fullPage: true });
  const content = await page.content();
  fs.writeFileSync('tmp_dashboard_rendered.html', content, 'utf8');
  console.log('done');
  await browser.close();
})();
