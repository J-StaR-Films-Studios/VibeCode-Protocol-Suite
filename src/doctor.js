import fs from 'fs-extra';
import path from 'path';
import pc from 'picocolors';
import { inspectPiHarnessEnvironment } from './pi-harness.js';
import { getStoreSkills, isStoreInitialized } from './store.js';
import { PI_MANIFEST_PATH } from './pi-installer.js';
import { SKILLS_MANIFEST_PATH, SKILLS_ROOT } from './skills-installer.js';

function status(ok, label, value) {
  const icon = ok ? pc.green('✔') : pc.yellow('✗');
  const suffix = value ? ` ${pc.dim(value)}` : '';
  return `  ${icon} ${label}${suffix}`;
}

export async function runDoctor({ version, cwd = process.cwd() } = {}) {
  const report = await inspectPiHarnessEnvironment(cwd);
  const storeReady = await isStoreInitialized();
  const storeSkills = storeReady ? await getStoreSkills() : [];

  console.log(pc.magenta('🩺 Takomi Doctor\n'));
  console.log(status(true, 'Takomi CLI', version || 'unknown'));
  console.log(status(report.pi.installed, 'Pi command', report.pi.installed ? `${report.pi.path}${report.pi.version ? ` (${report.pi.version})` : ''}` : 'missing'));
  console.log(status(report.bundled.packageReady, 'Bundled .pi assets', report.bundled.targets.root));
  console.log(status(report.bundled.checks.runtime, 'Bundled takomi-runtime', report.bundled.targets.runtime));
  console.log(status(report.bundled.checks.subagents, 'Bundled takomi-subagents', report.bundled.targets.subagents));
  console.log(status(report.bundled.packageIncluded, 'Package includes .pi assets', report.bundled.packageIncluded ? 'yes' : 'no'));
  console.log(status(report.installed.runtimeInstalled, 'Installed takomi-runtime', report.installed.targets.extensions));
  console.log(status(report.installed.subagentsInstalled, 'Installed takomi-subagents', report.installed.targets.extensions));
  console.log(status(await fs.pathExists(`${report.installed.targets.extensions}/oauth-router`), 'Installed oauth-router', `${report.installed.targets.extensions}`));
  console.log(status(report.installed.coreInstalled, 'Installed Takomi core', path.join(path.dirname(report.installed.targets.root), 'src', 'pi-takomi-core')));
  console.log(status(report.installed.piSubagentsModuleInstalled, 'Installed pi-subagents module', path.join(report.installed.targets.root, 'node_modules', 'pi-subagents')));
  console.log(status(report.installed.agentsInstalled, 'Installed agents dir', report.installed.targets.agents));
  console.log(status(report.installed.themesInstalled, 'Installed themes dir', report.installed.targets.themes));
  console.log(status(await fs.pathExists(PI_MANIFEST_PATH), 'Pi install manifest', PI_MANIFEST_PATH));
  console.log(status(report.piSubagents.declaredVersion !== null, 'pi-subagents dependency declared', report.piSubagents.declaredVersion || 'missing'));
  console.log(status(report.piSubagents.localInstalled || report.piSubagents.globalInstalled, 'pi-subagents package available', report.piSubagents.localInstalled
    ? `${report.piSubagents.localPackageJson}${report.piSubagents.localVersion ? ` (${report.piSubagents.localVersion})` : ''}`
    : report.piSubagents.globalInstalled
      ? `${report.piSubagents.globalPackageJson}${report.piSubagents.globalVersion ? ` (${report.piSubagents.globalVersion})` : ''}`
      : 'missing'));
  console.log(status(report.piSubagents.binaryInstalled, 'pi-subagents installer binary', report.piSubagents.binaryPath || 'missing'));
  console.log(status(report.installed.routingPolicyPresent || report.project.routingPolicyPresent, 'Routing policy', report.project.routingPolicyPresent ? report.project.targets.routingPolicy : report.installed.targets.routingPolicy));
  console.log(status(await fs.pathExists(SKILLS_ROOT), 'Installed skills root', SKILLS_ROOT));
  console.log(status(await fs.pathExists(SKILLS_MANIFEST_PATH), 'Skills install manifest', SKILLS_MANIFEST_PATH));
  console.log(status(storeReady, 'Global Takomi store', storeReady ? `${storeSkills.length} skills` : 'missing'));

  console.log(pc.cyan('\nRecommendations\n'));

  if (!report.pi.installed) {
    console.log(pc.white('  - Install Pi first: npm install -g @mariozechner/pi-coding-agent'));
  }

  if (!report.bundled.packageIncluded) {
    console.log(pc.white('  - Package .pi assets before enabling takomi install pi in releases.'));
  }

  if (!report.installed.runtimeInstalled || !report.installed.subagentsInstalled || !report.installed.coreInstalled || !report.installed.piSubagentsModuleInstalled) {
    console.log(pc.white('  - Run takomi install pi to refresh the Pi harness, Takomi core, and pi-subagents runtime module.'));
  }

  if (!report.piSubagents.declaredVersion) {
    console.log(pc.white('  - Add pi-subagents to takomi package dependencies so subagent support is bundled intentionally.'));
  }

  if (!report.piSubagents.localInstalled && !report.piSubagents.globalInstalled) {
    console.log(pc.white('  - Install pi-subagents: npm install -g pi-subagents'));
  }

  if (!report.project.routingPolicyPresent && !report.installed.routingPolicyPresent) {
    console.log(pc.white('  - Add a routing policy at .pi/takomi/model-routing.md when ready.'));
  }

  if (!await fs.pathExists(PI_MANIFEST_PATH) && report.installed.runtimeInstalled) {
    console.log(pc.white('  - Re-run takomi install pi to write the Pi asset manifest.'));
  }

  if (!await fs.pathExists(SKILLS_ROOT)) {
    console.log(pc.white('  - Run takomi install skills to install the bundled Takomi skills.'));
  }

  if (!storeReady) {
    console.log(pc.white('  - Legacy global command center is not initialized. Run takomi install for current behavior.'));
  }

  console.log('');
  return report;
}
