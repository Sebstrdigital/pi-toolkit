import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, mkdtempSync, readlinkSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const host=resolve(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'@earendil-works/pi-coding-agent');
const {loadExtensions}=await import(resolve(host,'dist/core/extensions/loader.js'));
const {createEventBus}=await import(resolve(host,'dist/core/event-bus.js'));
const {visibleWidth}=await import(resolve(host,'node_modules/@earendil-works/pi-tui/dist/index.js'));
const path=resolve(root,'extensions/lean-progress/index.ts');
async function fixture(ui=false,tools:any[]=[],commands:any[]=[]) {
 const loaded=await loadExtensions([path],root,createEventBus());assert.deepEqual(loaded.errors,[]);
 const ext=loaded.extensions[0];const entries:any[]=[];let branch=entries;const widgets:any[]=[];
 loaded.runtime.appendEntry=(customType:any,data:any)=>entries.push({type:'custom',customType,data:structuredClone(data)});
 loaded.runtime.getAllTools=()=>tools;loaded.runtime.getCommands=()=>commands;
 const ctx:any={cwd:root,hasUI:ui,mode:ui?'tui':'json',sessionManager:{getBranch:()=>branch},ui:{setWidget:(key:any,factory:any,options:any)=>widgets.push({key,factory,options}),notify:()=>{}}};
 const emit=async(name:string,event:any={})=>{let result;for(const h of ext.handlers.get(name)??[])result=await h(event,ctx);return result;};
 const write=(items:any)=>ext.tools.get('todo_write').definition.execute('id',{items},undefined,undefined,ctx);
 return {loaded,ext,entries,widgets,ctx,emit,write,setBranch:(b:any[])=>branch=b};
}
const items=[{content:'accepted prerequisite',status:'completed'},{content:'active 測試 😀 é',status:'in_progress'},...['blocked','paused','cancelled','abandoned'].map(s=>({content:`[${s}] retained reason`,status:'pending'}))];
test('lossless reviewed registry files reproduce from source without execution artifacts',()=>{
 const manifest=JSON.parse(readFileSync(resolve(root,'vendor/pify-todo/INTEGRITY.json'),'utf8'));assert.equal(Object.keys(manifest).length,8);
 for(const [p,h] of Object.entries(manifest))assert.equal(createHash('sha256').update(readFileSync(resolve(root,'vendor/pify-todo',p))).digest('hex'),h);
 const pkg=JSON.parse(readFileSync(resolve(root,'vendor/pify-todo/package.json'),'utf8'));assert.equal(pkg.version,'0.3.0');assert.equal(pkg.dependencies,undefined);assert.equal(pkg.scripts.install,undefined);
});
test('actual installed loader activates exactly one guarded controller, repeated startup no duplicate handlers, no UI',async()=>{
 const f=await fixture();assert.equal(f.ext.tools.size,0);await f.emit('session_start');assert.equal(f.ext.tools.size,1);assert.equal(f.ext.commands.size,1);
 const count=f.ext.handlers.get('session_tree').length;await f.emit('session_start');assert.equal(f.ext.handlers.get('session_tree').length,count);
 assert.equal((await f.write(items)).details.count,6);assert.equal(f.entries.length,1);assert.equal(f.widgets.length,0);
 await assert.rejects(f.write([{content:'a',status:'in_progress'},{content:'b',status:'in_progress'}]),/at most one active progress row/);assert.equal(f.entries.length,1);
 const bad=await f.write([{content:''},{content:'invalid',status:'oops'},...Array.from({length:35},()=>({content:'row',status:'pending'}))]);assert.ok(bad.details.warnings.length>=3);assert.ok(bad.details.count<=30);
});
test('registered guidance permits truthful zero-active snapshots while execution rejects multiple active rows',async()=>{
 const f=await fixture();await f.emit('session_start');
 const description=f.ext.tools.get('todo_write').definition.description;
 assert.match(description,/at most one in_progress/);
 assert.match(description,/zero is allowed when no work is active/);
 for(const state of ['blocked','paused','finished'])assert.ok(description.includes(state));
 assert.doesNotMatch(description,/exactly one/);
 assert.match(description,/only lead-accepted work is completed/);
 assert.match(description,/unresolved blocked\/paused\/cancelled\/abandoned rows remain pending with explicit labels and reasons/);
 assert.match(description,/Worker completion is not acceptance/);
 const pending=['blocked','paused','cancelled','abandoned'].map(state=>({content:`[${state}] retained unresolved reason`,status:'pending'}));
 const completed=[{content:'lead-accepted work; evidence checked',status:'completed'}];
 for(const snapshot of [pending,completed,[]]){
  const before=f.entries.length;
  const result=await f.write(snapshot);
  assert.equal(result.details.count,snapshot.length);
  assert.equal(f.entries.length,before+1);
  assert.equal(f.entries.at(-1).customType,'todo-state');
  assert.deepEqual(f.entries.at(-1).data.items,snapshot);
 }
 const before=structuredClone(f.entries);
 await assert.rejects(f.write([{content:'a',status:'in_progress'},{content:'b',status:'in_progress'}]),/at most one active progress row; zero is allowed when no work is active/);
 assert.deepEqual(f.entries,before,'rejected parallel work must not replace the truthful snapshot');
});
test('actual installer-created SYMLINK path loads one controller and writes state without upstream resources',async()=>{
 const home=mkdtempSync(resolve(tmpdir(),'pi-progress-symlink-'));
 const agent=resolve(home,'.pi/agent');
 // Record exact fixture ownership before any assertion; retain it even on failure.
 console.log(JSON.stringify({fixtureRetained:home,installerCommand:'bash install.sh --with-progress --hide-thinking'}));
 const installed=spawnSync('bash',['install.sh','--with-progress','--hide-thinking'],{cwd:root,env:{...process.env,HOME:home,PI_CODING_AGENT_DIR:agent},encoding:'utf8',timeout:10000});
 assert.equal(installed.status,0,installed.stderr);
 const installedPath=resolve(agent,'extensions/lean-progress/index.ts');
 assert.equal(readlinkSync(resolve(agent,'extensions/lean-progress')),resolve(root,'extensions/lean-progress'));
 assert.equal(JSON.parse(readFileSync(resolve(agent,'settings.json'),'utf8')).hideThinkingBlock,true);
 assert.deepEqual(readdirSync(resolve(agent,'extensions')).sort(),['delivery-worker','lean-progress']);
 assert.ok(!existsSync(resolve(agent,'skills/todo')));
 assert.ok(!existsSync(resolve(agent,'npm')));
 assert.ok(!existsSync(resolve(root,'vendor/pify-todo/node_modules')));
 // Deliberately pass the installed path, NOT its realpath, to the actual Pi loader.
 const loaded=await loadExtensions([installedPath],root,createEventBus());
 console.log(JSON.stringify({requestedSymlinkPath:installedPath,realSource:realpathSync(installedPath),errors:loaded.errors,extensionCount:loaded.extensions.length}));
 assert.deepEqual(loaded.errors,[]);assert.equal(loaded.extensions.length,1);
 const ext=loaded.extensions[0],entries:any[]=[];
 assert.equal(ext.tools.size,0);assert.equal(ext.commands.size,0);
 loaded.runtime.getAllTools=()=>[];loaded.runtime.getCommands=()=>[];
 loaded.runtime.appendEntry=(customType:any,data:any)=>entries.push({type:'custom',customType,data:structuredClone(data)});
 const ctx:any={cwd:root,hasUI:false,mode:'json',sessionManager:{getBranch:()=>entries},ui:{setWidget:()=>{throw Error('unexpected UI')},notify:()=>{throw Error('unexpected UI')}}};
 for(const h of ext.handlers.get('session_start')??[])await h({},ctx);
 assert.deepEqual([...ext.tools.keys()],['todo_write']);assert.deepEqual([...ext.commands.keys()],['todos']);
 const result=await ext.tools.get('todo_write').definition.execute('installed',{items},undefined,undefined,ctx);
 assert.equal(result.details.count,items.length);assert.equal(entries.length,1);assert.equal(entries[0].customType,'todo-state');assert.deepEqual(entries[0].data.items,items);
 console.log(JSON.stringify({outcome:'PASS',tools:[...ext.tools.keys()],commands:[...ext.commands.keys()],stateEntries:entries.length,fixtureRetained:home}));
 for(const h of ext.handlers.get('session_shutdown')??[])await h({},ctx);
});
test('known todo tool and command collisions fail before activation',async()=>{
 for(const [tools,commands] of [[[{name:'todo_write'}],[]],[[{name:'todo'}],[]],[[],[{name:'todos'}]]]){
  const f=await fixture(false,tools,commands);await assert.rejects(f.emit('session_start'),/Conflicting/);assert.equal(f.ext.tools.size,0);assert.equal(f.entries.length,0);
 }
});
test('branch-local reload, one-shot supported compaction/tree recovery and clear errors',async()=>{
 const f=await fixture();await f.emit('session_start');await f.write(items);
 await f.emit('session_compact');const restored=await f.emit('before_agent_start');assert.equal(restored.message.display,false);assert.match(restored.message.content,/\[blocked\]/);assert.equal(await f.emit('before_agent_start'),undefined);
 const reload=await fixture();reload.setBranch(f.entries);await reload.emit('session_start');assert.equal(await reload.emit('before_agent_start'),undefined,'reload cannot restore transient compact flag');
 await reload.emit('session_tree',{summaryEntry:{}});assert.match((await reload.emit('before_agent_start')).message.content,/accepted prerequisite/);
 reload.setBranch([]);await reload.emit('session_tree');await reload.emit('session_compact');assert.equal(await reload.emit('before_agent_start'),undefined);
 await reload.ext.commands.get('todos').handler('unknown',reload.ctx);await reload.write(items);await reload.ext.commands.get('todos').handler('clear',reload.ctx);assert.deepEqual(reload.entries.at(-1).data.items,[]);
 const next=await reload.write(items);assert.match(next.content[0].text,/user cleared/);
});
test('actual host Text fits narrow/wide Unicode and retains explicit state labels; shutdown clears',async()=>{
 const f=await fixture(true);await f.emit('session_start');await f.write(items);const widget=f.widgets.at(-1);assert.equal(widget.options.placement,'aboveEditor');
 const text=widget.factory({}, {fg:(_c:any,s:any)=>s,bold:(s:any)=>s});
 for(const width of [12,20,54,100]) {const lines=text.render(width);assert.ok(lines.every((s:any)=>visibleWidth(s)<=width));console.log(JSON.stringify({width,lines}));}
 const wide=text.render(100).join('\n');for(const label of ['✔','▸','[blocked]','[paused]','[cancelled]','[abandoned]'])assert.ok(wide.includes(label));
 await f.emit('session_shutdown');assert.equal(f.widgets.at(-1).factory,undefined);
});
