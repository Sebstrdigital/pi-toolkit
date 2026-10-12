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

for (const scenario of ["team-unbounded", "team-no-repair-quota", "developer-escalation", "scout-escalation", "team-escalation", "developer-escalation-failure", "scout-escalation-failure", "team-escalation-failure", "developer-escalation-persistence", "developer-execution-budget"]) {
  test(`fresh same-role escalation: ${scenario}`, async t => {
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
    await writeFile(join(agent, "agents/scout.md"), malicious.replaceAll("builder", "scout"));
    await writeFile(join(dir, ".pi/agents/scout.md"), malicious.replaceAll("builder", "scout"));
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
      const dir=${JSON.stringify(dir)}, variant=${JSON.stringify(scenario)};
      const developer=variant.startsWith('developer-'), scout=variant.startsWith('scout-'), scenario=(developer||scout)?variant.slice(variant.indexOf('-')+1):variant;
      const scoutAuthority={discoveryAuthorityRef:'conversation#bounded-discovery',question:'Find fixture evidence',sources:[dir+'/parent.jsonl'],rules:'Read-only fixture',exclusions:'No shell/mutation/web/nesting',budget:'One bounded lookup',resultContract:'Cite paths and sections; findings, uncertainty, gaps'};
      const authority={selection:'Developer',approvalRef:'user-selection-and-task-approval#1',packetRef:'compact-packet#sha256',
        packet:{purpose:'Customer outcome',scope:'Only fixture edits; no commit/install/outward actions',allowedPaths:dir+'/fixture',
          projectRules:'No delegation. Read supplied rules.',baseline:'Fixture baseline revision',validation:'node --test fixture',acceptance:'Parent inspects result',task:'No actual worker.'}};
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
      runtime.getAllTools=()=> scenario==='collision' ? [{name:scout?'scout':developer?'developer':'subagent_message'}] : [...extension.tools.keys()].map(name=>({name}));
      runtime.getThinkingLevel=()=> 'medium';
      runtime.appendEntry=(customType,data)=>{ if(scenario==='persistence-failure') throw new Error('storage failed'); entries.push({type:'custom',customType,data:structuredClone(data)}); };
      runtime.sendMessage=(message)=>messages.push(message);
      const parent=dir+'/parent.jsonl'; writeFileSync(parent,JSON.stringify({type:'session',version:3,id:'parent',cwd:dir})+'\\n');
      if(scenario==='old-owned') entries.push({type:'custom',customType:'delivery-tmux-owned-v1',data:{name:'legacy',version:0}});
      const models=['gpt-5.4-mini','gpt-5.6-terra','gpt-6.1-sol','gpt-6-luna'].map(id=>({provider:'openai',id,api:'openai-responses',reasoning:true,thinkingLevelMap:{off:id==='gpt-6.1-sol'?null:'none',minimal:null,xhigh:'xhigh'}}));
      models.push({provider:'approved',id:'model',reasoning:true});
      const {ModelRegistry}=await import(${JSON.stringify(join(host, "dist/core/model-registry.js"))});
      const registry=new ModelRegistry({getError:()=>undefined,getModel:(provider,id)=>models.find(m=>m.provider===provider&&m.id===id),getAvailableSnapshot:()=>models});
      const ctx={cwd:dir,hasUI:false,model:{provider:'openai',id:'gpt-6.1-sol'},modelRegistry:registry,sessionManager:{
        getSessionFile:()=>parent,getSessionId:()=> 'parent',getSessionDir:()=>dir,getEntries:()=>entries,getBranch:()=>entries
      }};
      const start=async ext=>{try {for(const handler of [...(ext.handlers.get('session_start')??[])]) await handler({reason:'startup'},ctx);} finally {assertUpstreamChildCount();}};
      const stop=async ext=>{try {for(const handler of ext.handlers.get('session_shutdown')??[]) await handler({},ctx);} finally {assertUpstreamChildCount();}};
      if(scenario==='collision') {
        await assert.rejects(start(extension),/collision/); assert.equal(extension.tools.size,0);
        await stop(extension); assert.equal(existsSync(process.env.FAKE_LOG),false);
        assert.equal(upstreamAbort.signal.aborted,false); assert.equal(upstreamOwnership.size,1);
      } else {
        await start(extension);
        assert.deepEqual([...extension.tools.keys()].sort(),['developer','scout','subagent','subagent_message','subagents_list'].sort());
        assert.equal(extension.commands.size,0);
        for(const tool of extension.tools.values()) {assert.equal(tool.definition.exposure,'model-only');assert.equal(tool.definition.executionMode,'parallel');}
        const rawCall=(name,args,context=ctx)=>extension.tools.get(name).definition.execute('id',args,undefined,undefined,context);

        const leaseTimers=[], leaseCallbacks=[];let executionNow=0;
        if(scenario==='execution-budget') Object.defineProperty(performance,'now',{value:()=>executionNow,configurable:true});
        globalThis.setTimeout=(fn,ms,...args)=>{
          if(ms>=60000) {leaseTimers.push(ms);leaseCallbacks.push(fn);}
          return realTimeout(fn,scenario==='execution-budget'&&ms>=60000?2147483647:ms,...args);
        };
        const binding={id:'assignment-1',scopeRef:'scope#1',approvalRef:scout?scoutAuthority.discoveryAuthorityRef:authority.approvalRef,
          packetRef:scout?scoutAuthority.discoveryAuthorityRef:authority.packetRef,effortMinutes:30,repairAttempts:2};
        if(variant==='team-no-repair-quota'||variant==='team-unbounded') delete binding.repairAttempts;
        if(variant==='team-unbounded') delete binding.effortMinutes;
        const launch=(name,extra={})=>scout?rawCall('scout',{...scoutAuthority,name,assignment:binding,...extra}):
          developer?rawCall('developer',{...authority,name,assignment:binding,...extra}):
          rawCall('subagent',{agent:'builder',task:'Remaining approved work',name,assignment:binding,...extra});
        const owned=()=>entries.filter(e=>e.customType==='delivery-tmux-owned-v1').at(-1).data;
        const ledger=()=>entries.filter(e=>e.customType==='delivery-tmux-lineage-v1').at(-1).data;
        const log=()=>existsSync(process.env.FAKE_LOG)?readFileSync(process.env.FAKE_LOG,'utf8'):'';
        const reject=async(extra,pattern=/./)=>{const before=log();await assert.rejects(launch('replacement',extra),pattern);assert.equal(log(),before,'No allocation on rejection');};
        await reject({assignment:{...binding,effortMinutes:0}},/binding/);
        await reject({assignment:{...binding,effortMinutes:Number.MAX_VALUE}},/binding/);assert.equal(log(),'');
        const first=launch('original');
        await assert.rejects(launch('concurrent-initial',{assignment:{...binding,id:'sibling-assignment'}}),/active/);
        assert.equal((await first).details.status,'started');
        assert.equal(ledger().consumed,false);const original=structuredClone(owned());
        if(scenario==='execution-budget') {
          assert.equal(leaseTimers.at(-1),1800000,'Declared 30-minute grant is not cut to 20');
          executionNow+=120000;
          const pending={type:'question',runId:original.id,questionId:'q',question:'Permission?',name:'original',agent:'builder'};
          writeFileSync(original.sessionFile+'.pending-question',JSON.stringify(pending));
          await sleep(1100);assert.equal(owned().executionMs,120000);
          executionNow+=6*3600000;
          await assert.rejects(rawCall('subagent_message',{name:'original',runId:original.id,questionId:'wrong',message:'No'}),/match/);
          assert.equal(owned().executionMs,120000,'Waiting is not worker execution');
          await rawCall('subagent_message',{name:'original',action:'pause'});await sleep(1100);
          await rawCall('subagent_message',{name:'original',runId:original.id,questionId:'q',message:'Reply does not rearm'});
          unlinkSync(original.sessionFile+'.pending-question');executionNow+=3600000;await sleep(1100);
          assert.equal(owned().state,'paused');assert.equal(owned().executionMs,120000);
          await rawCall('subagent_message',{name:'original',action:'rearm',message:'Approved remaining work',approvalRef:authority.approvalRef,packetRef:authority.packetRef});
          unlinkSync(original.sessionFile+'.interrupt');await sleep(1100);
          executionNow+=180000;
          await rawCall('subagent_message',{name:'original',action:'stop'});await sleep(100);
          assert.equal(owned().executionMs,300000);assert.equal(owned().state,'cancelled');
          const before=log();
          const overclaim={from:'original',runId:original.id,reason:'failed-bounded-repair',
            partialSources:[{path:parent,sha256:(await import('node:crypto')).createHash('sha256').update(readFileSync(parent)).digest('hex')}],
            findingsRef:'findings#1',failureEvidenceRef:'failure#1',remainingCriteria:'Original only',remainingEffortMinutes:26,
            remainingRepairAttempts:1,terminalState:'cancelled',resourcesReleased:true,resourceEvidenceRef:'teardown#1'};
          await assert.rejects(launch('overclaim',{escalation:overclaim}),/remaining effort/);assert.equal(log(),before);
          writeFileSync(original.sessionFile,JSON.stringify({type:'session',version:3,id:'child',cwd:dir})+'\\n');
          ctx.sessionManager.getBranch=()=>[];await start(extension);
          const resumed=await rawCall('subagent_message',{name:'original',message:'Reconciled remaining approved work',approvalRef:authority.approvalRef,packetRef:authority.packetRef});
          assert.equal(resumed.details.status,'started');assert.equal(leaseTimers.at(-1),1500000,'Reload/resume keeps only remaining 25 minutes');
          executionNow+=1500000;leaseCallbacks.at(-1)();await sleep(100);
          assert.equal(owned().state,'cancelled');assert.equal(owned().executionMs,1800000);
          const afterTimeout=log();await assert.rejects(rawCall('subagent_message',{name:'original',message:'Cannot reset',approvalRef:authority.approvalRef,packetRef:authority.packetRef}),/exhausted/);
          assert.equal(log(),afterTimeout);assert.ok(!messages.some(m=>m.details?.status==='completed'));
          await stop(extension);
          const saved=structuredClone(entries);
          for(const corruption of ['missing','regressed']) {
            entries.splice(0,entries.length,...structuredClone(saved));
            const records=entries.filter(e=>e.customType==='delivery-tmux-owned-v1');
            if(corruption==='missing') for(const e of records) {delete e.data.executionMs;delete e.data.runExecutionMs;}
            else records.at(-1).data.executionMs=1;
            await start(extension);
            await assert.rejects(rawCall('subagent_message',{name:'original',message:'No reset from history',approvalRef:authority.approvalRef,packetRef:authority.packetRef}),/unmeasured|unavailable/);
            assert.equal(log(),afterTimeout);
          }
          entries.splice(0,entries.length,...saved);await start(extension);await stop(extension);process.exit(0);
        }
        const h={from:'original',runId:original.id,reason:variant.endsWith('failure')?'reasoning-complexity':'failed-bounded-repair',
          partialSources:[{path:parent,sha256:(await import('node:crypto')).createHash('sha256').update(readFileSync(parent)).digest('hex')}],
          findingsRef:'findings#1',failureEvidenceRef:'failed-bounded-repair#1',remainingCriteria:'Original acceptance only',
          remainingEffortMinutes:12,remainingRepairAttempts:1,terminalState:'cancelled',resourcesReleased:true,resourceEvidenceRef:'teardown#1'};
        if(variant==='team-no-repair-quota'||variant==='team-unbounded') delete h.remainingRepairAttempts;
        if(variant==='team-unbounded') delete h.remainingEffortMinutes;
        await reject({escalation:h},/terminal/);
        // A pending question is still running ownership; pause also retains it.
        writeFileSync(original.sessionFile+'.pending-question',JSON.stringify({type:'question',runId:original.id,questionId:'q',question:'Which?',name:'original',agent:scout?'scout':'builder'}));
        await reject({escalation:h},/terminal/);
        await rawCall('subagent_message',{name:'original',action:'pause'});
        await reject({escalation:h},/terminal/);
        unlinkSync(original.sessionFile+'.pending-question');
        await assert.rejects(rawCall('subagent',{agent:'reviewer',name:'collision',task:'No worker'}),/active/);
        await rawCall('subagent_message',{name:'original',action:'stop'});await sleep(100);
        assert.equal(owned().state,'cancelled');
        for(const extra of [
          ...['scopeRef','approvalRef','packetRef'].map(k=>({assignment:{...binding,[k]:'changed'},escalation:h})),
          {escalation:{...h,runId:'other'}},{escalation:{...h,from:'foreign'}},
          ...(binding.effortMinutes===undefined?[]:[{escalation:{...h,remainingEffortMinutes:31}},{escalation:(({remainingEffortMinutes,...rest})=>rest)(h)}]),...(binding.repairAttempts===undefined?[]:[{escalation:{...h,remainingRepairAttempts:2}},{escalation:(({remainingRepairAttempts,...rest})=>rest)(h)}]),
          {escalation:{...h,resourcesReleased:false}},{escalation:{...h,reason:'red-test'}},
          {escalation:{...h,partialSources:[{path:parent,sha256:'0'.repeat(64)}]}},
          {escalation:{...h,findingsRef:''}},{escalation:{...h,remainingCriteria:''}},
          {escalation:{...h,terminalState:'completed'}},{escalation:{...h,unexpected:true}},
          {assignment:undefined,escalation:h},{escalation:h,model:'astra/model'},{escalation:h,thinking:'bogus'},
          ...(scout?[{escalation:h,model:'openai/gpt-5.4-mini'},{escalation:h,thinking:'off'}]:[])
        ]) await reject(extra);
        if(developer) await reject({escalation:h,packet:{...authority.packet,allowedPaths:'/expanded'}},/scope/);
        if(scout) await reject({escalation:h,question:'Expanded investigation'},/scope/);
        if(!scout&&!developer) await reject({escalation:h,agent:'reviewer'},/role/);
        assert.equal(ledger().consumed,false);
        const ownershipKey=Object.getOwnPropertySymbols(globalThis).find(s=>s.description?.startsWith('pi-toolkit/delivery-tmux/owned-surfaces/'));
        assert.ok(ownershipKey,'Inspect exact fixture-owned adapter map, not upstream ownership');
        const ownership=globalThis[ownershipKey];
        ownership.set('%fixture-uncertain',{runId:'fixture-uncertain',sessionFile:parent,delivery:true,cleanupError:'fixture failed kill'});
        await reject({escalation:h},/cleanup/);assert.equal(ledger().consumed,false);
        ownership.delete('%fixture-uncertain');
        // Undeclared legacy launches cannot gain authority retroactively.
        const legacy=await launch('legacy',{assignment:undefined});
        assert.equal(legacy.details.status,'started');const legacyRecord=structuredClone(owned());
        await rawCall('subagent_message',{name:'legacy',action:'stop'});await sleep(60);
        await reject({assignment:{...binding,id:'retrofit'},escalation:{...h,from:'legacy',runId:legacyRecord.id}},/declared provenance/);
        if(variant.endsWith('persistence')) {
          const before=log();runtime.appendEntry=()=>{throw new Error('lineage storage failed');};
          await assert.rejects(launch('replacement',{escalation:h}),/storage failed/);assert.equal(log(),before);
          await assert.rejects(launch('second',{escalation:h}),/unavailable/);
          await stop(extension);process.exit(0);
        }
        if(variant.endsWith('failure')) {writeFileSync(process.env.FAIL_TRANSPORT,'fail');await assert.rejects(launch('replacement',{escalation:h}));}
        else {
          const pending=launch('replacement',{escalation:h,...(developer?{model:'openai/gpt-6.1-sol',thinking:'high'}:{profile:'strong'})});
          assert.equal((await pending).details.status,'started');
          const before=log();await assert.rejects(launch('sibling',{escalation:h}),/unconsumed/);assert.equal(log(),before);
        }
        assert.equal(ledger().consumed,true);assert.equal(ledger().rootName,'original');
        if(!variant.endsWith('failure')) {if(h.remainingEffortMinutes===undefined)assert.equal(leaseTimers.length,0,'Unbounded recovery invents no timeout');else assert.ok(leaseTimers.at(-1)<=720000&&leaseTimers.at(-1)>719000,'Replacement uses its declared remaining cumulative execution');assert.equal(owned().loadout.thinking,scout?'medium':'high');}
        assert.deepEqual(ledger().assignment,binding);assert.deepEqual(ledger().handoff,h);
        await assert.rejects(rawCall('subagent_message',{name:'original',message:'Blind replay',
          ...(developer?{approvalRef:authority.approvalRef,packetRef:authority.packetRef}:scout?{discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}:{})}),/Consumed/);
        if(!variant.endsWith('failure')) {
          assert.equal(owned().assignmentRoot,binding.id);
          const savedBranch=ctx.sessionManager.getBranch;ctx.sessionManager.getBranch=()=>[];
          await start(extension);
          await assert.rejects(launch('branch-overlap',{assignment:{...binding,id:'branch-sibling'}}),/active/);
          ctx.sessionManager.getBranch=savedBranch;
          await rawCall('subagent_message',{name:'replacement',action:'stop'});
        }
        await sleep(100);
        const beforeSecond=log();await assert.rejects(launch('second',{escalation:h}),/unconsumed/);assert.equal(log(),beforeSecond);
        await assert.rejects(launch('replay'),/already declared/);
        await stop(extension);
        const reloaded=await loadExtensions([${JSON.stringify(adapter)}],dir,createEventBus());
        assert.deepEqual(reloaded.errors,[]);
        reloaded.runtime.getAllTools=()=>[];reloaded.runtime.getThinkingLevel=()=> 'medium';
        reloaded.runtime.appendEntry=runtime.appendEntry;reloaded.runtime.sendMessage=runtime.sendMessage;
        await start(reloaded.extensions[0]);
        const args=scout?{...scoutAuthority,name:'second',assignment:binding,escalation:h}:developer?
          {...authority,name:'second',assignment:binding,escalation:h}:{agent:'builder',task:'Remaining work',name:'second',assignment:binding,escalation:h};
        await assert.rejects(reloaded.extensions[0].tools.get(scout?'scout':developer?'developer':'subagent').definition.execute('id',args,undefined,undefined,ctx),/unconsumed/);
        if(!variant.endsWith('failure')) {
          const pinned=structuredClone(owned().loadout), refs=structuredClone(owned().workflow);
          const lineageCount=entries.filter(e=>e.customType==='delivery-tmux-lineage-v1').length;
          const replacement=entries.filter(e=>e.customType==='delivery-tmux-owned-v1'&&e.data.name==='replacement').at(-1).data;
          writeFileSync(replacement.sessionFile,JSON.stringify({type:'session',version:3,id:'child',cwd:dir})+'\\n');
          // New defaults/unavailable candidates must not alter pinned saved resume.
          models.length=0;
          const resumed=await reloaded.extensions[0].tools.get('subagent_message').definition.execute('id',{name:'replacement',message:'Only remaining approved work',
            ...(scout?{discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}:{approvalRef:authority.approvalRef,packetRef:authority.packetRef})},undefined,undefined,ctx);
          assert.equal(resumed.details.status,'started');if(h.remainingEffortMinutes===undefined)assert.equal(leaseTimers.length,0,'Unbounded saved resume has no cutoff');else assert.ok(leaseTimers.at(-1)<720000,'Saved replay subtracts previously consumed execution');
          assert.deepEqual(owned().loadout,pinned);assert.deepEqual(owned().workflow,refs);assert.equal(owned().assignmentRoot,binding.id);
          assert.equal(entries.filter(e=>e.customType==='delivery-tmux-lineage-v1').length,lineageCount);
          await reloaded.extensions[0].tools.get('subagent_message').definition.execute('id',{name:'replacement',action:'stop'},undefined,undefined,ctx);
        }
        await stop(reloaded.extensions[0]);
        // A branch missing the consumption entry cannot restore the grant:
        // getEntries retains the parent ledger independently of getBranch.
        // Wrong-parent/malformed consumed provenance fails closed before allocation.
        const savedEntries=structuredClone(entries), beforeMalformed=log();
        const consumed=entries.filter(e=>e.customType==='delivery-tmux-lineage-v1').at(-1);
        consumed.data.parent='foreign-parent';
        await start(reloaded.extensions[0]);
        await assert.rejects(reloaded.extensions[0].tools.get(scout?'scout':developer?'developer':'subagent').definition.execute('id',args,undefined,undefined,ctx),/unavailable/);
        assert.equal(log(),beforeMalformed);
        entries.splice(0,entries.length,...structuredClone(savedEntries));
        entries.filter(e=>e.customType==='delivery-tmux-lineage-v1').at(-1).data.consumed=false;
        await start(reloaded.extensions[0]);
        await assert.rejects(reloaded.extensions[0].tools.get(scout?'scout':developer?'developer':'subagent').definition.execute('id',args,undefined,undefined,ctx),/unavailable/);
        assert.equal(log(),beforeMalformed);
        entries.splice(0,entries.length,...savedEntries);
        ctx.sessionManager.getBranch=()=>[];
        await start(reloaded.extensions[0]);
        await assert.rejects(reloaded.extensions[0].tools.get(scout?'scout':developer?'developer':'subagent').definition.execute('id',args,undefined,undefined,ctx),/unconsumed|unavailable/);
        await stop(reloaded.extensions[0]);
      }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
      cwd: dir, encoding: "utf8", timeout: 15000,
      env: { ...process.env, HOME: dir, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:/usr/bin:/bin`,
        TMUX: scenario.endsWith("non-tmux") ? "" : "fake", TMUX_PANE: "%parent", FAKE_LOG: join(dir, "tmux.log"),
        FAIL_TRANSPORT: join(dir, "fail"), FAIL_CLEANUP: join(dir, "fail-cleanup"), DONE_FILE: join(dir, "done"), PI_OFFLINE: "1", PI_SUBAGENT_AGENT: "", PI_SUBAGENT_ALLOWED: "", PI_SUBAGENT_SHELL_READY_DELAY_MS: "40" },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}
