import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Render the actual HTML/CSS composition without its UI; no product pixels are
// repainted, and the site itself is not modified by this export.
const output = 'output/spot-hero';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await page.goto(process.env.SPOT_VERIFY_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => image.closest('section[aria-label="Portada"]')).map(image => image.decode()));
    const hero = document.querySelector('section[aria-label="Portada"]');
    const classContaining = (element, value) => String(element.className).includes(value);
    for (const child of [...hero.children]) {
      if (!['atmosphere', 'orbit', 'stage'].some(value => classContaining(child, value))) child.remove();
    }
    document.body.append(hero);
    for (const child of [...document.body.children]) if (child !== hero) child.remove();
    Object.assign(document.body.style, { margin: '0', overflow: 'hidden' });
    Object.assign(hero.style, { width: '1920px', height: '1080px', minHeight: '1080px', padding: '0' });
    const stage = [...hero.children].find(child => classContaining(child, 'stage'));
    Object.assign(stage.style, { height: '1050px', top: '-10px', left: '30%', right: '-2%' });
    const orbit = [...hero.children].find(child => classContaining(child, 'orbit'));
    Object.assign(orbit.style, { top: '25%', left: '34%', width: '64%', height: '45%' });
    window.scrollTo(0, 0);
  });
  if ((await page.locator('body').innerText()).trim()) throw new Error('La exportación todavía contiene texto.');
  await page.screenshot({ path: `${output}/spot-inicio-sin-texto-4k.png` });
  console.log(`${output}/spot-inicio-sin-texto-4k.png — 3840 × 2160`);
} finally { await browser.close(); }
