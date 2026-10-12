#!/usr/bin/env node
// Optional one-session entry aid; no settings writes, extension loading or worker scheduler.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const toolkit = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const digest = text => createHash('sha256').update(text).digest('hex');
const help = `Usage: node scripts/addy-start.mjs --project PATH [--task TEXT | --task-file PATH] [--launch]
Default: read-only context/resource preflight and current Git observations, JSON on stdout.
--launch: explicitly open a fresh opt-in Pi session if mechanical preflight has no blockers.
No install/reload, settings mutation, project-rule override, application control or provider call in check mode.
Task files are optional. Opt-in alone is not implementation, private-data or release authority.
Read reported context files before launch; known-conflict checks are not exhaustive semantic analysis.
`;

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--launch') { options.launch = true; continue; }
    const key = { '--project': 'project', '--task': 'task', '--task-file': 'taskFile' }[arg];
    if (!key) throw Error(`Unknown option: ${arg}`);
    const value = argv[++i];
    if (!value || (key !== 'task' && value.startsWith('--')) || value.includes('\0')) throw Error(`Missing/invalid value for ${arg}`);
    options[key] = value;
  }
  if (!options.project) throw Error('--project is required');
  if (options.task && options.taskFile) throw Error('Use --task or --task-file, not both');
  options.project = realpathSync(resolve(options.project));
  if (!statSync(options.project).isDirectory()) throw Error('Project must be an existing directory');
  if (options.taskFile) {
    options.taskFile = realpathSync(resolve(options.taskFile));
    if (!statSync(options.taskFile).isFile()) throw Error('Task file must be an existing regular file');
  }
  return options;
}

function hostLocation() {
  const result = spawnSync('sh', ['-c', 'command -v pi'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) throw Error('Pi executable not found on PATH');
  const executable = resolve(result.stdout.trim());
  let root = dirname(realpathSync(executable));
  for (;;) {
    const manifest = join(root, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name === '@earendil-works/pi-coding-agent') return { root, executable, version: pkg.version };
    }
    const parent = dirname(root);
    if (parent === root) throw Error('Cannot locate the installed Pi resource loader');
    root = parent;
  }
}

// Intentionally narrow detectors for observed legacy mandates, not a policy interpreter.
const conflictPatterns = [
  ['mandatory-context-mode', /^\s*#+\s*context-mode\b.*\bMANDATORY\b/i],
  ['mandatory-context-mode', /\b(?:context-mode|ctx_\*)\s+(?:tools?\s+)?(?:is|are)\s+(?:mandatory|required)\b/i],
  ['mandatory-takt', /\b(?:Use|must use)\s+takt\s+for\b/i],
  ['repeated-approval', /^\s*\d+\.\s*(?:\*\*)?Wait(?:\*\*)?.*\bapproval\b/i],
];

function baseline(cwd) {
  const git = args => spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], { cwd, encoding: 'utf8' });
  const repo = git(['rev-parse', '--show-toplevel']);
  if (repo.status !== 0) return { git: false, head: null, note: 'No Git baseline; discover project-owned validation in the new task.' };
  const head = git(['rev-parse', '--verify', 'HEAD']);
  const status = git(['status', '--porcelain=v1', '--untracked-files=normal']);
  if (status.status !== 0) throw Error('Cannot inspect current Git status');
  return { git: true, root: repo.stdout.trim(), head: head.status === 0 ? head.stdout.trim() : null,
    statusEntries: status.stdout.split('\n').filter(Boolean).length, statusSha256: digest(status.stdout),
    note: 'Current observation only, not a stored expectation, source snapshot or green test baseline. Preserve dirty work.' };
}

