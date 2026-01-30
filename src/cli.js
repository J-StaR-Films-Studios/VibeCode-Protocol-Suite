import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import figlet from 'figlet';
import fs from 'fs-extra';
import path from 'path';
import { PATHS, getWorkflows, getSkills, copyToDestination, copySpecificWorkflows, copySpecificSkills } from './utils.js';

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
    // 1. Handle .agent Folder
    if (response.components.includes('agent')) {
      const agentDest = path.join(destRoot, '.agent');
      const workflowsDest = path.join(agentDest, 'workflows');
      const skillsDest = path.join(agentDest, 'skills');

      await fs.ensureDir(agentDest);

      // Ensure workflows destination directory exists
      await fs.ensureDir(workflowsDest);

      // Handle Workflows
      if (response.workflowMode === 'all') {
        console.log(pc.green('✔ Copying all workflows...'));
        await fs.copy(PATHS.workflows, workflowsDest);
      } else if (response.workflowMode === 'no-legacy') {
        console.log(pc.green('✔ Copying workflows (skipping legacy)...'));
        await fs.copy(PATHS.workflows, workflowsDest);
        // Remove LEGACY folder if it exists in the copy
        const legacyPath = path.join(workflowsDest, 'LEGACY');
        if (await fs.pathExists(legacyPath)) {
          await fs.remove(legacyPath);
        }
      } else if (response.workflowMode === 'custom' && response.selectedWorkflows) {
        console.log(pc.green(`✔ Copying ${response.selectedWorkflows.length} specific workflows...`));
        await copySpecificWorkflows(response.selectedWorkflows, workflowsDest);
      }

      // Ensure skills destination directory exists
      await fs.ensureDir(skillsDest);

      // Handle Skills
      if (response.skillMode === 'all') {
        console.log(pc.green('✔ Copying all skills...'));
        await fs.copy(PATHS.skills, skillsDest);
      } else if (response.skillMode === 'custom' && response.selectedSkills) {
        console.log(pc.green(`✔ Copying ${response.selectedSkills.length} specific skills...`));
        await copySpecificSkills(response.selectedSkills, skillsDest);
      }

      // Copy .agent/README.md if it exists
      const readmeSrc = path.join(PATHS.agent, 'README.md');
      if (await fs.pathExists(readmeSrc)) {
        await fs.copy(readmeSrc, path.join(agentDest, 'README.md'));
      }
    }

    // 2. Handle Agent YAMLs
    if (response.components.includes('yamls')) {
      console.log(pc.green('✔ Copying Agent YAMLs...'));
      const yamlDest = path.join(destRoot, 'VibeCode-Agents');
      await fs.ensureDir(yamlDest);
      await fs.copy(PATHS.agentsYaml, yamlDest);
    }

    // 3. Handle Legacy Manual
    if (response.components.includes('legacy')) {
      console.log(pc.green('✔ Copying Legacy Protocols...'));
      const legacyDest = path.join(destRoot, 'Legacy-Protocols');
      await fs.ensureDir(legacyDest);
      await fs.copy(PATHS.manual, legacyDest);
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
  .version('1.0.0')
  .command('init')
  .description('Initialize VibeCode in the current directory')
  .action(init);

program.parse();
