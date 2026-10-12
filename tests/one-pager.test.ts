import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, mkdirSync, readlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { renderDocument, renderFile, renderMarkdown } from '../skills/one-pager/scripts/render.mjs';
import { modeOptions, validateModes } from '../skills/one-pager/scripts/modes.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = resolve(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), '@earendil-works/pi-coding-agent');
const { loadExtensions } = await import(resolve(host, 'dist/core/extensions/loader.js'));
const { createEventBus } = await import(resolve(host, 'dist/core/event-bus.js'));
const { visibleWidth } = await import(resolve(host, 'node_modules/@earendil-works/pi-tui/dist/index.js'));
const { getThemeByName } = await import(resolve(host, 'dist/modes/interactive/theme/theme.js'));
const theme = getThemeByName('dark');
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const keys = { down: '\x1b[B', enter: '\r', space: ' ', esc: '\x1b' };

async function fixture(mode = 'tui', extensionPath = resolve(root, 'extensions/one-pager/index.ts')) {
  const loaded = await loadExtensions([extensionPath], root, createEventBus());
  assert.deepEqual(loaded.errors, []);
  const ext = loaded.extensions[0];
  const definition = ext.tools.get('one_pager_mode').definition;
  const scripts: string[][] = [];
  const components: any[] = [];
  const dialogs: any[] = [];
  const answers: (number | undefined)[] = [];
  const ctx: any = { cwd: root, hasUI: mode !== 'json', mode, ui: {
    custom: async (factory: any) => new Promise(resolveAnswer => {
      let component: any;
      const done = (value: any) => { resolveAnswer(value); component?.dispose?.(); };
      component = factory({ requestRender() {} }, theme, {}, done);
      components.push(component);
      for (const key of scripts.shift() ?? []) component.handleInput(key);
    }),
    select: async (title: string, options: string[], opts: any) => { dialogs.push({ title, options, opts }); const answer = answers.shift(); return answer === undefined ? undefined : options[answer]; },
  } };
  const execute = (recommended = ['briefing'], reason = 'Based on the research we discussed.', signal?: AbortSignal) => definition.execute('id', { recommended, reason }, signal, undefined, ctx);
  return { loaded, ext, definition, scripts, components, answers, dialogs, ctx, execute };
}
function temp() { return mkdtempSync(resolve(tmpdir(), 'pi-one-pager-')); }
function spec() { return { title: 'A readable explainer', summary: 'A concise, evidence-based summary.', modes: ['explainer'], sources: [], sections: [{ title: 'Mental model', blocks: [{ type: 'text', text: 'A clear explanation.' }] }] }; }
function reviewSpec(path: string) {
  return { ...spec(), modes: ['explainer', 'decision-review'], sources: [{ id: 'proposal', label: 'Full proposal', path }], decisions: [{ id: 'choice', title: 'Use a native helper', proposal: 'Proposed direction only.', rationale: 'A bounded rationale.', alternatives: ['Retain the existing path.'], consequences: ['Implementation still needs approval.'], references: ['proposal'] }] };
}
function metadata(html: string) { return JSON.parse(html.match(/<script type="application\/json" id="document-meta">(.*?)<\/script>/s)![1]); }

test('five stable options, exactly one context-based recommended tag, combinations validated', () => {
  for (const modes of [['briefing'], ['guide'], ['explainer'], ['decision-review'], ['explainer', 'decision-review']]) {
    const options = modeOptions(modes); assert.equal(options.length, 5);
    assert.equal(options.filter((o: any) => o.label.includes('(recommended)')).length, 1);
    assert.equal(options.find((o: any) => o.label.includes('(recommended)')).value, modes.length > 1 ? 'combine' : modes[0]);
    assert.ok(options.every((o: any) => o.description.length > 10));
  }
  for (const modes of [[], ['unknown'], ['guide', 'guide']]) assert.throws(() => validateModes(modes));
  assert.throws(() => validateModes(['guide'], 2));
});

