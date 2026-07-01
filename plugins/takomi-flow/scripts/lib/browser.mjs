import path from 'node:path';
import { ensureDir } from './paths.mjs';
import { loadPlaywright } from './playwright-loader.mjs';

export async function launchFlowBrowser(options = {}) {
  const { chromium } = await loadPlaywright();
  const profileDir = ensureDir(path.resolve(options.profileDir));
  const downloadsDir = ensureDir(path.resolve(options.downloadsDir));
  const headless = options.headless === true;
  if (options.cdpUrl) {
    const browser = await chromium.connectOverCDP(options.cdpUrl);
    const context = browser.contexts()[0] || await browser.newContext({ acceptDownloads: true });
    const page = context.pages()[0] || await context.newPage();
    return { browser, context, page, profileDir, downloadsDir, cdpUrl: options.cdpUrl, attached: true };
  }
  const channel = options.browserChannel || process.env.TAKOMI_FLOW_BROWSER_CHANNEL || defaultBrowserChannel();
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    ...(channel ? { channel } : {}),
    acceptDownloads: true,
    downloadsPath: downloadsDir,
    viewport: { width: 1440, height: 960 },
  });
  const page = context.pages()[0] || await context.newPage();
  return { context, page, profileDir, downloadsDir, browserChannel: channel };
}

export async function closeFlowBrowser(browser) {
  if (browser.attached) {
    await browser.browser?.close?.().catch(() => {});
    return;
  }
  await browser.context.close().catch(() => {});
}

function defaultBrowserChannel() {
  if (process.platform === 'win32' || process.platform === 'darwin') return 'chrome';
  return undefined;
}
