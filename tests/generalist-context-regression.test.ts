import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, symlink, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as helper from '../scripts/generalist-context.mjs';
import pace from '../extensions/pace-alias/index.ts';
import { validatePaceCommands } from '../extensions/pace-alias/index.ts';
const root = new URL('../', import.meta.url).pathname;
async function fixture(t: any) {
  const dir = await mkdtemp(join(tmpdir(), 'context-regression-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = (...args: string[]) => { const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  await writeFile(join(dir, 'a.py'), 'value = 1\n'); git('add', '.'); git('commit', '-qm', 'initial');
  const state = { version: 2, repositories: {} };
  const record = () => helper.saveRecord(dir, { status: 'success', coverage: 'complete', revision: git('rev-parse', 'HEAD'), branch: git('symbolic-ref', '--short', 'HEAD'), snapshot: helper.captureSourceSnapshot(dir) }, state);
  return { dir, git, state, record };
}
test('deleted tracked source is counted without reading outside the repository', async t => {
  const f = await fixture(t); f.record(); await rm(join(f.dir, 'a.py'));
  const r = helper.inspectReadiness(f.dir, f.state, { relevantPaths: ['a.py'] });
  assert.equal(r.state, 'potentially-stale'); assert.equal(r.changedSourceFiles, 1); assert.equal(r.diskVerificationRequired, true);
});
test('indexed dirty source is not counted again when another source changes', async t => {
  const f = await fixture(t); await writeFile(join(f.dir, 'a.py'), 'value = 2\n'); f.record();
  await writeFile(join(f.dir, 'b.py'), 'value = 3\n'); const r = helper.inspectReadiness(f.dir, f.state);
  assert.deepEqual(r.changedPaths, ['b.py']); assert.equal(r.changedSourceFiles, 1); assert.equal(r.needsPermission, false, 'below-threshold staleness is reported without a refresh prompt');
});
test('failed refresh invalidates cached success and committing indexed dirty bytes does not recount them', async t => {
  const f = await fixture(t); await writeFile(join(f.dir, 'a.py'), 'value = 2\n'); f.record();
  f.git('add', '.'); f.git('commit', '-qm', 'indexed dirty bytes');
  assert.equal(helper.inspectReadiness(f.dir, f.state).changedSourceFiles, 0);
  helper.recordIndexFailure(f.dir, 'partial refresh', f.state); assert.equal(helper.inspectReadiness(f.dir, f.state).state, 'failed');
});
test('five non-source commits still suggest metadata refresh', async t => {
  const f = await fixture(t); f.record();
  for (let i=0; i<5; i++) { await writeFile(join(f.dir, 'note.md'), String(i)); f.git('add', '.'); f.git('commit', '-qm', 'documentation'); }
  const r = helper.inspectReadiness(f.dir, f.state); assert.equal(r.state, 'potentially-stale'); assert.equal(r.commits, 5); assert.equal(r.changedSourceFiles, 0); assert.equal(r.refreshSuggested, true);
});
test('snapshots are order-independent and source symlinks cannot read outside scope', async t => {
  const f = await fixture(t); await writeFile(join(f.dir, 'b.py'), 'value = 2\n'); f.record();
  const record: any = Object.values(f.state.repositories)[0]; record.snapshot = Object.fromEntries(Object.entries(record.snapshot).reverse());
  assert.equal(helper.inspectReadiness(f.dir, f.state).state, 'current');
  await symlink(join(f.dir, 'note.md'), join(f.dir, 'linked.py')); await writeFile(join(f.dir, 'note.md'), 'not a source grant');
  assert.equal(helper.captureSourceSnapshot(f.dir), undefined, 'do not follow source symlinks');
});
test('current and unavailable indexes do not request indexing permission', async t => {
  const f = await fixture(t); f.record(); assert.equal(helper.inspectReadiness(f.dir, f.state).needsPermission, false);
  assert.equal(helper.inspectReadiness(f.dir, f.state, { serverAvailable: false }).needsPermission, false);
});
test('missing-skill error is visible without UI, and uppercase alias collisions are preserved', async () => {
  assert.equal(validatePaceCommands([{name:'PACE'}, {name:'skill:addy-engineering'}]), 'collision');
  let input: any; (pace as any)({ on: (_name: string, handler: any) => input = handler, getCommands: () => [] });
  const errors: string[] = []; const original = console.error; console.error = value => errors.push(String(value));
  try { const r = await input({text:'/pace task',source:'user'}, {hasUI:false, ui:{notify:()=>{}}}); assert.equal(r.action,'handled'); assert.match(errors.join(' '), /requires.*addy-engineering/); }
  finally { console.error = original; }
});
test('installer and generator use the same real symbol allowlist and reject normalized server collisions', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'context-install-regression-')); t.after(() => rm(dir,{recursive:true,force:true}));
  const server = join(dir, 'package/build/server.js'); await mkdir(join(dir,'package/build'),{recursive:true}); await writeFile(server,'// fixture');
  await writeFile(join(dir,'package/package.json'),JSON.stringify({name:'context-mode',version:'1.0.169'}));
  const install = () => spawnSync('node',[join(root,'scripts/install-options.mjs'),`--with-generalist-context=${server}`],{env:{...process.env,HOME:dir},encoding:'utf8'});
  let r = install(); assert.equal(r.status,0,r.stderr); const cfg = JSON.parse(await readFile(join(dir,'.pi/agent/mcp.json'),'utf8'));
  assert.deepEqual(cfg.mcpServers.jcodemunch.toolExposure,helper.mcpConfig({contextServer:server}).mcpServers.jcodemunch.toolExposure);
  await writeFile(join(dir,'.pi/agent/mcp.json'),JSON.stringify({mcpServers:{'context-mode':{command:'keep'}}})); r = install(); assert.equal(r.status,1); assert.match(r.stderr,/Refusing.*MCP server/);
});
