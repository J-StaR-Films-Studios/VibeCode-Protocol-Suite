import path from 'node:path';
import { defaultProfileDir, FLOW_URL, readJson, resolvePath } from './paths.mjs';
import { normalizeRequest, canSpend } from './request.mjs';
import { closeFlowBrowser, launchFlowBrowser } from './browser.mjs';
import { createRun, baseResult, saveResult } from './result.mjs';
import { capture, ensureProjectEditor, fillPrompt, inspectFlowState, openFlow, submitGeneration, tryDownloadAssets } from './flow-ui.mjs';
import { handleGenerationFollowups, waitForGenerationOutcome } from './flow-outcome.mjs';
import { catalogAssets } from './media.mjs';
import { createSettingsPlan } from './settings-plan.mjs';

export async function generateFromRequest(args = {}) {
  if (!args.request) throw new Error('generate requires a request path.');
  const request = normalizeRequest(readJson(path.resolve(args.request)));
  const run = createRun(request, 'generate');
  const result = baseResult('blocked', run, {
    command: 'generate',
    kind: request.kind,
    prompt: request.prompt,
    flowUrl: FLOW_URL,
    settingsPlan: createSettingsPlan(request),
  });
  if (!canSpend(request)) {
    result.manualActions.push('Set request allowSpend=true or TAKOMI_FLOW_ALLOW_SPEND=true to submit a Flow generation.');
    saveResult(run, result);
    return result;
  }
  const browser = await launchFlowBrowser({
    profileDir: resolvePath(args.profileDir, defaultProfileDir()),
    downloadsDir: run.downloadsDir,
    browserChannel: args.browserChannel,
    cdpUrl: args.cdpUrl,
    headless: Boolean(args.headless),
  });
  try {
    await openFlow(browser.page);
    result.screenshots.push(await capture(browser.page, run, 'before-prompt'));
    const state = await inspectFlowState(browser.page);
    if (state.manualActions.length) {
      requireManual(result, state.manualActions);
      return result;
    }
    if (!(await ensureProjectEditor(browser.page))) {
      requireManual(result, ['New project button or project editor was not found. Open a Flow project manually, then retry with --cdp-url.']);
      return result;
    }
    result.projectUrl = browser.page.url();
    result.screenshots.push(await capture(browser.page, run, 'project-editor'));
    if (!(await fillPrompt(browser.page, request.prompt))) {
      requireManual(result, ['Prompt box was not found. Update Flow selectors or paste the prompt manually.']);
      return result;
    }
    result.screenshots.push(await capture(browser.page, run, 'prompt-filled'));
    if (!(await submitGeneration(browser.page))) {
      requireManual(result, ['Generate/Create button was not found. Submit manually in the opened browser.']);
      return result;
    }
    result.projectUrl = browser.page.url();
    await handleGenerationFollowups(browser.page, request);
    result.generationOutcome = await waitForGenerationOutcome(browser.page, request);
    result.projectUrl = browser.page.url();
    result.screenshots.push(await capture(browser.page, run, 'after-wait'));
    result.assets = await tryDownloadAssets(browser.page, run, request.variations);
    if (result.assets.length) {
      result.assetCatalogPath = (await catalogAssets(run, result.assets, { frames: request.extractFrames || 0 })).catalogPath;
    }
    result.status = result.assets.length ? 'downloaded' : 'manual_action_required';
    if (!result.assets.length) {
      result.manualActions.push(nextActionForOutcome(result.generationOutcome));
    }
    return result;
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
    return result;
  } finally {
    await closeFlowBrowser(browser);
    saveResult(run, result);
  }
}

function requireManual(result, actions) {
  result.status = 'manual_action_required';
  result.manualActions.push(...actions);
}

function nextActionForOutcome(outcome = {}) {
  if (outcome.status === 'failed') return 'Flow reported generation failure. Inspect the browser/run screenshots.';
  if (outcome.status === 'timeout') return 'Generation did not finish before the wait timeout. Leave trusted Chrome open and run inspect/observe again.';
  return 'Generation may still be running or download controls changed. Inspect the browser/run screenshots.';
}