async function inspect(options) {
  const host = hostLocation();
  const importHost = path => import(pathToFileURL(join(host.root, 'dist', path + '.js')).href);
  const { loadProjectContextFiles } = await importHost('core/resource-loader');
  const { loadSkills } = await importHost('core/skills');
  const { getAgentDir } = await importHost('config');
  // Match the child session's cwd for a relative PI_CODING_AGENT_DIR.
  const agentDir = resolve(options.project, getAgentDir());
  const files = loadProjectContextFiles({ cwd: options.project, agentDir });
  // Agent-level prompt files also participate in startup instructions. Project
  // replacements are handled conservatively below, without trusting/loading them.
  for (const name of ['SYSTEM.md', 'APPEND_SYSTEM.md']) {
    const path = join(agentDir, name);
    if (existsSync(path)) files.push({ path, content: readFileSync(path, 'utf8') });
  }
  if (!existsSync(join(host.root, 'dist/extensions/codemode/index.js')))
    throw Error('Installed Pi does not supply the native codemode entry point');
  const blockers = [];
  for (const file of files) {
    file.content.split('\n').forEach((line, index) => {
      for (const [reason, pattern] of conflictPatterns) {
        if (pattern.test(line)) { blockers.push({ path: file.path, line: index + 1, reason }); break; }
      }
    });
  }
  // Context selection does not establish trust for executable package/settings resources.
  // Do not silently ignore required project configuration or load it to "test" safety.
  for (const name of ['settings.json', 'SYSTEM.md', 'APPEND_SYSTEM.md']) {
    const path = join(options.project, '.pi', name);
    if (existsSync(path)) blockers.push({ path, reason: 'protected-project-configuration-needs-separate-inspection' });
  }
  const skillPath = join(toolkit, 'skills/addy-engineering/SKILL.md');
  const skills = loadSkills({ cwd: options.project, agentDir, skillPaths: [skillPath], includeDefaults: false });
  if (skills.diagnostics.length || skills.skills.length !== 1 || skills.skills[0].name !== 'addy-engineering' || skills.skills[0].disableModelInvocation)
    throw Error('Expected one valid discoverable adapted skill');
  const adapter = join(toolkit, 'extensions/delivery-tmux/index.ts');
  if (!statSync(adapter).isFile()) throw Error('Candidate execution adapter is missing');
  const args = ['--no-extensions', '--extension', 'builtin:codemode', '--extension', adapter,
    '--no-mcp', '--no-skills', '--skill', skillPath, '--no-prompt-templates'];
  args.push('--');
  if (options.taskFile) args.push('@' + options.taskFile);
  const optIn = 'The user explicitly selects the adapted Addy engineering path for this fresh session. Load its skill and Pi adaptations. Inspect effective instructions/tools and the latest task outcome/handoff before proposing follow-up work. Preserve all project quality/safety rules. This opt-in does not authorize implementation without an understood execution request, private-data access, application control or release. Establish the fresh project-required baseline before edits; preserve dirty work and reuse unchanged evidence. Surface necessary runtime permissions early and concisely.';
  // Pi recognizes @attachments even after --. Keep arbitrary task text within a
  // prose-prefixed message; only --task-file may deliberately supply an attachment.
  // This controlled entry invokes the skill explicitly; ordinary installations can
  // select the discoverable skill natively from its description.
  args.push('/skill:addy-engineering ' + optIn + (options.task ? '\n\nUser task:\n' + options.task : ''));
  const report = { project: options.project, toolkit, hostVersion: host.version,
    context: files.map(file => ({ path: file.path, sha256: digest(file.content) })), blockers,
    baseline: baseline(options.project),
    invocation: { executable: host.executable, args, cwd: options.project },
    limitations: 'Known mechanical checks only, not exhaustive semantic compatibility or model compliance. Review all selected context files and remaining instructions before launch; the new session must verify the full effective loadout. No project tests or privacy/isolation checks have passed merely from this preflight.' };
  return report;
}

try {
  const options = parse(process.argv.slice(2));
  if (options.help) console.log(help);
  else {
    const report = await inspect(options);
    (options.launch ? console.error : console.log)(JSON.stringify(report, null, 2));
    if (report.blockers.length) {
      console.error('Launch blocked. Inspect the cited project/global instructions or protected configuration; resolve with applicable authority. No bypass/automatic rule edit.');
      process.exitCode = 2;
    } else if (options.launch) {
      // Literal argument vector; no shell interpolation, old-session resume or hidden retries.
      const result = spawnSync(report.invocation.executable, report.invocation.args, { cwd: report.project, stdio: 'inherit' });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  }
} catch (error) {
  console.error(`Addy entry: ${error.message}`);
  process.exitCode = 2;
}
