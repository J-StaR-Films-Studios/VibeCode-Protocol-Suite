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
  copyToDestination,
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
  updateLegacyManual
} from './utils.js';

const program = new Command();

async function init() {
  console.log(pc.magenta(figlet.textSync('VibeSuite', { horizontalLayout: 'full' })));
  console.log(pc.cyan('   J StaR Films Studios VibeCode Protocol Suite\n'));

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

      // Ensure workflows destination directory exists
      await fs.ensureDir(workflowsDest);

      // Handle Workflows
      if (response.workflowMode === 'core') {
        console.log(pc.green('✔ Downloading Core Workflows...'));
        const coreWorkflows = [
          'vibe-genesis.md', 'vibe-design.md', 'vibe-build.md',
          'vibe-continueBuild.md', 'vibe-finalize.md', 'vibe-spawnTask.md',
          'vibe-primeAgent.md', 'vibe-syncDocs.md', 'stitch.md',
          'mode-orchestrator.md', 'mode-architect.md', 'mode-code.md',
          'mode-debug.md', 'mode-ask.md', 'mode-review.md'
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

      // Ensure skills destination directory exists
      await fs.ensureDir(skillsDest);

      // Handle Skills
      if (response.skillMode === 'core') {
        console.log(pc.green('✔ Downloading Core Skills...'));
        const coreSkills = [
          'ai-sdk',
          'code-review',
          'component-analysis',
          'nextjs-standards',
          'security-audit',
          'spawn-task',
          'stitch',
          'sync-docs'
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
      const yamlDest = path.join(destRoot, 'VibeCode-Agents');
      await copyAgentYamls(yamlDest);
    }

    // 3. Handle Legacy Manual
    if (response.components.includes('legacy')) {
      console.log(pc.green('✔ Downloading Legacy Protocols...'));
      const legacyDest = path.join(destRoot, 'Legacy-Protocols');
      await copyLegacyManual(legacyDest);
    }

    console.log(pc.magenta('\n✨ VibeCode Protocol Suite spawned successfully! ✨'));
    console.log(pc.white(`\nNext steps:`));
    if (response.components.includes('agent')) {
      console.log(pc.gray(`1. If using Cursor/Windsurf, the .agent folder is ready.`));
      console.log(pc.gray(`2. Try typing '/init_vibecode_genesis' in your IDE.`));
    }

  } catch (error) {
    console.error(pc.red('Error during installation:'), error);
  }
}

program
  .name('vibesuite')
  .description('VibeCode Protocol Suite CLI')
  .version('1.3.0')
  .command('init')
  .description('Initialize VibeCode in the current directory')
  .action(init);

program
  .command('update')
  .description('Update resources from GitHub (Overwrites local files)')
  .action(async () => {
    console.log(pc.magenta('📡 VibeSuite Update Protocol'));

    const response = await prompts([
      {
        type: 'multiselect',
        name: 'components',
        message: 'What components do you want to update from GitHub?',
        choices: [
          { title: '.agent (Workflows & Skills)', value: 'agent', selected: true },
          { title: 'Agent YAMLs', value: 'yamls' },
          { title: 'Legacy Protocols', value: 'legacy' }
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
      await updateAgentYamls(path.join(destRoot, 'VibeCode-Agents'));
    }

    if (response.components.includes('legacy')) {
      await updateLegacyManual(path.join(destRoot, 'Legacy-Protocols'));
    }

    console.log(pc.magenta('\n✨ Resources updated from GitHub successfully!'));
  });

program.parse();