test('actual Pi loader exposes only the focused model-only picker', async () => {
  const f = await fixture(); assert.deepEqual([...f.ext.tools.keys()], ['one_pager_mode']); assert.equal(f.ext.commands.size, 0); assert.equal(f.ext.handlers.size, 0);
  assert.equal(f.definition.exposure, 'model-only');
  assert.match(f.definition.description, /skip this tool/); assert.match(f.definition.description, /Cancel means stop/);
});

test('native single-mode choice is user-selected, not the recommendation', async () => {
  const f = await fixture(); f.scripts.push([keys.down, keys.enter]);
  const answer = await f.execute(['explainer']); assert.deepEqual(answer.details.modes, ['guide']); assert.equal(answer.details.status, 'selected');
});

test('native combined choice toggles two modes and returns one composition', async () => {
  const f = await fixture();
  f.scripts.push([keys.down, keys.down, keys.down, keys.down, keys.enter], [keys.down, keys.down, keys.space, keys.down, keys.enter, keys.down, keys.enter]);
  const answer = await f.execute(['explainer', 'decision-review']); assert.deepEqual(answer.details.modes, ['explainer', 'decision-review']);
});

test('native recommendations are not preselected and fewer than two cannot finish', async () => {
  const f = await fixture(); f.scripts.push([keys.down, keys.down, keys.down, keys.down, keys.enter], [keys.down, keys.down, keys.down, keys.down, keys.enter, keys.esc]);
  const answer = await f.execute(['explainer', 'guide']); assert.equal(answer.details.status, 'cancelled'); assert.deepEqual(answer.details.modes, []);
  const content = f.components[1].render(100).join('\n'); assert.match(content, /\[ \] Explainer/); assert.doesNotMatch(content, /\[x\]/);
});

test('escape on either question cancels without defaulting', async () => {
  for (const combine of [false, true]) {
    const f = await fixture(); if (combine) f.scripts.push([keys.down, keys.down, keys.down, keys.down, keys.enter]); f.scripts.push([keys.esc]);
    assert.equal((await f.execute()).details.status, 'cancelled');
  }
});

test('native component fits narrow widths, unicode reasons, resize and invalidation', async () => {
  const f = await fixture(); f.scripts.push([keys.esc]); await f.execute(['explainer'], 'Research on 測試 😀 and é; explain the relationships.');
  for (const width of [12, 20, 40, 80, 120]) { f.components[0].invalidate(); const lines = f.components[0].render(width); assert.ok(lines.every((line: string) => visibleWidth(line) <= width), `width ${width}`); }
});

test('abort dismisses native question and releases the serialization guard', async () => {
  const f = await fixture(); const abort = new AbortController(); const answer = f.execute(['guide'], 'A procedure.', abort.signal);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.execute(), /already open/); abort.abort(); assert.equal((await answer).details.status, 'cancelled');
  f.scripts.push([keys.enter]); assert.equal((await f.execute()).details.status, 'selected');
  assert.equal((await f.execute(['guide'], 'A procedure.', abort.signal)).details.status, 'cancelled');
});

test('RPC uses supported native dialogs, toggles and validates combined modes', async () => {
  const f = await fixture('rpc'); f.answers.push(4, 2, 4, 3, 4);
  const answer = await f.execute(['explainer', 'decision-review']); assert.deepEqual(answer.details.modes, ['explainer', 'decision-review']); assert.equal(f.components.length, 0);
  assert.equal(f.dialogs[0].options.length, 5); assert.match(f.dialogs[0].options[4], /\(recommended\)/);
});

test('RPC cancellation and noninteractive runs do not invent a selection', async () => {
  const rpc = await fixture('rpc'); rpc.answers.push(undefined); assert.equal((await rpc.execute()).details.status, 'cancelled');
  const f = await fixture('json'); const answer = await f.execute(); assert.equal(answer.details.status, 'ui-unavailable'); assert.deepEqual(answer.details.modes, []); assert.match(answer.content[0].text, /do not silently choose/); assert.equal(f.components.length, 0);
});

