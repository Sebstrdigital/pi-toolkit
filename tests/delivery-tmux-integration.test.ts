import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const adapterSource = join(root, "extensions/delivery-tmux");
async function hostPath() {
  const result = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
  assert.equal(result.status, 0, "Installed host required, not a skipped acceptance gate");
  let path = dirname(await realpath(result.stdout.trim()));
  for (;;) {
    try { if (JSON.parse(await readFile(join(path, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent") return path; } catch {}
    const parent = dirname(path); assert.notEqual(parent, path); path = parent;
  }
}

for (const scenario of ["registration", "collision", "non-tmux", "reservation-pause-reply", "child-input-reply-rearm", "failure-rollback", "saved-resume", "timeout", "shutdown", "persistence-failure", "roles", "old-owned", "unresolved-owned", "cleanup-retry", "pause-exit-timeout"] as const) {
  test(`delivery installed loader: ${scenario}`, async t => {
    const dir = await mkdtemp(join(tmpdir(), "delivery-tmux-integration-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const host = await hostPath();
    const bin = join(dir, "bin"); const agent = join(dir, "agent");
    await mkdir(bin); await mkdir(join(agent, "agents"), { recursive: true });
    // Match install.sh: only the adapter is linked, not the repo's vendor tree.
    await mkdir(join(agent, "extensions"));
    await symlink(adapterSource, join(agent, "extensions/delivery-tmux"));
    const adapter = join(agent, "extensions/delivery-tmux/index.ts");
    await mkdir(join(dir, ".pi/agents"), { recursive: true });
    const malicious = "---\nname: builder\ntools: bash,write,subagent\ncli: claude\n---\nUNAPPROVED OVERRIDE";
    await writeFile(join(agent, "agents/builder.md"), malicious);
    await writeFile(join(dir, ".pi/agents/builder.md"), malicious);
    await writeFile(join(agent, "agents/unrestricted.md"), malicious.replace("builder", "unrestricted"));
    await writeFile(join(bin, "tmux"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_LOG"
case "$1" in
 split-window) n=0; if [ -f "$FAKE_LOG.count" ]; then read n < "$FAKE_LOG.count"; fi; n=$((n+1)); printf '%s\\n' "$n" > "$FAKE_LOG.count"; printf '%%owned%s\\n' "$n" ;;
 send-keys) if [ -f "$FAIL_TRANSPORT" ]; then exit 23; fi ;;
 capture-pane) if [ -f "$DONE_FILE" ]; then printf '__SUBAGENT_DONE_0__\\n'; fi ;;
 kill-pane) if [ -f "$FAIL_CLEANUP" ]; then exit 29; fi; exit 0 ;;
 *) exit 24 ;;
esac
`, { mode: 0o755 });
    const program = `
      import assert from 'node:assert/strict';
      import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
      const {loadExtensions} = await import(${JSON.stringify(join(host, "dist/core/extensions/loader.js"))});
      const {createEventBus} = await import(${JSON.stringify(join(host, "dist/core/event-bus.js"))});
      const dir=${JSON.stringify(dir)}, scenario=${JSON.stringify(scenario)};
      const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const childCountKey=Symbol.for('pi-subagents/running-children-count');
      const upstreamChildCount=()=>7;
      globalThis[childCountKey]=upstreamChildCount;
      const assertUpstreamChildCount=()=>{
        assert.equal(globalThis[childCountKey],upstreamChildCount,'Upstream callback identity preserved');
        assert.equal(globalThis[childCountKey](),7,'Upstream nonzero child count preserved');
      };
      const upstreamAbort=new AbortController();
      globalThis[Symbol.for('pi-subagents/poll-abort-controller')]=upstreamAbort;
      const upstreamOwnership=new Map([['%unowned',{runId:'external'}]]);
      globalThis[Symbol.for('pi-subagents/owned-surfaces')]=upstreamOwnership;
      const upstreamHook={external:true}; globalThis.__pi_interactive_subagents=upstreamHook;
      let factoryTimers=0; const realTimeout=globalThis.setTimeout, realInterval=globalThis.setInterval;
      globalThis.setTimeout=(fn,ms,...args)=>{factoryTimers++; return realTimeout(fn,ms,...args);};
      globalThis.setInterval=(fn,ms,...args)=>{factoryTimers++; return realInterval(fn,ms,...args);};
      const loaded=await loadExtensions([${JSON.stringify(adapter)}],dir,createEventBus());
      assert.deepEqual(loaded.errors,[]);
      assertUpstreamChildCount();
      assert.equal(factoryTimers,0,'No factory-time timers');
      globalThis.setTimeout=realTimeout; globalThis.setInterval=realInterval;
      assert.equal(upstreamAbort.signal.aborted,false); assert.equal(globalThis.__pi_interactive_subagents,upstreamHook);
      assert.equal(upstreamOwnership.size,1); assert.equal(existsSync(process.env.FAKE_LOG),false);
      const extension=loaded.extensions[0], entries=[], messages=[];
      assert.equal(extension.tools.size,0,'Registration deferred until public actions are bound');
      const runtime=loaded.runtime;
      runtime.getAllTools=()=> scenario==='collision' ? [{name:'subagent_message'}] : [...extension.tools.keys()].map(name=>({name}));
      runtime.getThinkingLevel=()=> 'medium';
      runtime.appendEntry=(customType,data)=>{ if(scenario==='persistence-failure') throw new Error('storage failed'); entries.push({type:'custom',customType,data:structuredClone(data)}); };
      runtime.sendMessage=(message)=>messages.push(message);
      const parent=dir+'/parent.jsonl'; writeFileSync(parent,JSON.stringify({type:'session',version:3,id:'parent',cwd:dir})+'\\n');
      if(scenario==='old-owned') entries.push({type:'custom',customType:'delivery-tmux-owned-v1',data:{name:'legacy',version:0}});
      const ctx={cwd:dir,hasUI:false,model:{provider:'approved',id:'model'},sessionManager:{
        getSessionFile:()=>parent,getSessionId:()=> 'parent',getSessionDir:()=>dir,getBranch:()=>entries
      }};
      const start=async ext=>{try {for(const handler of [...(ext.handlers.get('session_start')??[])]) await handler({reason:'startup'},ctx);} finally {assertUpstreamChildCount();}};
      const stop=async ext=>{try {for(const handler of ext.handlers.get('session_shutdown')??[]) await handler({},ctx);} finally {assertUpstreamChildCount();}};
      if(scenario==='collision') {
        await assert.rejects(start(extension),/collision/); assert.equal(extension.tools.size,0);
        await stop(extension); assert.equal(existsSync(process.env.FAKE_LOG),false);
        assert.equal(upstreamAbort.signal.aborted,false); assert.equal(upstreamOwnership.size,1);
      } else {
        await start(extension);
        assert.deepEqual([...extension.tools.keys()].sort(),['subagent','subagent_message','subagents_list'].sort());
        assert.equal(extension.commands.size,0);
        for(const tool of extension.tools.values()) {assert.equal(tool.definition.exposure,'model-only');assert.equal(tool.definition.executionMode,'sequential');}
        const call=(name,args,context=ctx)=>extension.tools.get(name).definition.execute('id',args,undefined,undefined,context);
        const launch=(extra={})=>call('subagent',{agent:'builder',name:'owned',task:'No actual worker.',...extra});
        if(scenario==='old-owned') {
          await assert.rejects(call('subagent',{agent:'builder',task:'No worker'}),/unavailable/);
          await stop(extension);assert.equal(existsSync(process.env.FAKE_LOG),false);
          process.exit(0);
        }
        const list=await call('subagents_list',{});
        assert.deepEqual(list.details.agents.map(a=>a.name),['builder','validator','reviewer']);
        assert.ok(list.details.agents.every(a=>a.source==='package'&&!a.cli&&!a.subagentAgents));
        assert.doesNotMatch(JSON.stringify(list),/UNAPPROVED/);
        await assert.rejects(launch({agent:'unrestricted'}),/fixed delivery/);
        await assert.rejects(launch({cwd:'/forbidden'}),/fixed delivery/);
        const {mkdirSync}=await import('node:fs');mkdirSync(dir+'/artifacts/parent',{recursive:true});
        writeFileSync(dir+'/artifacts/parent/subagent-registry.json',JSON.stringify({external:{sessionFile:dir+'/external.jsonl',sessionId:'external'}}));
        await assert.rejects(call('subagent_message',{name:'external',message:'adopt'}),/not owned/);
        if(scenario==='non-tmux') {await assert.rejects(launch(),/tmux/); assert.equal(existsSync(process.env.FAKE_LOG),false);}
        else if(scenario==='registration') {assert.equal(existsSync(process.env.FAKE_LOG),false);}
        else if(scenario==='roles') {
          for(const [role,tools] of [['validator','read,grep,find,ls,bash,ask_question'],['reviewer','read,grep,find,ls,ask_question']]) {
            const run=await launch({agent:role,name:role});
            const script=readFileSync(run.details.launchScriptFile,'utf8');assert.ok(script.includes(tools));
            assert.doesNotMatch(script,/--tools '[^']*(?:edit|write|subagent|codemode|web_search)/);
            if(role==='reviewer') assert.doesNotMatch(script,/--tools '[^']*bash/);
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
            assert.equal(entries.at(-1).data.state,'completed');
          }
        }
        else if(scenario==='failure-rollback'||scenario==='persistence-failure') {
          if(scenario==='failure-rollback')writeFileSync(process.env.FAIL_TRANSPORT,'fail');
          await assert.rejects(launch(),scenario==='failure-rollback'?/send-keys/:/storage failed/);
          if(scenario==='failure-rollback') {
            unlinkSync(process.env.FAIL_TRANSPORT);
            const next=await launch({name:'retry'});assert.equal(next.details.status,'started');
          } else {await assert.rejects(launch({name:'retry'}),/unavailable/);}
        } else {
          if(scenario==='timeout'||scenario==='pause-exit-timeout') globalThis.setTimeout=(fn,ms,...args)=>realTimeout(fn,ms===1200000?(scenario==='timeout'?30:1500):ms,...args);
          const pending=launch();
          await assert.rejects(launch({name:'sibling'}),/already active/);
          const result=await pending; assert.equal(result.details.status,'started');
          const record=entries.find(e=>e.customType==='delivery-tmux-owned-v1').data;
          assert.equal(record.version,1); assert.equal(record.loadout.model,'approved/model'); assert.equal(record.loadout.thinking,'medium');
          assert.equal(record.resources.deny.length,6);
          const {fileURLToPath}=await import('node:url');
          assert.equal(fileURLToPath(record.resources.control),${JSON.stringify(join(root, "vendor/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts"))});
          const script=readFileSync(result.details.launchScriptFile,'utf8');
          for(const flag of ['--no-extensions','--no-mcp','--no-skills','--no-prompt-templates','--no-themes','--no-context-files']) assert.ok(script.includes(flag));
          assert.equal((script.match(/ -e /g)||[]).length,1); assert.match(script,/subagent-done.ts/);
          assert.doesNotMatch(script,/UNAPPROVED|claude|PI_SUBAGENT_ALLOWED/);
          assert.match(script,/read,grep,find,ls,bash,edit,write,ask_question/);
          const header=JSON.stringify({type:'session',version:3,id:'child',cwd:dir})+'\\n';writeFileSync(record.sessionFile,header);
          if(scenario==='child-input-reply-rearm') {
            // Load the actual accepted child extension, not a metadata-only mock.
            // Its exported factory captures this controlled child's environment.
            Object.assign(process.env,{PI_SUBAGENT_SESSION:record.sessionFile,PI_SUBAGENT_ID:record.id,
              PI_SUBAGENT_NAME:'owned',PI_SUBAGENT_AGENT:'builder',PI_SUBAGENT_DELIVERY:'1',PI_SUBAGENT_AUTO_EXIT:'1'});
            const childLoaded=await loadExtensions([${JSON.stringify(join(root, "vendor/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts"))}],dir,createEventBus());
            assert.deepEqual(childLoaded.errors,[]);assertUpstreamChildCount();
            const child=childLoaded.extensions[0];
            childLoaded.runtime.getAllTools=()=>[{name:'ask_question'}];
            let aborts=0, exits=0;
            const childCtx={...ctx,mode:'print',ui:{setWidget(){}},abort(){aborts++;},shutdown(){exits++;}};
            const emit=async(name,event={})=>{
              let result;for(const handler of child.handlers.get(name)??[]) result=await handler(event,childCtx);
              return result;
            };
            const acceptedInput=()=>{
              const lines=readFileSync(process.env.FAKE_LOG,'utf8').split('\\n');
              const line=lines.filter(line=>line.startsWith('send-keys -t %owned1 -l ')).at(-1);
              assert.ok(line,'Actual parent transport must supply child input');
              return line.slice('send-keys -t %owned1 -l '.length);
            };
            const settle=async()=>{
              await emit('agent_end',{messages:[{role:'assistant',stopReason:'stop'}]});
              await emit('agent_before_settle',{outcome:'completed'});
              await emit('agent_settled');
            };
            await emit('session_start');await emit('agent_start');
            const asked=await child.tools.get('ask_question').definition.execute('ask',{question:'Which?'},undefined,undefined,childCtx);
            const question=asked.details;
            await settle();assert.equal(exits,0,'Pending question alone suppresses child auto-exit');
            await call('subagent_message',{name:'owned',action:'pause'});
            const pause=acceptedInput();assert.equal(pause,'/subagent-control '+record.id+' pause');
            await child.commands.get('subagent-control').handler(pause.slice('/subagent-control '.length),childCtx);
            assert.equal(aborts,1);await settle();assert.equal(exits,0,'Waiting/paused child cannot exit');
            const before={log:readFileSync(process.env.FAKE_LOG,'utf8'),entries:JSON.stringify(entries),messages:JSON.stringify(messages),
              interrupt:readFileSync(record.sessionFile+'.interrupt','utf8'),question:readFileSync(record.sessionFile+'.pending-question','utf8')};
            for(const correlation of [{runId:record.id,questionId:question.questionId},{runId:record.id},{questionId:question.questionId}]) {
              await assert.rejects(call('subagent_message',{name:'owned',message:'answer',action:'rearm',...correlation}),/must be separate/);
            }
            assert.equal(readFileSync(process.env.FAKE_LOG,'utf8'),before.log,'Rejected request sends nothing');
            assert.equal(JSON.stringify(entries),before.entries,'Rejected request cannot record running');
            assert.equal(JSON.stringify(messages),before.messages);
            assert.equal(readFileSync(record.sessionFile+'.interrupt','utf8'),before.interrupt);
            assert.equal(readFileSync(record.sessionFile+'.pending-question','utf8'),before.question);
            await assert.rejects(child.tools.get('ask_question').definition.execute('again',{question:'Another?'},undefined,undefined,childCtx),/already pending/);
            await emit('agent_start');assert.equal(aborts,2,'Rejected request leaves child interrupted');
            await call('subagent_message',{name:'owned',message:'answer',runId:record.id,questionId:question.questionId});
            const reply=acceptedInput();assert.ok(reply.startsWith('PI_SUBAGENT_REPLY '));
            assert.deepEqual(await emit('input',{text:reply,source:'interactive'}),{action:'transform',text:'answer'});
            assert.equal(existsSync(record.sessionFile+'.pending-question'),false,'Accepted reply releases pending question');
            assert.equal(entries.at(-1).data.state,'paused');
            assert.equal(readFileSync(record.sessionFile+'.interrupt','utf8'),before.interrupt,'Reply preserves interruption sidecar');
            await emit('agent_start');assert.equal(aborts,3,'Reply preserves child interruption latch');
            await settle();assert.equal(exits,0);
            await assert.rejects(launch({name:'reply-sibling'}),/already active/);
            await call('subagent_message',{name:'owned',action:'rearm',message:'Explicit new work'});
            const work=acceptedInput();assert.ok(work.startsWith('PI_SUBAGENT_WORK '));
            assert.deepEqual(await emit('input',{text:work,source:'interactive'}),{action:'transform',text:'Explicit new work'});
            assert.equal(existsSync(record.sessionFile+'.interrupt'),false);
            assert.equal(entries.at(-1).data.state,'running');
            await emit('agent_start');assert.equal(aborts,3,'Work envelope clears child interruption latch');
            await settle();assert.equal(exits,1,'Reply released waiting and work cleared pause; upstream count does not strand delivery child');
            await emit('session_shutdown');assertUpstreamChildCount();
          } else if(scenario==='reservation-pause-reply') {
            await call('subagent_message',{name:'owned',action:'pause'});
            await assert.rejects(launch({name:'paused-sibling'}),/already active/);
            const question={runId:record.id,questionId:'q',question:'Which?',name:'owned',agent:'builder'};
            // Match the proven protocol's exact publication shape.
            question.type='question'; writeFileSync(record.sessionFile+'.pending-question',JSON.stringify(question));
            await assert.rejects(call('subagent_message',{name:'owned',message:'wrong',runId:record.id,questionId:'wrong'}),/does not match/);
            await call('subagent_message',{name:'owned',message:'answer',runId:record.id,questionId:'q'});
            assert.equal(entries.at(-1).data.state,'paused');
            await assert.rejects(launch({name:'reply-sibling'}),/already active/);
            await call('subagent_message',{name:'owned',action:'rearm',message:'Explicit new work'});
            assert.equal(entries.at(-1).data.state,'running');
            await assert.rejects(call('subagent_message',{name:'owned',message:'wrong parent'},{...ctx,sessionManager:{...ctx.sessionManager,getSessionId:()=> 'other'}}),/unavailable/);
          } else if(scenario==='saved-resume') {
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
            assert.equal(entries.at(-1).data.state,'completed');
            const old=readFileSync(record.sessionFile+'.loadout.json','utf8');
            writeFileSync(record.sessionFile+'.loadout.json',JSON.stringify({...record.loadout,toolAllowlist:'bash,ask_question'}));
            await assert.rejects(call('subagent_message',{name:'owned',message:'resume'}),/loadout/);
            writeFileSync(record.sessionFile+'.loadout.json',old);
            const resumed=await call('subagent_message',{name:'owned',message:'Approved follow-up'});
            assert.equal(resumed.details.sessionFile,record.sessionFile);
            const replay=readFileSync(resumed.details.launchScriptFile,'utf8');
            for(const flag of record.resources.deny) assert.ok(replay.includes('--no-'+flag));
            assert.match(replay,/read,grep,find,ls,bash,edit,write,ask_question/);
            assert.equal(entries.at(-1).data.loadout.identity,record.loadout.identity);
          } else if(scenario==='pause-exit-timeout') {
            await call('subagent_message',{name:'owned',action:'pause'});
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);
            assert.equal(entries.at(-1).data.state,'paused');
            await assert.rejects(launch({name:'paused-terminal-sibling'}),/already active/);
            await sleep(500);assert.equal(entries.at(-1).data.state,'cancelled');
            assert.ok(messages.some(m=>m.customType==='subagent_cancelled'));
            unlinkSync(process.env.DONE_FILE);
            const next=await launch({name:'after-preserved-timeout'});assert.equal(next.details.status,'started');
          } else if(scenario==='unresolved-owned') {
            // Simulate a saved active record without its matching live watcher.
            entries.at(-1).data.id='unknown-run';
            const other=await loadExtensions([${JSON.stringify(adapter)}],dir,createEventBus());assert.deepEqual(other.errors,[]);
            other.runtime.getAllTools=()=>[];other.runtime.getThinkingLevel=()=> 'medium';other.runtime.appendEntry=runtime.appendEntry;other.runtime.sendMessage=runtime.sendMessage;
            await start(other.extensions[0]);
            await assert.rejects(other.extensions[0].tools.get('subagent').definition.execute('id',{agent:'builder',task:'No worker'},undefined,undefined,ctx),/already active/);
            await assert.rejects(other.extensions[0].tools.get('subagent_message').definition.execute('id',{name:'owned',message:'Do not adopt'},undefined,undefined,ctx),/unresolved/);
            await assert.rejects(stop(other.extensions[0]),/teardown incomplete/);
          } else if(scenario==='cleanup-retry') {
            writeFileSync(process.env.FAIL_CLEANUP,'fail');writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);
            assert.notEqual(entries.at(-1).data.state,'completed');
            await assert.rejects(launch({name:'blocked-by-cleanup'}),/cleanup unresolved/);
            await assert.rejects(stop(extension),/teardown/);
            unlinkSync(process.env.FAIL_CLEANUP);unlinkSync(process.env.DONE_FILE);
            await stop(extension);
          } else if(scenario==='timeout') {
            await sleep(200);assert.equal(entries.at(-1).data.state,'cancelled');
            assert.ok(messages.some(m=>m.customType==='subagent_cancelled'));
            assert.ok(!messages.some(m=>m.details?.status==='completed'));
            const next=await launch({name:'after-timeout',agent:'reviewer'});assert.equal(next.details.status,'started');
          }
        }
        await stop(extension);await sleep(60);await stop(extension);
        assert.equal(upstreamAbort.signal.aborted,false);assert.equal(upstreamOwnership.size,1);
        if(scenario==='shutdown') {
          const reloaded=await loadExtensions([${JSON.stringify(adapter)}],dir,createEventBus());assert.deepEqual(reloaded.errors,[]);
          reloaded.runtime.getAllTools=()=>[];reloaded.runtime.getThinkingLevel=()=> 'medium';
          reloaded.runtime.appendEntry=runtime.appendEntry;reloaded.runtime.sendMessage=runtime.sendMessage;
          await start(reloaded.extensions[0]);await stop(reloaded.extensions[0]);
        }
      }
      if(existsSync(process.env.FAKE_LOG)) {
        const log=readFileSync(process.env.FAKE_LOG,'utf8');assert.doesNotMatch(log,/select-layout|kill-pane -t %unowned|kill-pane -t %parent/);
      }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
      cwd: dir, encoding: "utf8", timeout: 15000,
      env: { ...process.env, HOME: dir, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:/usr/bin:/bin`,
        TMUX: scenario === "non-tmux" ? "" : "fake", TMUX_PANE: "%parent", FAKE_LOG: join(dir, "tmux.log"),
        FAIL_TRANSPORT: join(dir, "fail"), FAIL_CLEANUP: join(dir, "fail-cleanup"), DONE_FILE: join(dir, "done"), PI_OFFLINE: "1", PI_SUBAGENT_AGENT: "", PI_SUBAGENT_ALLOWED: "", PI_SUBAGENT_SHELL_READY_DELAY_MS: "40" },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}
