import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve from the root of the project so /dist/ and /test-images/ are accessible
const server = createServer({ root: path.join(__dirname, '..') });
server.listen(3000);

const browser = await chromium.launch();
const page = await browser.newPage();

// Capture actual browser console output, including console.time/timeEnd calls
page.on('console', msg => console.log('[BROWSER]', msg.text()));
page.on('pageerror', error => console.log('[BROWSER ERROR]', error.message));
page.on('requestfailed', request => console.log('[REQUEST FAILED]', request.url(), request.failure().errorText));

await page.goto('http://localhost:3000/browser-test/index.html', { waitUntil: 'networkidle' });
await page.waitForSelector('canvas#gameCanvas');

// Click roughly the center of the canvas
// The images are 1600x1200 (from 1920000 pixels calculation), but CSS might scale them.
// We'll click near the center of the canvas element itself.
// Wait for canvas to be visible and have size
await page.waitForSelector('canvas#gameCanvas');
const canvas = await page.$('canvas#gameCanvas');
const box = await canvas.boundingBox();
// Instead of calculating center once, we'll do it per image because size might change
console.log('Canvas bounding box:', JSON.stringify(box));

const testCases = [
  { name: 'Red', button: '#btn-red' },
  { name: 'Green', button: '#btn-green' },
  { name: 'Blue', button: '#btn-blue' },
];

for (const test of testCases) {
  console.log(`\n--- Testing ${test.name} image ---`);
  
  // Click the button to load the image
  await page.click(test.button);
  await page.waitForTimeout(500); // Wait for image load
  
  const start = Date.now();
  const currentBox = await canvas.boundingBox();
  const targetX = currentBox.x + currentBox.width / 2;
  const targetY = currentBox.y + currentBox.height / 2;
  console.log(`Dispatching click to center of canvas`);
  // Click the center of the canvas using dispatchEvent to ensure it's caught
  await page.evaluate(() => {
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const clickEvent = new MouseEvent('click', {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      view: window
    });
    canvas.dispatchEvent(clickEvent);
  });
  
  // Wait for the results to be updated
  console.log('Waiting for results...');
  await page.waitForTimeout(2000); // Give it plenty of time
  
  const resultsExist = await page.evaluate(() => {
    const results = document.getElementById('results');
    return results && results.innerText.includes('Extracted RGB');
  });
  
  if (!resultsExist) {
    console.log('Results still not found after 2s. Dumping DOM...');
    const body = await page.evaluate(() => document.body.innerHTML);
    console.log(body);
  }
  
  const elapsed = Date.now() - start;
  console.log(`Wall-clock time for click->result: ${elapsed}ms`);

  // Pull the actual displayed result values from the DOM
  const resultText = await page.evaluate(() => document.getElementById('results')?.innerText || 'NO RESULTS ELEMENT FOUND');
  console.log('Displayed result:\n', resultText);

  // Take a screenshot as visual proof
  await page.screenshot({ path: `browser-test/screenshot-${test.name.toLowerCase()}.png` });
}

await browser.close();
server.close();
console.log('\nAutomated browser test complete.');