test('renderer creates a standalone editorial artifact with no runtime dependencies', () => {
  const html = renderDocument(spec()); assert.match(html, /^<!doctype html>/); assert.match(html, /<style>/); assert.match(html, /Expand all details/); assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<(?:script|iframe|img)[^>]*src=/); assert.doesNotMatch(html, /<link[^>]*href="(?!data:)/); assert.doesNotMatch(html, /<select/); assert.equal(metadata(html).modes[0], 'explainer');
});

test('every mode shares one embedded SVG favicon without external resources', () => {
  const input = spec();
  const icon = renderDocument(input).match(/<link rel="icon" type="image\/svg\+xml" sizes="any" href="([^"]+)"/)![1];
  assert.ok(icon.startsWith('data:image/svg+xml,'));
  const svg = decodeURIComponent(icon.slice('data:image/svg+xml,'.length));
  assert.equal(svg, readFileSync(resolve(root, 'skills/one-pager/assets/favicon.svg'), 'utf8'));
  assert.match(svg, /viewBox="0 0 32 32"/); assert.match(svg, /#126d70/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject)|\bon\w+=|href=/);
  for (const modes of [['briefing'], ['guide'], ['explainer'], ['guide', 'explainer']]) {
    assert.ok(renderDocument({ ...input, modes }).includes(`href="${icon}"`));
  }
  const source = resolve(temp(), 'proposal.md'); writeFileSync(source, '# Pending proposal');
  assert.ok(renderDocument({ ...reviewSpec(source), modes: ['decision-review'] }).includes(`href="${icon}"`));
});

test('all structured block types render together without concatenated documents', () => {
  const input = spec(); input.sections[0].blocks = [
    { type: 'text', text: 'Paragraph.' }, { type: 'list', items: ['A', 'B'] }, { type: 'table', headers: ['One', 'Two'], rows: [['A', 'B']] },
    { type: 'steps', items: [{ title: 'Do this', text: 'Check the result.' }] },
    { type: 'details', title: 'Depth', blocks: [{ type: 'text', text: 'Expanded explanation.' }] },
    { type: 'diagram', title: 'A real flow', description: 'An explained relationship.', nodes: [{ id: 'a', label: 'Input' }, { id: 'b', label: 'Output' }], edges: [{ from: 'a', to: 'b', label: 'Transforms' }] },
  ] as any;
  const html = renderDocument(input); for (const needle of ['<table>', 'class="steps"', '<svg', 'Input → Output: Transforms', 'Expanded explanation.']) assert.ok(html.includes(needle));
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
});

test('complete local source text and actual byte hashes survive Markdown rendering', () => {
  const dir = temp(), path = resolve(dir, 'proposal.md');
  const source = '# Whole proposal\r\n\r\n**Status:** Pending.\r\n\r\n| Choice | Trade-off |\r\n| --- | --- |\r\n| A | B |\r\n\r\n- Boundary\r\n\r\n```js\r\nconst x = "<tag>";\r\n```\r\n\r\nFinal clause: no implementation authorization.\r\n';
  writeFileSync(path, source); const html = renderDocument(reviewSpec('./proposal.md'), { baseDir: dir });
  assert.equal(metadata(html).sources[0].sha256, sha(Buffer.from(source))); assert.match(html, /Final clause: no implementation authorization/); assert.match(html, /Exact source text/); assert.match(html, /<table>/); assert.match(html, /&lt;tag&gt;/);
  assert.equal((html.match(/value="pending"/g) ?? []).length, 2);
});

test('changed document or specification changes review identity; generation time does not', () => {
  const dir = temp(), path = resolve(dir, 'proposal.md'); writeFileSync(path, 'Version one'); const input = reviewSpec(path);
  const first = metadata(renderDocument(input, { generatedAt: 'time one' }));
  assert.equal(first.contentHash, metadata(renderDocument(input, { generatedAt: 'time two' })).contentHash);
  writeFileSync(path, 'Version two'); assert.notEqual(first.contentHash, metadata(renderDocument(input)).contentHash);
  input.summary += ' Changed'; assert.notEqual(first.specSha256, metadata(renderDocument(input)).specSha256);
});

