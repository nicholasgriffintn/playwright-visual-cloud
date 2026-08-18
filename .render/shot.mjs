import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`file://${process.cwd()}/.render/review.html`);
await page.screenshot({ path: ".render/review-1440.png" });

const actions = await page.locator(".review-actions").boundingBox();
const buttons = await page.locator(".review-actions .button").all();
const boxes = await Promise.all(buttons.map((b) => b.boundingBox()));

console.log("sidebar buttons:");
for (const [i, box] of boxes.entries()) {
  console.log(`  ${i}: x=${box.x.toFixed(0)} w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`);
}
console.log("container width:", actions.width.toFixed(0));

const toolbar = await page.locator(".viewer-actions").boundingBox();
const controls = await page.locator(".viewer-actions > *").all();
const cboxes = await Promise.all(controls.map((c) => c.boundingBox()));

console.log("toolbar controls:");
for (const [i, box] of cboxes.entries()) {
  console.log(`  ${i}: y=${box.y.toFixed(0)} h=${box.height.toFixed(0)} w=${box.width.toFixed(0)}`);
}
console.log("toolbar right edge:", (toolbar.x + toolbar.width).toFixed(0));

const header = await page.locator(".viewer-header").boundingBox();
console.log("header right edge:", (header.x + header.width).toFixed(0));

await browser.close();
