import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, 'docs', 'project-status.json');
const START = '<!-- LUMENA_AUTO_STATUS_START -->';
const END = '<!-- LUMENA_AUTO_STATUS_END -->';

const status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));

const safeGit = (args, fallback = '') => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
};

const sha = process.env.GITHUB_SHA || safeGit(['rev-parse', 'HEAD'], 'unknown');
const shortSha = sha.slice(0, 7);
const commitDate = safeGit(['show', '-s', '--format=%cI', sha], new Date().toISOString());
const repo = process.env.GITHUB_REPOSITORY || 'maxgab201/Lumena-Workspace';
const branch = process.env.GITHUB_REF_NAME || safeGit(['branch', '--show-current'], 'unknown');

const bullets = (items) => items.map((item) => `  - ${item}`).join('\n');

const block = [
  START,
  '> [!NOTE]',
  '> **Automated project status — source of truth for current implementation state.**',
  `> Synced from \`docs/project-status.json\` at commit [\`${shortSha}\`](https://github.com/${repo}/commit/${sha}) on \`${commitDate}\` (branch \`${branch}\`). If older prose below conflicts with this block, this generated block wins.`,
  '',
  `- **Lifecycle:** ${status.lifecycle}`,
  `- **Current focus:** ${status.current_focus}`,
  `- **Current checkpoint:** ${status.current_checkpoint}`,
  `- **Status:** ${status.status}`,
  '- **Completed:**',
  bullets(status.completed),
  '- **In progress:**',
  bullets(status.in_progress),
  '- **Next:**',
  bullets(status.next),
  '- **Product rules:**',
  bullets(status.product_rules),
  END,
].join('\n');

const markdownFiles = [];

for (const name of fs.readdirSync(ROOT)) {
  if (name.endsWith('.md')) markdownFiles.push(path.join(ROOT, name));
}

const docsDir = path.join(ROOT, 'docs');
for (const name of fs.readdirSync(docsDir)) {
  if (name.endsWith('.md')) markdownFiles.push(path.join(docsDir, name));
}

let changed = 0;

for (const file of markdownFiles.sort()) {
  const original = fs.readFileSync(file, 'utf8');
  let next = original;

  const startIndex = original.indexOf(START);
  const endIndex = original.indexOf(END);

  if (startIndex >= 0 && endIndex > startIndex) {
    next = original.slice(0, startIndex) + block + original.slice(endIndex + END.length);
  } else {
    const firstHeadingMatch = original.match(/^# .+$/m);
    if (firstHeadingMatch && firstHeadingMatch.index != null) {
      const insertAt = firstHeadingMatch.index + firstHeadingMatch[0].length;
      next = original.slice(0, insertAt) + '\n\n' + block + original.slice(insertAt);
    } else {
      next = block + '\n\n' + original;
    }
  }

  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    changed += 1;
  }
}

console.log(`[docs-sync] Updated ${changed}/${markdownFiles.length} markdown files from docs/project-status.json`);
