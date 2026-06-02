/**
 * Root ProjX — App Store Screenshot Generator
 * Renders mockup-sandbox HTML components at 1290×2796px via Puppeteer
 */
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../../artifacts/web/public/screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const W = 1290;
const H = 2796;

const BASE_URL = "http://localhost:80/__mockup/preview/screenshots";

const SCREENSHOTS = [
  { name: "Screenshot1", file: "screenshot_1.png" },
  { name: "Screenshot2", file: "screenshot_2.png" },
  { name: "Screenshot3", file: "screenshot_3.png" },
  { name: "Screenshot4", file: "screenshot_4.png" },
  { name: "Screenshot5", file: "screenshot_5.png" },
  { name: "Screenshot6", file: "screenshot_6.png" },
];

(async () => {
  console.log("Launching Chromium…");
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
    headless: true,
  });

  try {
    for (const ss of SCREENSHOTS) {
      const url = `${BASE_URL}/${ss.name}`;
      console.log(`  Rendering ${ss.name}…`);

      const page = await browser.newPage();
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

      // Wait for fonts and layout to settle
      await new Promise(r => setTimeout(r, 800));

      const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
      const outPath = join(OUT_DIR, ss.file);
      writeFileSync(outPath, buf);
      const kb = (buf.length / 1024).toFixed(0);
      console.log(`  ✓ ${ss.file}  (${kb} KB)`);

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\nAll 6 screenshots saved to:\n  ${OUT_DIR}`);
})();
