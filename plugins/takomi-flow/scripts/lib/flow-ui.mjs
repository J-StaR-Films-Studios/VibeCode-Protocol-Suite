import path from 'node:path';
import fs from 'node:fs';
import { FLOW_URL } from './paths.mjs';

export async function openFlow(page) {
  await page.goto(FLOW_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

export async function capture(page, run, name) {
  const filePath = path.join(run.screenshotsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
  return filePath;
}

export async function inspectFlowState(page) {
  const title = await page.title().catch(() => '');
  const url = page.url();
  const text = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 5000);
  const lower = text.toLowerCase();
  const manualActions = [];
  if (lower.includes('sign in') || lower.includes('log in')) {
    manualActions.push('Sign into Google/Flow in the opened browser.');
  }
  if (lower.includes('captcha') || lower.includes('verify')) {
    manualActions.push('Complete the verification challenge in the browser.');
  }
  if (lower.includes('quota') || lower.includes('limit') || lower.includes('credits')) {
    manualActions.push('Review Flow quota or credits message in the browser.');
  }
  return { title, url, manualActions, textSample: text };
}

export async function ensureProjectEditor(page) {
  if (page.url().includes('/project/')) return waitForProjectEditor(page);
  const candidates = [
    page.getByRole('button', { name: /new project/i }).first(),
    page.locator('button').filter({ hasText: /new project/i }).first(),
    page.getByText('New project').first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000 });
      await page.waitForURL(/\/project\//, { timeout: 30000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      return page.url().includes('/project/') && await waitForProjectEditor(page);
    } catch {}
  }
  return false;
}

async function waitForProjectEditor(page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const ready = page.locator('body').filter({ hasText: /what do you want to create|start creating|add media/i });
  await ready.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  return (await page.locator('div[role="textbox"], textarea:not(.g-recaptcha-response)').count().catch(() => 0)) > 0;
}

export async function fillPrompt(page, prompt) {
  const candidates = [
    page.locator('div[role="textbox"]').filter({ hasText: /what do you want to create/i }).last(),
    page.locator('div[role="textbox"]').last(),
    page.locator('textarea:not(.g-recaptcha-response):not([name*="recaptcha"])').last(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 8000 });
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
      await page.keyboard.type(prompt, { delay: 2 });
      const matched = await page.locator('body').filter({ hasText: prompt.slice(0, 40) }).count().catch(() => 0);
      if (matched) return true;
    } catch {}
  }
  return false;
}

export async function submitGeneration(page) {
  const preferred = [
    page.locator('button').filter({ hasText: /arrow_forward\s*Create/i }).last(),
    page.getByRole('button', { name: /^Create$/i }).last(),
    page.locator('button').filter({ hasText: /^Create$/i }).last(),
  ];
  for (const button of preferred) {
    if (!(await button.count().catch(() => 0))) continue;
    try {
      await button.click({ timeout: 8000 });
      return true;
    } catch {}
  }
  const labels = /submit|start/i;
  const buttons = [
    page.getByRole('button', { name: labels }).first(),
    page.locator('button').filter({ hasText: labels }).first(),
  ];
  for (const button of buttons) {
    if (!(await button.count().catch(() => 0))) continue;
    try {
      await button.click({ timeout: 8000 });
      return true;
    } catch {}
  }
  return false;
}

export async function tryDownloadAssets(page, run, maxDownloads = 1) {
  const assets = [];
  await openGeneratedMedia(page);
  for (let i = 0; i < maxDownloads; i += 1) {
    const button = page.locator('button').filter({ hasText: /download\s*Download|download/i }).first();
    if (!(await button.count().catch(() => 0))) break;
    const [completed] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
      button.click({ timeout: 5000 }).catch(() => null),
    ]);
    if (!completed) {
      const imagePath = await downloadLargestRenderedImage(page, run, i).catch(() => null);
      if (!imagePath) break;
      assets.push(imagePath);
      continue;
    }
    const suggested = completed.suggestedFilename();
    const filePath = path.join(run.downloadsDir, suggested);
    await completed.saveAs(filePath);
    assets.push(filePath);
  }
  return assets;
}

async function downloadLargestRenderedImage(page, run, index) {
  const images = await page.locator('img').evaluateAll(items => items
    .map(img => ({ src: img.src, width: img.naturalWidth, height: img.naturalHeight }))
    .filter(item => item.src && item.width >= 256 && item.height >= 256)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height)));
  if (!images.length) return null;
  const response = await page.context().request.get(images[0].src, { timeout: 30000 });
  if (!response.ok()) return null;
  const filePath = path.join(run.downloadsDir, `flow-image-${index + 1}.png`);
  fs.writeFileSync(filePath, await response.body());
  return filePath;
}

export async function openGeneratedMedia(page) {
  if (await page.locator('button').filter({ hasText: /download\s*Download/i }).count().catch(() => 0)) return true;
  const candidates = [
    page.getByAltText(/video thumbnail|generated image/i).first(),
    page.locator('img[src*="media.getMediaUrlRedirect"]').last(),
    page.locator('[role="button"]').filter({ hasText: /play_circle/i }).first(),
    page.locator('button').filter({ hasText: /play_circle/i }).first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000 });
      await page.waitForTimeout(3000);
      return true;
    } catch {}
  }
  return false;
}

export async function hasText(page, pattern) {
  return (await page.locator('body').filter({ hasText: pattern }).count().catch(() => 0)) > 0;
}
