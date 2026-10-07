import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, readlink, lstat, copyFile, unlink, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function fixture() {const home=await mkdtemp(resolve(tmpdir(),'pi-progress-install-'));const agent=resolve(home,'.pi/agent');await mkdir(agent,{recursive:true});return {home,agent};}
function install(home:string,...flags:string[]) {return spawnSync('bash',[resolve(root,'install.sh'),...flags],{env:{...process.env,HOME:home},encoding:'utf8',timeout:10000});}
const base=' {\n "defaultProvider": "keep", "defaultModel":"keep-model",\n "defaultThinkingLevel": "xhigh", "modelThinkingLevels":{"p/m":"high"},\n "packages": ["npm:unrelated@1"], "extensions": ["./other.ts"],\n "trust":{"nested":true}, "hideThinkingBlock" : false, "other": [1,{"a":"}\\\""}]\n}\n';
test('opt-in settings merge preserves unrelated bytes/models/reasoning, backup permissions and idempotence',async()=>{
 const f=await fixture();const settings=resolve(f.agent,'settings.json');await writeFile(settings,base);await chmod(settings,0o640);
 const result=install(f.home,'--with-progress','--hide-thinking','--with-delivery-tmux');assert.equal(result.status,0,result.stderr);
 assert.equal(await readFile(settings,'utf8'),base.replace('"hideThinkingBlock" : false','"hideThinkingBlock" : true'));
 assert.equal(await readlink(resolve(f.agent,'extensions/lean-progress')),resolve(root,'extensions/lean-progress'));
 assert.equal(await readlink(resolve(f.agent,'skills/delivery')),resolve(root,'skills/delivery'));
 await assert.rejects(lstat(resolve(f.agent,'skills/todo')),{code:'ENOENT'});
 const backups=(await readdir(f.agent)).filter(n=>n.startsWith('toolkit-backup-'));assert.equal(backups.length,1);
 const backup=resolve(f.agent,backups[0]);assert.equal((await stat(backup)).mode & 0o777,0o700);assert.equal((await stat(resolve(backup,'settings.json'))).mode & 0o777,0o640);assert.equal(await readFile(resolve(backup,'settings.json'),'utf8'),base);
 assert.equal(install(f.home,'--with-progress','--hide-thinking','--with-delivery-tmux').status,0);assert.deepEqual((await readdir(f.agent)).filter(n=>n.startsWith('toolkit-backup-')),backups);
 // Replay documented exact-owned rollback in fixture only.
 const manifest=JSON.parse(await readFile(resolve(backup,'manifest.json'),'utf8'));
 for(const [source,target] of manifest.newLinks){assert.equal(await readlink(target),source);await unlink(target);}
 await copyFile(resolve(backup,'settings.json'),settings);assert.equal(await readFile(settings,'utf8'),base);
});
test('default and progress-only options leave settings byte-exact; display-only creates no controller',async()=>{
 for(const flags of [[],['--with-progress']]){const f=await fixture();await writeFile(resolve(f.agent,'settings.json'),base);assert.equal(install(f.home,...flags).status,0);assert.equal(await readFile(resolve(f.agent,'settings.json'),'utf8'),base);}
 const f=await fixture();assert.equal(install(f.home,'--hide-thinking').status,0);assert.equal(JSON.parse(await readFile(resolve(f.agent,'settings.json'),'utf8')).hideThinkingBlock,true);await assert.rejects(lstat(resolve(f.agent,'extensions/lean-progress')),{code:'ENOENT'});
});
test('all link conflicts preflight before partial changes, including late skill and optional progress destinations',async()=>{
 for(const target of ['skills/discovery','extensions/delivery-worker','extensions/lean-progress']){
 const f=await fixture();await mkdir(resolve(f.agent,target,'..'),{recursive:true});await writeFile(resolve(f.agent,target),'preserve');await writeFile(resolve(f.agent,'settings.json'),base);
 const result=install(f.home,'--with-progress','--hide-thinking');assert.equal(result.status,1);assert.match(result.stderr,/Refusing to overwrite/);assert.equal(await readFile(resolve(f.agent,target),'utf8'),'preserve');assert.equal(await readFile(resolve(f.agent,'settings.json'),'utf8'),base);await assert.rejects(lstat(resolve(f.agent,'AGENTS.md')),{code:'ENOENT'});assert.ok(!(await readdir(f.agent)).some(n=>n.startsWith('toolkit-backup-')));
 }
});
test('malformed settings and duplicate/conflicting registrations fail without mutations',async()=>{
 for(const settings of ['not json','[]','{"packages":["npm:@pify/todo@0.3.0"]}','{"packages":[{"source":"/some/pify-todo","skills":[]}]}','{"extensions":["./todo.ts"]}','{"packages":{}}']){
 const f=await fixture();await writeFile(resolve(f.agent,'settings.json'),settings);const result=install(f.home,'--with-progress','--hide-thinking');assert.equal(result.status,1);assert.equal(await readFile(resolve(f.agent,'settings.json'),'utf8'),settings);await assert.rejects(lstat(resolve(f.agent,'AGENTS.md')),{code:'ENOENT'});
 }
});
