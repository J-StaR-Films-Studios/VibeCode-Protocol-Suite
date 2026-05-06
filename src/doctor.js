import pc from 'picocolors';
import { inspectPiHarnessEnvironment } from './pi-harness.js';
import { getStoreSkills, isStoreInitialized } from './store.js';

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
  console.log(status(report.installed.agentsInstalled, 'Installed agents dir', report.installed.targets.agents));
  console.log(status(report.installed.themesInstalled, 'Installed themes dir', report.installed.targets.themes));
  console.log(status(report.piSubagents.declaredVersion !== null, 'pi-subagents dependency declared', report.piSubagents.declaredVersion || 'missing'));
  console.log(status(report.piSubagents.localInstalled || report.piSubagents.globalInstalled, 'pi-subagents package available', report.piSubagents.localInstalled
    ? `${report.piSubagents.localPackageJson}${report.piSubagents.localVersion ? ` (${report.piSubagents.localVersion})` : ''}`
    : report.piSubagents.globalInstalled
      ? `${report.piSubagents.globalPackageJson}${report.piSubagents.globalVersion ? ` (${report.piSubagents.globalVersion})` : ''}`
      : 'missing'));
  console.log(status(report.piSubagents.binaryInstalled, 'pi-subagents installer binary', report.piSubagents.binaryPath || 'missing'));
  console.log(status(report.installed.routingPolicyPresent || report.project.routingPolicyPresent, 'Routing policy', report.project.routingPolicyPresent ? report.project.targets.routingPolicy : report.installed.targets.routingPolicy));
  console.log(status(storeReady, 'Global Takomi store', storeReady ? `${storeSkills.length} skills` : 'missing'));

  console.log(pc.cyan('\nRecommendations\n'));

  if (!report.pi.installed) {
    console.log(pc.white('  - Install Pi first: npm install -g @mariozechner/pi-coding-agent'));
  }

  if (!report.bundled.packageIncluded) {
    console.log(pc.white('  - Package .pi assets before enabling takomi install pi in releases.'));
  }

  if (!report.installed.runtimeInstalled || !report.installed.subagentsInstalled) {
    console.log(pc.white('  - Run takomi install pi after the package-safe Pi asset layout is finalized.'));
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

  if (!storeReady) {
    console.log(pc.white('  - Legacy global command center is not initialized. Run takomi install for current behavior.'));
  }

  console.log('');
  return report;
}
