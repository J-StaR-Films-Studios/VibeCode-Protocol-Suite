import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import figlet from 'figlet';
import fs from 'fs-extra';
import path from 'path';
import {
  PATHS,
  getWorkflows,
  getSkills,
  copySpecificWorkflows,
  copySpecificSkills,
  copyAllWorkflows,
  copyAllSkills,
  copyAgentReadme,
  copyAgentYamls,
  copyLegacyManual,
  updateWorkflows,
  updateSkills,
  updateAgentYamls,
  updateLegacyManual,
  downloadDirectoryFromGitHub,
} from './utils.js';
import {
  detectHarnesses,
  printHarnessStatus,
  syncToAllHarnesses,
  syncToHarness,
} from './harness.js';
import {
  STORE_PATH,
  initGlobalStore,
  getManifest,
  writeManifest,
  populateSkills,
  populateWorkflows,
  populateAgentYamls,
  getStoreSkills,
  getStoreWorkflows,
  isStoreInitialized,
} from './store.js';

const program = new Command();

// ─────────────────────────────────────────────────────────────────────────────
// takomi init (EXISTING — Backward Compatible)
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  console.log(pc.magenta(figlet.textSync('Takomi', { horizontalLayout: 'full' })));
  console.log(pc.cyan('   Your AI team. Activated. 🚀\n'));

  const response = await prompts([
    {
      type: 'multiselect',
      name: 'components',
      message: 'What components do you want to spawn?',
      choices: [
        { title: '.agent Folder (Workflows & Skills)', value: 'agent', selected: true, description: 'Recommended for Cursor/Windsurf' },
        { title: 'Agent YAMLs', value: 'yamls', description: 'For Kilo Code / Deep Source' },
        { title: 'Legacy Manual Protocols', value: 'legacy', description: 'Browser-based prompts' }
      ],
      min: 1,
      hint: '- Space to select. Return to submit'
    },
    // Workflow Selection (Only if .agent is selected)
    {
      type: (prev, values) => values.components.includes('agent') ? 'select' : null,
      name: 'workflowMode',
      message: 'How should we install Workflows?',
      choices: [
        { title: 'Install Core Workflows (Recommended)', value: 'core' },
        { title: 'Install All Workflows', value: 'all' },
        { title: 'Install All (Exclude Legacy)', value: 'no-legacy' },
        { title: 'Select Specific Workflows', value: 'custom' }
      ]
    },
    {
      type: (prev, values) => values.workflowMode === 'custom' ? 'multiselect' : null,
      name: 'selectedWorkflows',
      message: 'Select workflows to install:',
      choices: async () => {
        const workflows = await getWorkflows();
        return workflows.map(w => ({ title: w, value: w }));
      },
      hint: '- Space to select. Return to submit'
    },
    // Skill Selection (Only if .agent is selected)
    {
      type: (prev, values) => values.components.includes('agent') ? 'select' : null,
      name: 'skillMode',
      message: 'How should we install Skills?',
      choices: [
        { title: 'Install Core Skills (Recommended)', value: 'core' },
        { title: 'Install All Skills', value: 'all' },
        { title: 'Select Specific Skills', value: 'custom' }
      ]
    },
    {
      type: (prev, values) => values.skillMode === 'custom' ? 'multiselect' : null,
      name: 'selectedSkills',
      message: 'Select skills to install:',
      choices: async () => {
        const skills = await getSkills();
        return skills.map(s => ({ title: s, value: s }));
      },
      hint: '- Space to select. Return to submit'
    },
    // Destination
    {
      type: 'text',
      name: 'path',
      message: 'Where should we spawn these files?',
      initial: './'
    }
  ]);

  if (!response.components) return; // User cancelled

  const destRoot = path.resolve(process.cwd(), response.path);
  console.log(pc.dim(`\nSpawning resources into: ${destRoot}...\n`));

  try {
    // 0. Install from local assets
    console.log(pc.cyan('📦 Installing from local bundle...\n'));

    // 1. Handle .agent Folder
    if (response.components.includes('agent')) {
      const agentDest = path.join(destRoot, '.agent');
      const workflowsDest = path.join(agentDest, 'workflows');
      const skillsDest = path.join(agentDest, 'skills');

      await fs.ensureDir(agentDest);
      await fs.ensureDir(workflowsDest);

      // Handle Workflows
      if (response.workflowMode === 'core') {
        console.log(pc.green('✔ Downloading Core Workflows...'));
        const coreWorkflows = [
          'vibe-genesis.md', 'vibe-design.md', 'vibe-build.md',
          'vibe-continueBuild.md', 'vibe-finalize.md', 'vibe-spawnTask.md',
          'vibe-primeAgent.md', 'vibe-syncDocs.md', 'stitch.md',
          'mode-orchestrator.md', 'mode-architect.md', 'mode-code.md',
          'mode-debug.md', 'mode-ask.md', 'mode-review.md', 'mode-visionary.md'
        ];
        await copySpecificWorkflows(coreWorkflows, workflowsDest);
      } else if (response.workflowMode === 'all') {
        console.log(pc.green('✔ Downloading all workflows...'));
        await copyAllWorkflows(workflowsDest, false);
      } else if (response.workflowMode === 'no-legacy') {
        console.log(pc.green('✔ Downloading workflows (skipping legacy)...'));
        await copyAllWorkflows(workflowsDest, true);
      } else if (response.workflowMode === 'custom' && response.selectedWorkflows) {
        console.log(pc.green(`✔ Downloading ${response.selectedWorkflows.length} specific workflows...`));
        await copySpecificWorkflows(response.selectedWorkflows, workflowsDest);
      }

      await fs.ensureDir(skillsDest);

      // Handle Skills
      if (response.skillMode === 'core') {
        console.log(pc.green('✔ Downloading Core Skills...'));
        const coreSkills = [
          'takomi',
          'ai-sdk', 'code-review', 'component-analysis',
          'nextjs-standards', 'security-audit', 'spawn-task',
          'stitch', 'sync-docs'
        ];
        await copySpecificSkills(coreSkills, skillsDest);
      } else if (response.skillMode === 'all') {
        console.log(pc.green('✔ Downloading all skills...'));
        await copyAllSkills(skillsDest);
      } else if (response.skillMode === 'custom' && response.selectedSkills) {
        console.log(pc.green(`✔ Downloading ${response.selectedSkills.length} specific skills...`));
        await copySpecificSkills(response.selectedSkills, skillsDest);
      }

      // Copy .agent/README.md if it exists
      await copyAgentReadme(path.join(agentDest, 'README.md'));
    }

    // 2. Handle Agent YAMLs
    if (response.components.includes('yamls')) {
      console.log(pc.green('✔ Downloading Agent YAMLs...'));
      const yamlDest = path.join(destRoot, 'Takomi-Agents');
      await copyAgentYamls(yamlDest);
    }

    // 3. Handle Legacy Manual
    if (response.components.includes('legacy')) {
      console.log(pc.green('✔ Downloading Legacy Protocols...'));
      const legacyDest = path.join(destRoot, 'Legacy-Protocols');
      await copyLegacyManual(legacyDest);
    }

    console.log(pc.magenta('\n✨ Your toolkit is ready. Let\'s build something extraordinary. ✨'));
    console.log(pc.white(`\nNext steps:`));
    if (response.components.includes('agent')) {
      console.log(pc.gray(`1. Your .agent folder is armed and ready.`));
      console.log(pc.gray(`2. In Codex, say "use takomi genesis" (slash command optional).`));
    }
    console.log(pc.dim(`\n💡 Pro tip: Run "takomi install" to sync this toolkit across all your IDEs.\n`));

  } catch (error) {
    console.error(pc.red('Error during installation:'), error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi install (NEW — Global Setup + Harness Routing)
// ─────────────────────────────────────────────────────────────────────────────

async function install() {
  console.log(pc.magenta(figlet.textSync('Takomi', { horizontalLayout: 'full' })));
  console.log(pc.cyan('   🌐 One install. Every IDE. Zero friction.\n'));

  // 1. Detect harnesses
  const detected = detectHarnesses();
  printHarnessStatus(detected);

  if (detected.length === 0) {
    console.log(pc.yellow('  No AI harnesses detected on this machine.'));
    console.log(pc.dim('  We support: Antigravity, KiloCode, Windsurf, Codex, Cursor, Gemini CLI'));
    console.log(pc.dim('  Run "takomi init" instead for per-project setup.\n'));
    return;
  }

  // 2. Let user select which harnesses to configure
  const harnessResponse = await prompts({
    type: 'multiselect',
    name: 'harnesses',
    message: 'Which harnesses should we configure?',
    choices: detected.map(h => ({
      title: h.name,
      value: h.id,
      selected: true,
      description: path.relative(process.env.USERPROFILE || process.env.HOME || '', h.rootPath),
    })),
    min: 1,
    hint: '- Space to select. Return to submit',
  });

  if (!harnessResponse.harnesses || harnessResponse.harnesses.length === 0) return;

  const selectedHarnesses = detected.filter(h => harnessResponse.harnesses.includes(h.id));

  // 3. Ask what to install
  const contentResponse = await prompts([
    {
      type: 'multiselect',
      name: 'content',
      message: 'What should we install globally?',
      choices: [
        { title: 'Skills', value: 'skills', selected: true, description: `${(await getSkills()).length} available` },
        { title: 'Workflows', value: 'workflows', selected: true, description: `${(await getWorkflows()).length} available` },
        { title: 'Agent YAMLs (custom_modes.yaml → KiloCode)', value: 'yamls', selected: selectedHarnesses.some(h => h.id === 'kilocode'), description: 'For KiloCode modes' },
      ],
      min: 1,
      hint: '- Space to select. Return to submit',
    },
    // Skill pack selection
    {
      type: (prev, values) => values.content.includes('skills') ? 'select' : null,
      name: 'skillMode',
      message: 'Which skill pack?',
      choices: [
        { title: 'Core (Takomi + essentials)', value: 'core', description: 'takomi, ai-sdk, code-review...' },
        { title: `All (${(await getSkills()).length} skills)`, value: 'all' },
        { title: 'Custom selection', value: 'custom' },
      ],
    },
    {
      type: (prev, values) => values.skillMode === 'custom' ? 'multiselect' : null,
      name: 'selectedSkills',
      message: 'Select skills:',
      choices: async () => {
        const skills = await getSkills();
        return skills.map(s => ({ title: s, value: s }));
      },
      hint: '- Space to select. Return to submit',
    },
    // Workflow pack selection
    {
      type: (prev, values) => values.content.includes('workflows') ? 'select' : null,
      name: 'workflowMode',
      message: 'Which workflow pack?',
      choices: [
        { title: 'Core (16 essentials)', value: 'core', description: 'vibe-build, mode-architect...' },
        { title: `All (${(await getWorkflows()).length} workflows)`, value: 'all' },
        { title: 'All (Exclude Legacy)', value: 'no-legacy' },
        { title: 'Custom selection', value: 'custom' },
      ],
    },
    {
      type: (prev, values) => values.workflowMode === 'custom' ? 'multiselect' : null,
      name: 'selectedWorkflows',
      message: 'Select workflows:',
      choices: async () => {
        const workflows = await getWorkflows();
        return workflows.map(w => ({ title: w, value: w }));
      },
      hint: '- Space to select. Return to submit',
    },
  ]);

  if (!contentResponse.content) return;

  try {
    // 4. Initialize global store
    console.log(pc.cyan(`\n📦 Creating global store (${STORE_PATH})...\n`));
    await initGlobalStore();

    // 5. Populate store from package assets
    if (contentResponse.content.includes('skills')) {
      const skillMode = contentResponse.skillMode === 'custom'
        ? contentResponse.selectedSkills
        : contentResponse.skillMode;
      const skills = await populateSkills(skillMode);
      console.log(pc.green(`  ✔ ${skills.length} skills loaded into store`));
    }

    if (contentResponse.content.includes('workflows')) {
      const workflowMode = contentResponse.workflowMode === 'custom'
        ? contentResponse.selectedWorkflows
        : contentResponse.workflowMode;
      const workflows = await populateWorkflows(workflowMode);
      console.log(pc.green(`  ✔ ${workflows.length} workflows loaded into store`));
    }

    if (contentResponse.content.includes('yamls')) {
      const yamls = await populateAgentYamls();
      console.log(pc.green(`  ✔ ${yamls.length} agent YAMLs loaded into store`));
    }

    // 6. Sync store to all selected harnesses
    console.log(pc.cyan('\n📡 Syncing to harnesses...\n'));
    await syncToAllHarnesses(selectedHarnesses, STORE_PATH);

    // 7. Update manifest
    const manifest = await getManifest();
    manifest.linkedHarnesses = selectedHarnesses.map(h => h.id);
    manifest.installed.skills = await getStoreSkills();
    manifest.installed.workflows = await getStoreWorkflows();
    await writeManifest(manifest);

    // 8. Summary
    console.log(pc.magenta('\n✨ Your command center is live. ✨'));
    console.log(pc.white(`\n  Store:     ${STORE_PATH}`));
    console.log(pc.white(`  Connected: ${selectedHarnesses.map(h => h.name).join(', ')}`));
    console.log(pc.dim(`\n  Add skills:    takomi add <github-url>`));
    console.log(pc.dim(`  Sync updates:  takomi sync\n`));

  } catch (error) {
    console.error(pc.red('\nError during global installation:'), error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi sync (NEW — Re-sync store to all harnesses)
// ─────────────────────────────────────────────────────────────────────────────

async function sync() {
  console.log(pc.magenta('📡 Syncing your toolkit to all connected IDEs...\n'));

  // Check if global store exists
  if (!await isStoreInitialized()) {
    console.log(pc.yellow('No command center found. Run "takomi install" first.\n'));
    return;
  }

  const manifest = await getManifest();
  const detected = detectHarnesses();

  if (detected.length === 0) {
    console.log(pc.yellow('No AI harnesses detected.\n'));
    return;
  }

  // Let user pick which harnesses to sync to
  const response = await prompts({
    type: 'multiselect',
    name: 'harnesses',
    message: 'Sync to which harnesses?',
    choices: detected.map(h => ({
      title: h.name,
      value: h.id,
      selected: manifest.linkedHarnesses.includes(h.id),
    })),
    min: 1,
    hint: '- Space to select. Return to submit',
  });

  if (!response.harnesses || response.harnesses.length === 0) return;

  const selectedHarnesses = detected.filter(h => response.harnesses.includes(h.id));

  console.log(pc.cyan('\n📡 Syncing from global store...\n'));
  await syncToAllHarnesses(selectedHarnesses, STORE_PATH);

  // Update manifest with current harnesses
  manifest.linkedHarnesses = [...new Set([...manifest.linkedHarnesses, ...response.harnesses])];
  await writeManifest(manifest);

  const skills = await getStoreSkills();
  const workflows = await getStoreWorkflows();
  console.log(pc.magenta(`\n✨ ${skills.length} skills and ${workflows.length} workflows synced to ${selectedHarnesses.length} IDE(s). Ready to build.\n`));
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi add <url> (NEW — Fetch remote skills from GitHub)
// ─────────────────────────────────────────────────────────────────────────────

async function add(url) {
  console.log(pc.magenta('📥 Adding new capabilities to your toolkit...\n'));

  // Parse GitHub URL → owner/repo
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) {
    console.log(pc.red('That doesn\'t look like a GitHub URL. Expected: https://github.com/owner/repo'));
    return;
  }

  const repoSlug = match[1].replace(/\.git$/, '');
  console.log(pc.dim(`  Repo: ${repoSlug}\n`));

  // Initialize store if needed
  await initGlobalStore();

  // Try to find skills in common locations
  const skillsDest = path.join(STORE_PATH, 'skills');
  const workflowsDest = path.join(STORE_PATH, 'workflows');

  console.log(pc.cyan('📡 Fetching from GitHub...\n'));

  // Try assets/.agent/skills/ first (Takomi structure)
  let skillCount = await downloadDirectoryFromGitHub(
    'assets/.agent/skills',
    skillsDest,
    null,
    250
  );

  // Fallback: try .agent/skills/
  if (skillCount === 0) {
    skillCount = await downloadDirectoryFromGitHub(
      '.agent/skills',
      skillsDest,
      null,
      250
    );
  }

  // Try workflows
  let workflowCount = await downloadDirectoryFromGitHub(
    'assets/.agent/workflows',
    workflowsDest,
    (item) => item.name.endsWith('.md'),
    250
  );

  if (workflowCount === 0) {
    workflowCount = await downloadDirectoryFromGitHub(
      '.agent/workflows',
      workflowsDest,
      (item) => item.name.endsWith('.md'),
      250
    );
  }

  if (skillCount === 0 && workflowCount === 0) {
    console.log(pc.yellow('  No skills or workflows found in repo.'));
    console.log(pc.dim('  Expected structure: .agent/skills/ or assets/.agent/skills/\n'));
    return;
  }

  console.log(pc.green(`\n  ✔ ${skillCount} skills and ${workflowCount} workflows added to your command center.`));

  // Update manifest
  const manifest = await getManifest();
  manifest.installed.skills = await getStoreSkills();
  manifest.installed.workflows = await getStoreWorkflows();
  await writeManifest(manifest);

  // Offer to sync
  if (manifest.linkedHarnesses.length > 0) {
    const syncResponse = await prompts({
      type: 'confirm',
      name: 'doSync',
      message: 'Push these to your connected IDEs now?',
      initial: true,
    });

    if (syncResponse.doSync) {
      const detected = detectHarnesses();
      const linked = detected.filter(h => manifest.linkedHarnesses.includes(h.id));
      await syncToAllHarnesses(linked, STORE_PATH);
      console.log(pc.magenta(`\n✨ Live on ${linked.length} IDE(s). You're armed and ready.\n`));
    }
  } else {
    console.log(pc.dim('\n  Run "takomi sync" when you want to push these to your IDEs.\n'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// takomi harnesses (NEW — Show detected harnesses + status)
// ─────────────────────────────────────────────────────────────────────────────

async function harnesses() {
  console.log(pc.magenta('🔌 Your Connected IDEs\n'));

  const detected = detectHarnesses();
  printHarnessStatus(detected);

  // Show store status if initialized
  if (await isStoreInitialized()) {
    const manifest = await getManifest();
    const skills = await getStoreSkills();
    const workflows = await getStoreWorkflows();

    console.log(pc.cyan('📦 Command Center Status\n'));
    console.log(pc.white(`  Location:  ${STORE_PATH}`));
    console.log(pc.white(`  Skills:    ${skills.length} ready to deploy`));
    console.log(pc.white(`  Workflows: ${workflows.length} available`));
    console.log(pc.white(`  Connected: ${manifest.linkedHarnesses.join(', ') || 'none'}`));
    console.log(pc.dim(`  Updated:   ${manifest.updatedAt}\n`));
  } else {
    console.log(pc.dim('  No command center yet. Run "takomi install" to build your toolkit.\n'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Registration
// ─────────────────────────────────────────────────────────────────────────────

program
  .name('takomi')
  .description('Your AI team. Activated. 🎯')
  .version('2.0.0');

// Per-project setup (backward compatible)
program
  .command('init')
  .description('Drop Takomi into this project')
  .action(init);

// Global installer (NEW)
program
  .command('install')
  .description('Build your global command center')
  .action(install);

// Re-sync (NEW)
program
  .command('sync')
  .description('Push updates to all connected IDEs')
  .action(sync);

// Add remote skills (NEW)
program
  .command('add <url>')
  .description('Import skills from any GitHub repo')
  .action(add);

// Show harness status (NEW)
program
  .command('harnesses')
  .description('See your toolkit status and connected IDEs')
  .action(harnesses);

// Update from GitHub (EXISTING — enhanced)
program
  .command('update')
  .description('Pull fresh resources from GitHub')
  .action(async () => {
    console.log(pc.magenta('📡 Updating your toolkit from GitHub...\n'));

    const storeExists = await isStoreInitialized();

    const response = await prompts([
      {
        type: 'multiselect',
        name: 'components',
        message: 'What components do you want to update from GitHub?',
        choices: [
          { title: '.agent (Workflows & Skills)', value: 'agent', selected: true },
          { title: 'Agent YAMLs', value: 'yamls' },
          { title: 'Legacy Protocols', value: 'legacy' },
          ...(storeExists ? [{ title: 'Global Store', value: 'global', description: 'Update ~/.takomi/' }] : []),
        ],
        hint: '- Space to select. Return to submit'
      }
    ]);

    if (!response.components || response.components.length === 0) return;

    const destRoot = process.cwd();

    if (response.components.includes('agent')) {
      const agentDest = path.join(destRoot, '.agent');
      await updateWorkflows(path.join(agentDest, 'workflows'));
      await updateSkills(path.join(agentDest, 'skills'));
    }

    if (response.components.includes('yamls')) {
      await updateAgentYamls(path.join(destRoot, 'Takomi-Agents'));
    }

    if (response.components.includes('legacy')) {
      await updateLegacyManual(path.join(destRoot, 'Legacy-Protocols'));
    }

    // Update global store if selected
    if (response.components.includes('global')) {
      console.log(pc.cyan('\n📡 Updating global store from package assets...\n'));
      const skills = await populateSkills('all');
      const workflows = await populateWorkflows('all');
      const yamls = await populateAgentYamls();
      console.log(pc.green(`  ✔ ${skills.length} skills, ${workflows.length} workflows, ${yamls.length} YAMLs updated`));

      // Auto-sync to linked harnesses
      const manifest = await getManifest();
      if (manifest.linkedHarnesses.length > 0) {
        const detected = detectHarnesses();
        const linked = detected.filter(h => manifest.linkedHarnesses.includes(h.id));
        if (linked.length > 0) {
          console.log(pc.cyan('\n📡 Auto-syncing to linked harnesses...\n'));
          await syncToAllHarnesses(linked, STORE_PATH);
        }
      }

      manifest.installed.skills = await getStoreSkills();
      manifest.installed.workflows = await getStoreWorkflows();
      await writeManifest(manifest);
    }

    console.log(pc.magenta('\n✨ Your toolkit is fresh and ready to ship.'));
  });

program.parse();