test('source, prose, IDs and metadata cannot break out into active HTML or script', () => {
  const dir = temp(), path = resolve(dir, 'evil.md'); const evil = '</script><script>window.pwned=true</script><img src=x onerror=alert(1)>';
  writeFileSync(path, evil); const input = reviewSpec(path); input.title = evil; input.decisions[0].id = '" onfocus="alert(1)'; input.decisions[0].proposal = evil;
  const html = renderDocument(input); assert.doesNotMatch(html, /<script>window.pwned/); assert.doesNotMatch(html, /<img src=x/); assert.ok(html.includes('&lt;/script&gt;'));
  assert.equal(metadata(html).title, evil); assert.equal((html.match(/<script/g) ?? []).length, 2);
});

test('unsafe URLs, dangling references, invented/invalid modes and malformed diagrams fail closed', () => {
  const bad: any[] = [
    { ...spec(), sources: [{ id: 'a', label: 'Bad', url: 'javascript:alert(1)' }] },
    { ...spec(), modes: ['unknown'] }, { ...spec(), modes: ['guide', 'guide'] }, { ...spec(), modes: ['decision-review'] },
    { ...spec(), sources: [{ id: 'a', label: 'Bad', url: 'https://example.org', path: 'x' }] },
    { ...spec(), sections: [{ title: 'Bad', blocks: [{ type: 'text', text: 'Bad', references: ['missing'] }] }] },
    { ...spec(), sections: [{ title: 'Bad', blocks: [{ type: 'raw-html', text: '<script>' }] }] },
    { ...spec(), sections: [{ title: 'Bad', blocks: [{ type: 'diagram', title: 'Bad', description: 'Bad', nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'missing', label: 'Bad' }] }] }] },
  ];
  bad.forEach(input => assert.throws(() => renderDocument(input)));
});

test('Markdown fallback retains unsupported content and never executes raw HTML', () => {
  const html = renderMarkdown('# Title\n\n> A quote\n\n[link](https://example.org)\n\n<div onclick="bad()">literal</div>\n\n~~~\ncode\n~~~');
  for (const needle of ['Title', '&gt; A quote', 'href="https://example.org/"', '&lt;div onclick=', '<pre><code>code']) assert.ok(html.includes(needle));
  const unsafe = renderMarkdown('[bad](javascript:alert) and [evidence](../results.md)');
  assert.doesNotMatch(unsafe, /href=/); assert.ok(unsafe.includes('evidence')); assert.ok(unsafe.includes('../results.md'));
});

