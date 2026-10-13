import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const output = process.env.SPOT_VERIFY_OUT || 'output/design-verification';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const config of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'compact', width: 360, height: 640 },
    { name: 'reduced', width: 1440, height: 1000, reducedMotion: 'reduce' },
  ]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, reducedMotion: config.reducedMotion || 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SPOT_VERIFY_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    const skip = page.getByRole('button', { name: 'Saltar intro' });
    if (await skip.isVisible()) { await skip.click(); await expect(skip).toBeHidden(); }
    await page.screenshot({ path: `${output}/${config.name}-hero.png` });
    const sports = page.locator('#deportes');
    await sports.scrollIntoViewIfNeeded();
    await sports.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path: `${output}/${config.name}-sports.png` });
    if (config.name === 'desktop') {
      await page.getByRole('link', { name: 'Explorar ENTRENAMIENTO', exact: true }).click();
      await expect(page.locator('#calzado article')).toHaveCount(1);
      await expect(page.locator('#calzado article h3')).toHaveText('SPOT Pulso TR');
      await page.getByRole('button', { name: 'Todo', exact: true }).click();
      await expect(page.locator('#calzado article')).toHaveCount(4);
      await page.getByRole('link', { name: 'Explorar ENTRENAMIENTO', exact: true }).click();
      await expect(page.locator('#calzado article')).toHaveCount(1);
      await page.getByRole('button', { name: 'Todo', exact: true }).click();
    }
    const catalog = page.locator('#calzado');
    await catalog.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${config.name}-catalog.png` });
    const cards = page.locator('#calzado article, #indumentaria article');
    for (const card of await cards.all()) {
      const colors = card.getByRole('group', { name: /^Colores de/ }).getByRole('button');
      const first = colors.first();
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      await card.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      const before = await card.getByRole('img').screenshot();
      await colors.nth(1).click();
      await expect(colors.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(first).toHaveAttribute('aria-pressed', 'false');
      await expect(card.getByText('Vista de color conceptual')).toBeVisible();
      await page.mouse.move(0, 0);
      const after = await card.getByRole('img').screenshot();
      expect(before.equals(after)).toBe(false);
      await first.click();
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      await expect(card.locator('img')).toBeVisible();
    }
    const featured = page.getByRole('group', { name: 'Colores de la selección Órbita 01' });
    await featured.getByRole('button', { name: 'Color naranja' }).click();
    await expect(featured.getByRole('button', { name: 'Color naranja' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('section[aria-labelledby="seleccion-titulo"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${config.name}-color-selection.png` });
    await featured.getByRole('button', { name: 'Color marfil' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /3D/ })).toHaveCount(0);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.src),
    }));
    expect(state.overflow).toBe(false);
    expect(state.brokenImages).toEqual([]);
    expect(errors).toEqual([]);
    results.push({ name: config.name, ...state, errors, colorPreviews: 'passed', product3DRemoved: true });
    await context.close();
  }
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
