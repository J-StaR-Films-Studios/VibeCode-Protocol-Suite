import readline from 'node:readline';
import pc from 'picocolors';
import {
  colorCategory,
  getUncategorizedSkills,
  listBundledSkillNames,
  readSkillDescription,
  SKILL_CATEGORIES,
} from './skills-catalog.js';

const CLEAR_SCREEN = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

function uniqueSkills(skills = []) {
  return [...new Set(skills)].sort();
}

function terminalSupportsTui() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI && process.env.TAKOMI_SKILLS_TUI !== '0');
}

async function buildTuiCategories() {
  const bundled = new Set(await listBundledSkillNames());
  const categories = SKILL_CATEGORIES.map((category) => ({
    ...category,
    skills: category.skills.filter((skill) => bundled.has(skill)),
  })).filter((category) => category.skills.length > 0);

  const uncategorized = await getUncategorizedSkills();
  if (uncategorized.length) {
    categories.push({
      id: '__uncategorized',
      title: 'Other / Uncategorized',
      color: 'yellow',
      description: 'Bundled skills that are not assigned to a curated category yet.',
      skills: uncategorized,
    });
  }

  const descriptions = new Map();
  for (const skill of uniqueSkills(categories.flatMap((category) => category.skills))) {
    descriptions.set(skill, await readSkillDescription(skill));
  }

  return { categories, descriptions };
}

function getCategorySkillState(category, selected) {
  const selectedCount = category.skills.filter((skill) => selected.has(skill)).length;
  return {
    selectedCount,
    total: category.skills.length,
    allSelected: selectedCount === category.skills.length,
    noneSelected: selectedCount === 0,
  };
}

function buildVisibleRows(categories, expanded) {
  const rows = [];
  for (const category of categories) {
    rows.push({ type: 'category', category });
    if (expanded.has(category.id)) {
      for (const skill of category.skills) rows.push({ type: 'skill', category, skill });
    }
  }
  return rows;
}

function trimLine(value, width) {
  const plain = pc.stripColor ? pc.stripColor(value) : value.replace(/\x1b\[[0-9;]*m/g, '');
  if (plain.length <= width) return value;
  return plain.slice(0, Math.max(0, width - 1)) + '…';
}

function render({ categories, descriptions, expanded, selected, cursor, scroll, title }) {
  const rows = buildVisibleRows(categories, expanded);
  const width = Math.max(60, process.stdout.columns || 100);
  const height = Math.max(16, process.stdout.rows || 30);
  const bodyHeight = height - 8;
  const visibleRows = rows.slice(scroll, scroll + bodyHeight);
  const selectedTotal = selected.size;

  const lines = [];
  lines.push(pc.magenta('🧰 Takomi Skills Installation'));
  lines.push(pc.dim(title || 'Custom category selector'));
  lines.push(pc.dim('↑/↓ move  Space select  → expand  ← collapse  Enter continue  q/Esc cancel'));
  lines.push(pc.cyan(`Selected skills: ${selectedTotal}`));
  lines.push('');

  for (let index = 0; index < visibleRows.length; index++) {
    const absoluteIndex = scroll + index;
    const row = visibleRows[index];
    const active = absoluteIndex === cursor;
    const prefix = active ? pc.inverse('›') : ' ';

    if (row.type === 'category') {
      const state = getCategorySkillState(row.category, selected);
      const marker = expanded.has(row.category.id) ? '▾' : '▸';
      const checkbox = state.allSelected ? pc.green('[x]') : state.noneSelected ? pc.dim('[ ]') : pc.yellow('[-]');
      const count = pc.dim(`${state.selectedCount}/${state.total}`);
      const description = pc.dim(row.category.description || '');
      lines.push(trimLine(`${prefix} ${marker} ${checkbox} ${colorCategory(row.category)} ${count} ${description}`, width));
    } else {
      const checked = selected.has(row.skill) ? pc.green('[x]') : pc.dim('[ ]');
      const description = descriptions.get(row.skill) || '';
      lines.push(trimLine(`${prefix}    ${checked} ${pc.white(row.skill)} ${pc.dim(description)}`, width));
    }
  }

  if (scroll + bodyHeight < rows.length) lines.push(pc.dim('  … more below'));
  lines.push('');
  lines.push(pc.dim('Tip: selecting a category toggles all skills in that category. Expand to fine-tune individual skills.'));

  process.stdout.write(CLEAR_SCREEN + HIDE_CURSOR + lines.join('\n'));
}

function clampCursor(cursor, rowCount) {
  if (rowCount <= 0) return 0;
  return Math.max(0, Math.min(cursor, rowCount - 1));
}

function scrollForCursor(cursor, scroll) {
  const height = Math.max(16, process.stdout.rows || 30);
  const bodyHeight = height - 8;
  if (cursor < scroll) return cursor;
  if (cursor >= scroll + bodyHeight) return cursor - bodyHeight + 1;
  return scroll;
}

export async function promptSkillCategoryTui({ initialSelected = [], title = 'Custom Skills Selection' } = {}) {
  if (!terminalSupportsTui()) return undefined;

  const { categories, descriptions } = await buildTuiCategories();
  const selected = new Set(initialSelected);
  const expanded = new Set(initialSelected.length ? categories.filter((category) => category.skills.some((skill) => selected.has(skill))).map((category) => category.id) : ['core']);
  let cursor = 0;
  let scroll = 0;

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();

    const cleanup = (value) => {
      stdin.off('keypress', onKeypress);
      if (!wasRaw) stdin.setRawMode?.(false);
      process.stdout.write(SHOW_CURSOR + '\n');
      resolve(value);
    };

    const rerender = () => {
      const rows = buildVisibleRows(categories, expanded);
      cursor = clampCursor(cursor, rows.length);
      scroll = scrollForCursor(cursor, scroll);
      render({ categories, descriptions, expanded, selected, cursor, scroll, title });
    };

    const toggleCategory = (category) => {
      const state = getCategorySkillState(category, selected);
      if (state.allSelected) {
        for (const skill of category.skills) selected.delete(skill);
      } else {
        for (const skill of category.skills) selected.add(skill);
      }
    };

    const onKeypress = (_str, key = {}) => {
      const rows = buildVisibleRows(categories, expanded);
      const row = rows[cursor];

      if (key.name === 'c' && key.ctrl) return cleanup(null);
      if (key.name === 'escape' || key.name === 'q') return cleanup(null);
      if (key.name === 'return') return cleanup([...selected].sort());

      if (key.name === 'up') cursor -= 1;
      else if (key.name === 'down') cursor += 1;
      else if (key.name === 'pageup') cursor -= Math.max(5, (process.stdout.rows || 30) - 10);
      else if (key.name === 'pagedown') cursor += Math.max(5, (process.stdout.rows || 30) - 10);
      else if (key.name === 'right' && row?.type === 'category') expanded.add(row.category.id);
      else if (key.name === 'left' && row?.type === 'category') expanded.delete(row.category.id);
      else if (key.name === 'left' && row?.type === 'skill') {
        expanded.delete(row.category.id);
        cursor = rows.findIndex((candidate) => candidate.type === 'category' && candidate.category.id === row.category.id);
      } else if (key.name === 'space' && row?.type === 'category') {
        toggleCategory(row.category);
      } else if (key.name === 'space' && row?.type === 'skill') {
        if (selected.has(row.skill)) selected.delete(row.skill);
        else selected.add(row.skill);
      }

      rerender();
    };

    stdin.on('keypress', onKeypress);
    rerender();
  });
}