test('CLI uses exclusive creation, preserves conflict and supports skill symlink invocation', () => {
  const dir = temp(), json = resolve(dir, 'briefing.json'), out = resolve(dir, 'briefing.html'); writeFileSync(json, JSON.stringify(spec()));
  const result = renderFile(json, out); assert.equal(result.path, out); assert.equal(result.sha256, sha(readFileSync(out))); assert.equal(result.bytes, readFileSync(out).length);
  assert.throws(() => renderFile(json, out), /EEXIST/);
  const conflict = resolve(dir, 'conflict.html'); symlinkSync(out, conflict); assert.throws(() => renderFile(json, conflict), /EEXIST/);
  const link = resolve(dir, 'skill'); symlinkSync(resolve(root, 'skills/one-pager'), link);
  const cli = spawnSync(process.execPath, [resolve(link, 'scripts/render.mjs'), json, resolve(dir, 'linked.html')], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.ok(existsSync(resolve(dir, 'linked.html')), 'CLI must execute through installed skill symlink'); assert.match(cli.stdout, /"sha256"/);
});

test('renderer can be imported from stdin without treating the host entry as a file', () => {
  const modulePath = new URL('../skills/one-pager/scripts/render.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], { input: `import { renderDocument } from ${JSON.stringify(modulePath)}; console.log(typeof renderDocument);`, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'function');
});

test('opt-in installation is repeatable, settings-neutral, and actual installed extension loads', async () => {
  const home = temp(); const env = { ...process.env, HOME: home }; const settings = resolve(home, '.pi/agent/settings.json'); mkdirSync(dirname(settings), { recursive: true }); writeFileSync(settings, '{"defaultModel":"keep"}\n');
  const defaultInstall = spawnSync('bash', ['install.sh'], { cwd: root, env, encoding: 'utf8' }); assert.equal(defaultInstall.status, 0, defaultInstall.stderr); assert.ok(!existsSync(resolve(home, '.pi/agent/extensions/one-pager')));
  for (let i = 0; i < 2; i++) { const result = spawnSync('bash', ['install.sh', '--with-one-pager'], { cwd: root, env, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); }
  assert.equal(readFileSync(settings, 'utf8'), '{"defaultModel":"keep"}\n');
  for (const type of ['skills', 'extensions']) assert.equal(readlinkSync(resolve(home, `.pi/agent/${type}/one-pager`)), resolve(root, type, 'one-pager'));
  const f = await fixture('json', resolve(home, '.pi/agent/extensions/one-pager/index.ts')); assert.equal((await f.execute()).details.status, 'ui-unavailable');
});

test('one-pager installer preflights file, directory and conflicting/dangling links before mutation', () => {
  for (const type of ['skills', 'extensions']) for (const kind of ['file', 'directory', 'link', 'dangling']) {
    const home = temp(), conflict = resolve(home, `.pi/agent/${type}/one-pager`); mkdirSync(dirname(conflict), { recursive: true });
    if (kind === 'file') writeFileSync(conflict, 'preserve'); else if (kind === 'directory') mkdirSync(conflict); else { const target = resolve(home, kind); if (kind === 'link') mkdirSync(target); symlinkSync(target, conflict); }
    const install = spawnSync('bash', ['install.sh', '--with-one-pager'], { cwd: root, env: { ...process.env, HOME: home }, encoding: 'utf8' });
    assert.equal(install.status, 1); assert.match(install.stderr, /Refusing to overwrite/); assert.ok(!existsSync(resolve(home, '.pi/agent/extensions/delivery-worker')));
    if (kind === 'file') assert.equal(readFileSync(conflict, 'utf8'), 'preserve'); else if (kind === 'link' || kind === 'dangling') assert.equal(readlinkSync(conflict), resolve(home, kind));
  }
});

test('Pi discovers one-pager with no diagnostics and the format scaffold is renderable', async () => {
  const { loadSkills } = await import(resolve(host, 'dist/core/skills.js'));
  const loaded = loadSkills({ cwd: root, agentDir: temp(), skillPaths: [resolve(root, 'skills/one-pager')], includeDefaults: false });
  assert.deepEqual(loaded.diagnostics, []); assert.equal(loaded.skills.length, 1);
  assert.equal(loaded.skills[0].name, 'one-pager'); assert.equal(loaded.skills[0].disableModelInvocation, false);
  const format = readFileSync(resolve(root, 'skills/one-pager/references/format.md'), 'utf8');
  const scaffold = JSON.parse(format.match(/```json\n([\s\S]*?)\n```/)![1]);
  const dir = temp(); writeFileSync(resolve(dir, 'proposal.md'), '# A scaffold source\n\nComplete fixture.');
  assert.match(renderDocument(scaffold, { baseDir: dir }), /How it works/);
});

test('skill instructions preserve explicit modes, missing-widget honesty, source fidelity and approval boundaries', () => {
  const skill = readFileSync(resolve(root, 'skills/one-pager/SKILL.md'), 'utf8');
  for (const needle of ['skip the picker', 'do not pretend text is a widget', 'entire authoritative document', 'draft position, not project approval', 'not an automatic research', 'cancelled']) assert.ok(skill.toLowerCase().includes(needle.toLowerCase()), needle);
  const example = JSON.parse(readFileSync(resolve(root, 'skills/one-pager/references/example.json'), 'utf8'));
  assert.match(renderDocument(example, { baseDir: resolve(root, 'skills/one-pager/references') }), /Presentation workflow/);
});
