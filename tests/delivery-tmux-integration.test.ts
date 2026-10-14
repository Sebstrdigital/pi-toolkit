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

for (const scenario of ["notification-evidence", "notification-error-evidence", "api-only", "api-ready-failure", "api-direct-admission", "api-registration", "api-roles", "api-parallel-worktrees", "api-failure-rollback", "api-saved-resume", "api-reservation-pause-reply", "api-shutdown", "api-developer-admission", "api-developer-provenance", "api-scout-admission", "api-scout-provenance", "legacy-policy-resume", "parallel-worktrees", "compact-developer", "registration", "collision", "non-tmux", "reservation-pause-reply", "child-input-reply-rearm", "failure-rollback", "saved-resume", "timeout", "shutdown", "persistence-failure", "roles", "old-owned", "unresolved-owned", "cleanup-retry", "pause-exit-timeout", "developer-admission", "developer-registration", "developer-collision", "developer-non-tmux", "developer-reservation-pause-reply", "developer-child-input-reply-rearm", "developer-failure-rollback", "developer-saved-resume", "developer-timeout", "developer-shutdown", "developer-persistence-failure", "developer-unresolved-owned", "developer-cleanup-retry", "developer-pause-exit-timeout", "developer-provenance", "developer-stop", "developer-correlation-live", "developer-correlation-terminal", "legacy-team", "scout-admission", "scout-registration", "scout-collision", "scout-reservation-pause-reply", "scout-child-input-reply-rearm", "scout-failure-rollback", "scout-saved-resume", "scout-timeout", "scout-shutdown", "scout-persistence-failure", "scout-unresolved-owned", "scout-cleanup-retry", "scout-pause-exit-timeout", "scout-provenance", "scout-stop", "scout-non-tmux", "scout-correlation-live", "scout-correlation-terminal", "routing-team-explicit", "developer-routing-strong", "scout-routing-lookup", "scout-routing-strong", "routing-admission"] as const) {
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
    const apiClient = join(dir, "execution-client.ts");
    if (scenario.startsWith("api-")) await writeFile(apiClient, `
      import adapter from ${JSON.stringify(adapter)};
      import {createExecutionService} from ${JSON.stringify(join(agent, "extensions/delivery-tmux/execution.ts"))};
      export default async function(pi) {
        ${scenario === "api-only" ? "" : "await adapter(pi);"}
        const service = await createExecutionService(pi);
        if (service !== await createExecutionService(pi)) throw Error('Service duplicated');
        globalThis.__executionClient = service;
        globalThis.__executionEvents = [];
        service.onEvent(event => globalThis.__executionEvents.push(event));
        ${scenario === "api-ready-failure" ? "service.onReady(() => { throw Error('Fixture binding failed'); });" : ""}
      }
    `);
    const entry = scenario.startsWith("api-") ? apiClient : adapter;
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
 display-message) printf '$fake-session\\n' ;;
 new-session) printf '$parking %%parking-anchor\\n' ;;
 new-window) n=0; if [ -f "$FAKE_LOG.count" ]; then read n < "$FAKE_LOG.count"; fi; n=$((n+1)); printf '%s\\n' "$n" > "$FAKE_LOG.count"; printf '%%owned%s\\n' "$n" ;;
 send-keys) if [ -f "$FAIL_TRANSPORT" ]; then exit 23; fi ;;
 capture-pane) if [ -f "$DONE_FILE" ]; then printf '__SUBAGENT_DONE_${scenario === "notification-error-evidence" ? 7 : 0}__\\n'; fi ;;
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
      const api=variant.startsWith('api-'), flavor=api?variant.slice(4):variant;
      const developer=flavor.startsWith('developer-'), scout=flavor.startsWith('scout-'), scenario=(developer||scout)?flavor.slice(flavor.indexOf('-')+1):flavor;
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
      const loaded=await loadExtensions([${JSON.stringify(entry)}],dir,createEventBus());
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
      runtime.appendEntry=(customType,data)=>{ if(scenario==='persistence-failure') throw new Error('storage failed'); const entry={type:'custom',customType,data:structuredClone(data)}; entries.push(entry); if(scenario==='notification-evidence'||scenario==='notification-error-evidence') writeFileSync(dir+'/parent.jsonl',JSON.stringify(entry)+'\\n',{flag:'a'}); };
      runtime.sendMessage=(message)=>messages.push(message);
      const parent=dir+'/parent.jsonl'; writeFileSync(parent,JSON.stringify({type:'session',version:3,id:'parent',cwd:dir})+'\\n');
      if(scenario==='old-owned') entries.push({type:'custom',customType:'delivery-tmux-owned-v1',data:{name:'legacy',version:0}});
      const models=['gpt-5.4-mini','gpt-5.6-terra','gpt-5.6-sol','gpt-6.1-sol','gpt-6-luna'].map(id=>({provider:'openai',id,api:'openai-responses',reasoning:true,thinkingLevelMap:{off:id==='gpt-6.1-sol'?null:'none',minimal:null,xhigh:'xhigh'}}));
      models.push({provider:'approved',id:'model',reasoning:true});
      const {ModelRegistry}=await import(${JSON.stringify(join(host, "dist/core/model-registry.js"))});
      const registry=new ModelRegistry({getError:()=>undefined,getModel:(provider,id)=>models.find(m=>m.provider===provider&&m.id===id),getAvailableSnapshot:()=>models});
      const ctx={cwd:dir,hasUI:false,model:{provider:'openai',id:'gpt-6.1-sol'},modelRegistry:registry,sessionManager:{
        getSessionFile:()=>parent,getSessionId:()=> 'parent',getSessionDir:()=>dir,getBranch:()=>entries,getEntries:()=>entries
      }};
      const start=async ext=>{try {for(const handler of [...(ext.handlers.get('session_start')??[])]) await handler({reason:'startup'},ctx);} finally {assertUpstreamChildCount();}};
      const stop=async ext=>{try {for(const handler of ext.handlers.get('session_shutdown')??[]) await handler({},ctx);} finally {assertUpstreamChildCount();}};
      if(api) {
        await assert.rejects(globalThis.__executionClient.profiles({id:'before-start',context:ctx}),/unavailable/);
        assert.throws(()=>globalThis.__executionClient.inspect(ctx),/unavailable/);
      }
      if(scenario==='ready-failure') {
        await assert.rejects(start(extension),/Fixture binding failed/);
        await assert.rejects(globalThis.__executionClient.profiles({id:'failed-start',context:ctx}),/unavailable/);
        assert.throws(()=>globalThis.__executionClient.inspect(ctx),/unavailable/);
        assert.equal(existsSync(process.env.FAKE_LOG),false);await stop(extension);process.exit(0);
      }
      if(scenario==='only') {
        await start(extension);
        const service=globalThis.__executionClient, call={id:'workflow-client',context:ctx};
        assert.equal(extension.tools.size,0,'Service works without legacy tool registration');
        assert.deepEqual(service.inspect(ctx),[]);
        let definitions;
        const detachReady=service.onReady(value=>{definitions=value;});detachReady();
        assert.equal(definitions.length,3);
        assert.ok(definitions.every(d=>!Object.hasOwn(d,'execute')),'No unguarded executor escapes');
        const defs=await service.profiles(call);
        assert.deepEqual(defs.details.agents.map(a=>a.name),['builder','validator','reviewer','scout']);
        const request={kind:'worker',params:{agent:'builder',name:'owned',task:'Independent workflow task; no spec or stage documents.'}};
        const pending=service.launch(request,call);
        request.params.agent='reviewer'; request.params.task='Mutated after submission';
        const launched=await pending;
        assert.equal(launched.details.status,'started');
        const state=service.inspect(ctx);
        assert.equal(state[0].role,'builder','Submitted requests are detached from caller mutation');
        state[0].state='completed'; assert.equal(service.inspect(ctx)[0].state,'running');
        await assert.rejects(service.control({name:'external',message:'Adopt'},call),/not owned/);
        await assert.rejects(service.launch({kind:'worker',params:{agent:'builder',name:'overlap',task:'No worker'}},call),/already active/);
        assert.ok(globalThis.__executionEvents.some(e=>e.type==='launch'&&e.name==='owned'));
        const unsubscribe=service.onEvent(event=>{event.name='observer-mutated';});
        const errors=[]; const originalError=console.error; console.error=(...args)=>errors.push(args);
        const badObserver=service.onEvent(async()=>{throw Error('observer failure');});
        await service.control({name:'owned',action:'pause'},call);
        assert.equal(service.inspect(ctx)[0].state,'paused');
        await assert.rejects(service.launch({kind:'worker',params:{agent:'builder',name:'paused-overlap',task:'No worker'}},call),/already active/);
        await service.control({name:'owned',action:'stop'},call);
        await sleep(1200);
        badObserver();unsubscribe();console.error=originalError;
        assert.ok(errors.length,'Observer errors do not interrupt ownership transitions');
        assert.equal(service.inspect(ctx)[0].state,'cancelled');
        assert.ok(globalThis.__executionEvents.some(e=>e.type==='terminal'&&e.name==='owned'));
        await stop(extension);await stop(extension);
        await assert.rejects(service.profiles(call),/unavailable/);
        await assert.rejects(service.launch({kind:'worker',params:{agent:'builder',task:'After shutdown'}},call),/unavailable/);
        assert.throws(()=>service.inspect(ctx),/unavailable/);
        assert.equal(upstreamOwnership.size,1);assert.equal(upstreamAbort.signal.aborted,false);
        process.exit(0);
      }
      if(scenario==='collision') {
        await assert.rejects(start(extension),/collision/); assert.equal(extension.tools.size,0);
        await stop(extension); assert.equal(existsSync(process.env.FAKE_LOG),false);
        assert.equal(upstreamAbort.signal.aborted,false); assert.equal(upstreamOwnership.size,1);
      } else {
        await start(extension);
        assert.deepEqual([...extension.tools.keys()].sort(),['developer','scout','subagent','subagent_message','subagents_list'].sort());
        assert.deepEqual([...extension.commands.keys()],['subagents']);
        for(const tool of extension.tools.values()) {assert.equal(tool.definition.exposure,'model-only');assert.equal(tool.definition.executionMode,'parallel');}
        const rawCall=(name,args,context=ctx)=> {
          if(!api) return extension.tools.get(name).definition.execute('id',args,undefined,undefined,context);
          const service=globalThis.__executionClient, call={id:'workflow-client',context};
          return name==='subagent'?service.launch({kind:'worker',params:args},call):
            name==='developer'||name==='scout'?service.launch({kind:name,params:args},call):
            name==='subagent_message'?service.control(args,call):service.profiles(call);
        };
        const call=(name,args,context=ctx)=>rawCall(name,scout&&name==='subagent_message'?{discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef,...args}:developer&&name==='subagent_message'?{approvalRef:authority.approvalRef,packetRef:authority.packetRef,...args}:args,context);
        const routeExtra=variant==='routing-team-explicit'?{model:'approved/model',thinking:'low'}:variant==='developer-routing-strong'?{model:'openai/gpt-6.1-sol',thinking:'high'}:variant==='scout-routing-lookup'?{taskKind:'lookup'}:variant==='scout-routing-strong'?{profile:'strong',thinking:'low'}:{};
        const launch=(extra=routeExtra)=>scout?rawCall('scout',{...scoutAuthority,name:'owned',...extra}):developer?rawCall('developer',{...authority,name:'owned',...extra}):call('subagent',{agent:'builder',name:'owned',task:'No actual worker.',...extra});
        if(scenario==='direct-admission') {
          const service=globalThis.__executionClient, call={id:'workflow-client',context:ctx};
          for(const request of [null,{}, {kind:'invented',params:{}}, {kind:'worker',params:{agent:'scout',task:'Bypass discovery'}},
            {kind:'worker',params:{agent:'builder',task:'No worker',tools:'bash'}},
            {kind:'worker',params:{agent:'builder',task:12}}, {kind:'worker',params:{agent:'builder',task:'No worker',name:null}},
            {kind:'worker',params:{agent:'builder',task:'No worker'},workflow:{kind:'scout',discoveryAuthorityRef:'forged'}}])
            await assert.rejects(service.launch(request,call));
          for(const request of [null,{}, {name:'owned',action:'invented'}, {name:'owned',message:12}, {name:'owned',tools:'bash'}])
            await assert.rejects(service.control(request,call),/control fields/);
          assert.equal(entries.length,0);assert.equal(existsSync(process.env.FAKE_LOG),false);
          assert.deepEqual(service.inspect(ctx),[]);await stop(extension);process.exit(0);
        }
        if(scenario==='old-owned') {
          await assert.rejects(call('subagent',{agent:'builder',task:'No worker'}),/unavailable/);
          await stop(extension);assert.equal(existsSync(process.env.FAKE_LOG),false);
          process.exit(0);
        }
        const list=await call('subagents_list',{});
        assert.deepEqual(list.details.agents.map(a=>a.name),['builder','validator','reviewer','scout']);
        assert.ok(list.details.agents.every(a=>a.source==='package'&&!a.cli&&!a.subagentAgents));
        assert.doesNotMatch(JSON.stringify(list),/UNAPPROVED/);
        await assert.rejects(launch({agent:'unrestricted'}),(developer||scout)?/no overrides/:/fixed delivery/);
        await assert.rejects(launch({cwd:'/forbidden'}),scout?/no overrides/:/workspace/);
        await assert.rejects(rawCall('subagent',{agent:'scout',task:'Team may not select Scout'}),/fixed delivery/);
        await assert.rejects(rawCall('developer',{...authority,agent:'scout'}),/no overrides/);
        if(scenario==='admission'&&scout) {
          const schema=extension.tools.get('scout').definition.parameters;
          assert.equal(schema.additionalProperties,false);
          for(const key of ['discoveryAuthorityRef','question','sources','rules','exclusions','budget','resultContract']) {
            await assert.rejects(launch({[key]:undefined}),/Scout requires/);
            await assert.rejects(launch({[key]:key==='sources'?[]:' '}),/Scout requires/);
          }
          for(const key of ['agent','selection','role','cwd','tools','cli']) await assert.rejects(launch({[key]:'forbidden'}),/no overrides/);
          await assert.rejects(launch({sources:[dir+'/missing']}),/inaccessible/);
          for(const name of ['', ' ', null, 12, 'x'.repeat(81)]) await assert.rejects(launch({name}),/Scout requires/);
          assert.match(extension.tools.get('scout').definition.description,/does not authenticate consent/);
          assert.equal(existsSync(process.env.FAKE_LOG),false);
        } else if(scenario==='admission') {
          const schema=extension.tools.get('developer').definition.parameters;
          assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.packet.anyOf[1].additionalProperties,false);
          assert.deepEqual(schema.required.sort(),['approvalRef','packetRef','packet'].sort());
          for(const extra of [{selection:'Team'},{approvalRef:''},{approvalRef:'  '},{packetRef:''},{packet:undefined},
            {packet:{...authority.packet,baseline:''}},{packet:{...authority.packet,role:'reviewer'}},
            ...['agent','role','tools','grants','cli','task'].map(key=>({[key]:'forbidden'}))]) {
            await assert.rejects(launch(extra),/Developer requires/);
          }
          assert.equal(existsSync(process.env.FAKE_LOG),false,'Rejected authority/overrides create no pane');
        }
        if(scenario==='admission'||scenario==='routing-admission') {
          const {readdirSync}=await import('node:fs');
          const files=(path)=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path+'/'+e.name):e.isFile()?[[path+'/'+e.name,readFileSync(path+'/'+e.name,'utf8')]]:[]);
          const before=JSON.stringify(entries), beforeFiles=files(dir);
          const invalidChoices=(developer||scout)?[{model:'openai/gpt-5.6-sol'},{model:'openai/gpt-5.4-mini'},{model:'astra/bogus'},{thinking:'off'},{thinking:'xhigh'},{thinking:'bogus'},{model:null},{thinking:null}]:[{model:'openai/GPT-5.6-terra'},{model:'unknown/gpt-5.6-terra'},{model:'astra/bogus'},{thinking:'bogus'}];
          for(const extra of invalidChoices) {
            await assert.rejects(launch(extra),/candidate|Unsupported|unavailable|Astra|Invalid routing/);
            assert.equal(JSON.stringify(entries),before);
            assert.equal(existsSync(process.env.FAKE_LOG),false);
            assert.deepEqual(files(dir),beforeFiles,'Rejected routing creates no sidecar or other resource');
          }
          const available=registry.getAvailable;
          registry.getAvailable=()=>[];
          await assert.rejects(launch(),/authentication unavailable/);
          assert.equal(JSON.stringify(entries),before);assert.equal(existsSync(process.env.FAKE_LOG),false);
          assert.deepEqual(files(dir),beforeFiles,'Authentication-unavailable failure creates no resources');
          registry.getAvailable=available;
          const model=models.find(m=>m.id==='gpt-5.6-terra');
          model.thinkingLevelMap={off:null,low:null,medium:null};
          await assert.rejects(launch(),/Unsupported thinking/);
          assert.equal(JSON.stringify(entries),before);assert.equal(existsSync(process.env.FAKE_LOG),false);
          assert.deepEqual(files(dir),beforeFiles,'Unsupported effort creates no resources');
          model.thinkingLevelMap={off:'none',xhigh:'xhigh'};
        }
        const {mkdirSync}=await import('node:fs');mkdirSync(dir+'/artifacts/parent',{recursive:true});
        writeFileSync(dir+'/artifacts/parent/subagent-registry.json',JSON.stringify({external:{sessionFile:dir+'/external.jsonl',sessionId:'external'}}));
        await assert.rejects(call('subagent_message',{name:'external',message:'adopt'}),/not owned/);
        if(scenario==='non-tmux') {await assert.rejects(launch(),/tmux/); assert.equal(existsSync(process.env.FAKE_LOG),false);}
        else if(scenario==='registration') {assert.equal(existsSync(process.env.FAKE_LOG),false);}
        else if(scenario==='roles') {
          for(const [role,tools] of [['validator','read,grep,find,ls,bash,codemode,ask_question'],['reviewer','read,grep,find,ls,codemode,ask_question']]) {
            const run=await launch({agent:role,name:role});
            const script=readFileSync(run.details.launchScriptFile,'utf8');assert.ok(script.includes(tools));
            assert.doesNotMatch(script,/--tools '[^']*(?:edit|write|subagent|web_search)/);
            assert.match(script,/-e builtin:codemode/);
            if(role==='reviewer') assert.doesNotMatch(script,/--tools '[^']*bash/);
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
            assert.equal(entries.at(-1).data.state,'completed');
          }
        }
        else if(scenario==='legacy-policy-resume') {
          const result=await launch({name:'legacy-policy'});
          const record=entries.find(e=>e.customType==='delivery-tmux-owned-v1').data;
          delete record.loadout.resourcePolicy;
          record.loadout.model='openai/gpt-5.6-sol';record.loadout.thinking='high';record.loadout.cwd=dir;
          record.resources.deny=['extensions','mcp','skills','prompt-templates','themes','context-files'];
          writeFileSync(record.sessionFile+'.loadout.json',JSON.stringify(record.loadout));
          writeFileSync(record.sessionFile,JSON.stringify({type:'session',version:3,id:'legacy-child',cwd:dir})+'\\n');
          await start(extension);
          await assert.rejects(launch({name:'alias-collision',cwd:dir+'/.'}),/already active/);
          await rawCall('subagent_message',{name:'legacy-policy',action:'stop'});await sleep(1100);
          const resumed=await rawCall('subagent_message',{name:'legacy-policy',message:'Continue original authorized work'});
          assert.equal(resumed.details.status,'started');
          const script=readFileSync(resumed.details.launchScriptFile,'utf8');
          for(const flag of record.resources.deny)assert.ok(script.includes('--no-'+flag));
          assert.ok(script.includes('openai/gpt-5.6-sol'));assert.match(script,/--thinking.*high/);
          const last=entries.filter(e=>e.customType==='delivery-tmux-owned-v1').at(-1).data;
          assert.equal(last.loadout.resourcePolicy,undefined);assert.deepEqual(last.resources.deny,record.resources.deny);
        }
        else if(scenario==='parallel-worktrees') {
          const {execFileSync}=await import('node:child_process');
          const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
          const git=(...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.test','-c','core.hooksPath=/dev/null',...args],{env,stdio:'pipe'});
          git('init','-q','--template=',dir);git('-C',dir,'commit','--allow-empty','-qm','fixture');
          const tree=dir+'/linked tree';git('-C',dir,'worktree','add','--detach',tree);
          const [one,two]=await Promise.all([launch({name:'parallel-main'}),launch({name:'parallel-tree',cwd:tree})]);
          assert.equal(one.details.status,'started');assert.equal(two.details.status,'started');
          const records=()=>entries.filter(e=>e.customType==='delivery-tmux-owned-v1');
          assert.equal(records().find(e=>e.data.name==='parallel-tree').data.loadout.cwd,(await import('node:fs')).realpathSync(tree));
          await assert.rejects(launch({name:'same-tree',cwd:tree}),/already active/);
          await assert.rejects(launch({name:'unlinked',cwd:dir+'/bin'}),/linked worktree/);
          await rawCall('subagent_message',{name:'parallel-main',action:'stop'});
          await sleep(1200);
          await assert.rejects(launch({name:'tree-still-owned',cwd:tree}),/already active/);
          const next=await launch({name:'main-again'});assert.equal(next.details.status,'started');
          await start(extension);
          await assert.rejects(launch({name:'reloaded-tree',cwd:tree}),/already active/);
          await rawCall('subagent_message',{name:'parallel-tree',action:'pause'});
          await assert.rejects(launch({name:'paused-tree',cwd:tree}),/already active/);
          assert.equal(records().filter(e=>e.data.name==='parallel-tree').at(-1).data.state,'paused');
        }
        else if(scenario==='compact-developer') {
          const {selection,...compact}=authority;
          const result=await rawCall('developer',{...compact,packet:'Implement only the authorized fixture outcome; preserve unrelated work, run fixture checks and report gaps.',name:'compact'});
          assert.equal(result.details.status,'started');
          const record=entries.find(e=>e.customType==='delivery-tmux-owned-v1').data;
          assert.deepEqual(record.workflow,{kind:'developer',approvalRef:authority.approvalRef,packetRef:authority.packetRef});
        }
        else if(scenario==='failure-rollback'||scenario==='persistence-failure') {
          if(scenario==='failure-rollback')writeFileSync(process.env.FAIL_TRANSPORT,'fail');
          await assert.rejects(launch(),scenario==='failure-rollback'?/send-keys/:/storage failed/);
          if(scenario==='failure-rollback') {
            unlinkSync(process.env.FAIL_TRANSPORT);
            const next=await launch({name:'retry'});assert.equal(next.details.status,'started');
          } else {await assert.rejects(launch({name:'retry'}),/unavailable/);}
        } else {
          if(scenario==='timeout'||scenario==='pause-exit-timeout') {
            let executionNow=0;Object.defineProperty(performance,'now',{value:()=>executionNow,configurable:true});
            globalThis.setTimeout=(fn,ms,...args)=>ms>=60000?realTimeout(()=>{executionNow+=ms;fn(...args);},scenario==='timeout'?30:1500):realTimeout(fn,ms,...args);
          }
          const limit=(scenario==='timeout'||scenario==='pause-exit-timeout')?{name:'owned',assignment:{id:'explicit-limit',scopeRef:'fixture',approvalRef:scout?scoutAuthority.discoveryAuthorityRef:authority.approvalRef,packetRef:scout?scoutAuthority.discoveryAuthorityRef:authority.packetRef,effortMinutes:20}}:{};
          const pending=launch({...routeExtra,...limit});
          await assert.rejects(launch({name:'sibling'}),/already active/);
          await assert.rejects((developer||scout)?rawCall('subagent',{agent:'reviewer',name:'team-overlap',task:'No worker'}):rawCall('developer',{...authority,name:'developer-overlap'}),/already active/);
          await assert.rejects(rawCall('scout',{...scoutAuthority,name:'scout-overlap'}),/already active/);
          if(scout) await assert.rejects(rawCall('developer',{...authority,name:'developer-overlap'}),/already active/);
          const result=await pending; assert.equal(result.details.status,'started');
          const record=entries.find(e=>e.customType==='delivery-tmux-owned-v1').data;
          assert.equal(record.version,1);
          assert.deepEqual(record.workflow,scout?{kind:'scout',discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}:developer?{kind:'developer',approvalRef:authority.approvalRef,packetRef:authority.packetRef}:{kind:'team'});
          if(scout) {
            await assert.rejects(rawCall('subagent_message',{name:'owned',message:'unapproved work'}),/original discovery/);
            await assert.rejects(rawCall('subagent_message',{name:'owned',message:'wrong ref',discoveryAuthorityRef:'other'}),/original discovery/);
            const taskFiles=(await import('node:fs')).readdirSync(dir+'/artifacts/parent/context');
            const task=taskFiles.map(file=>readFileSync(dir+'/artifacts/parent/context/'+file,'utf8')).find(text=>text.includes('Read-only Scout:'));
            assert.ok(task);for(const field of Object.values(scoutAuthority).flat())assert.ok(task.includes(field));
            assert.ok(task.includes('\\n## question\\n'),'Packet uses real section line breaks');
          }
          if(developer) {
            for(const args of [{name:'owned',message:'unapproved new work'}, {name:'owned',action:'rearm',message:'unapproved rearm'},
              {name:'owned',message:'wrong authority',approvalRef:'Team Agreement',packetRef:authority.packetRef}]) {
              await assert.rejects(rawCall('subagent_message',args),/original approved packet/);
            }
            const taskFiles=(await import('node:fs')).readdirSync(dir+'/artifacts/parent/context');
            const task=taskFiles.map(file=>readFileSync(dir+'/artifacts/parent/context/'+file,'utf8')).find(text=>text.includes('Standalone Developer:'));
            assert.ok(task);for(const field of Object.values(authority.packet))assert.ok(task.includes(field));
            assert.ok(task.includes(authority.approvalRef)&&task.includes(authority.packetRef));
            assert.match(task,/No Team artifact set is required/);
          }
          const expectedModel=routeExtra.model??(scout?(routeExtra.taskKind==='lookup'?'openai/gpt-6-luna':routeExtra.profile==='strong'?'openai/gpt-6.1-sol':'openai/gpt-5.6-terra'):'openai/gpt-5.6-terra');
          assert.equal(record.loadout.model,expectedModel); assert.equal(record.loadout.thinking,routeExtra.thinking??(routeExtra.taskKind==='lookup'?'low':'medium'));
          assert.deepEqual(record.resources.deny,['extensions','mcp']);
          assert.equal(record.loadout.resourcePolicy,'project-context');
          const {fileURLToPath}=await import('node:url');
          assert.equal(fileURLToPath(record.resources.control),${JSON.stringify(join(root, "vendor/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts"))});
          const script=readFileSync(result.details.launchScriptFile,'utf8');
          for(const flag of ['--no-extensions','--no-mcp']) assert.ok(script.includes(flag));
          for(const flag of ['--no-skills','--no-prompt-templates','--no-themes','--no-context-files']) assert.ok(!script.includes(flag));
          assert.equal((script.match(/ -e /g)||[]).length,2); assert.match(script,/subagent-done.ts/);
          assert.match(script,/-e builtin:codemode/);
          assert.ok(script.includes(scout?'read,grep,find,ls,codemode,ask_question':'read,grep,find,ls,bash,edit,write,codemode,ask_question'));
          if(scout)assert.doesNotMatch(script,/--tools '[^']*(bash|edit|write|subagent|web)/);
          assert.doesNotMatch(script,/UNAPPROVED|claude|PI_SUBAGENT_ALLOWED/);
          const header=JSON.stringify({type:'session',version:3,id:'child',cwd:dir})+'\\n';writeFileSync(record.sessionFile,header);
          if(scenario==='notification-evidence'||scenario==='notification-error-evidence') {
            const failed=scenario==='notification-error-evidence';
            const tail=failed?'TAIL ERROR/COVERAGE CAVEAT':'TAIL FAILURE/COVERAGE CAVEAT';
            const long='x'.repeat(17000)+tail;
            const publication=JSON.stringify({type:'question',runId:record.id,questionId:'long-q',question:long,name:'owned',agent:'builder'});
            writeFileSync(record.sessionFile+'.pending-question',publication);
            writeFileSync(record.sessionFile+'.ask',publication);
            await sleep(1200);
            const question=messages.find(m=>m.customType==='subagent_question'); assert.ok(question);
            const verify=message=>{
              assert.ok(message.content.length<=16000);assert.match(message.content,/TRUNCATED/);
              const pointer=message.details.notificationEvidence;
              assert.equal(pointer.sessionFile,parent);
              const entry=readFileSync(pointer.sessionFile,'utf8').trim().split('\\n').map(JSON.parse).find(e=>e.customType===pointer.customType&&e.data.evidenceId===pointer.evidenceId);
              assert.ok(entry.data.message.content.includes(long),'Full omitted question/result/error is retrievable exactly from pointer');
              assert.ok(message.content.includes(pointer.evidenceId));
            };
            verify(question);
            await rawCall('subagent_message',{name:'owned',runId:record.id,questionId:'long-q',message:'Fixture answer'});
            writeFileSync(record.sessionFile,header+JSON.stringify({type:'message',message:{role:'assistant',content:[{type:'text',text:long}]}})+'\\n');
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);
            const completed=messages.find(m=>m.customType==='subagent_result');assert.ok(completed);verify(completed);
            assert.equal(completed.details.status,failed?'error':'completed');
            assert.equal(completed.details.exitCode,failed?7:0);
            assert.ok(!completed.content.includes('subagent_message({'));
            const theme={fg:(_c,t)=>t,bg:(_c,t)=>t,bold:t=>t};
            const lines=extension.messageRenderers.get('subagent_result')(completed,{expanded:true},theme).render(80);
            const rendered=lines.join('\\n');
            assert.match(rendered,/TRUNCATED/,'Renderer must not strip the evidence notice with the follow-up hint');
            const visible=rendered.replace(/\\s/g,'');
            for(const value of Object.values(completed.details.notificationEvidence)) assert.ok(visible.includes(value.replace(/\\s/g,'')),'Complete path/type/UUID must be visible at 80 columns');
            assert.ok(lines.every(line=>line.length<=80),'Wrapped renderer fits the terminal');
            assert.ok(!rendered.includes('subagent_message({'));
          } else if(scenario==='correlation-live'||scenario==='correlation-terminal') {
            const terminal=scenario==='correlation-terminal';
            if(terminal) {
              writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
              assert.equal(entries.at(-1).data.state,'completed');
            } else {
              await rawCall('subagent_message',{name:'owned',action:'pause'});
              writeFileSync(record.sessionFile+'.pending-question',JSON.stringify({type:'question',runId:record.id,questionId:'q',question:'Which?',name:'owned',agent:'builder'}));
            }
            const snapshot=()=>({log:readFileSync(process.env.FAKE_LOG,'utf8'),entries:JSON.stringify(entries),messages:JSON.stringify(messages),
              panes:readFileSync(process.env.FAKE_LOG+'.count','utf8'),
              question:existsSync(record.sessionFile+'.pending-question')?readFileSync(record.sessionFile+'.pending-question','utf8'):null,
              interrupt:existsSync(record.sessionFile+'.interrupt')?readFileSync(record.sessionFile+'.interrupt','utf8'):null});
            const before=snapshot();
            for(const correlation of [{runId:''},{questionId:''},{runId:'',questionId:''},
              {runId:record.id},{questionId:'q'},{runId:' ',questionId:'q'},{runId:record.id,questionId:'  '},
              {runId:null,questionId:'q'},{runId:record.id,questionId:null},
              {runId:'\\0',questionId:'q'},{runId:record.id,questionId:'\\0'}]) {
              for(const refs of [{},scout?{discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}:{approvalRef:authority.approvalRef,packetRef:authority.packetRef}]) {
                await assert.rejects(rawCall('subagent_message',{name:'owned',message:'Unauthorized follow-up',...correlation,...refs}),/Correlation requires both nonempty/);
                assert.deepEqual(snapshot(),before,'Malformed correlation cannot deliver input, create panes, alter entries/messages or question/interruption state');
              }
            }
            if(terminal) {
              await assert.rejects(rawCall('subagent_message',{name:'owned',message:'stale',runId:record.id,questionId:'q'}),/stale|no longer active/i);
              assert.deepEqual(snapshot(),before,'Stale valid-shaped reply cannot resume terminal ownership');
              await assert.rejects(rawCall('subagent_message',{name:'owned',message:'New work without refs'}),scout?/original discovery/:/original approved packet/);
              assert.deepEqual(snapshot(),before);
              const resumed=await call('subagent_message',{name:'owned',message:'Approved bounded follow-up'});
              assert.equal(resumed.details.status,'started');assert.equal(resumed.details.sessionFile,record.sessionFile);
              assert.equal(entries.at(-1).data.workflow.kind,scout?'scout':'developer');
            } else {
              await assert.rejects(launch({name:'correlation-sibling'}),/already active/);
              assert.deepEqual(snapshot(),before,'Malformed rejection retains paused slot and watcher');
              await assert.rejects(rawCall('subagent_message',{name:'owned',message:'wrong',runId:record.id,questionId:'wrong'}),/does not match/);
              assert.deepEqual(snapshot(),before,'Exact pending IDs still required');
              await rawCall('subagent_message',{name:'owned',message:'answer',runId:record.id,questionId:'q'});
              assert.equal(entries.at(-1).data.state,'paused','Valid reply without authority refs preserves pause');
              await assert.rejects(launch({name:'after-valid-reply'}),/already active/);
              await call('subagent_message',{name:'owned',action:'rearm',message:'Approved separate new work'});
              assert.equal(entries.at(-1).data.state,'running','Preserved watcher supports explicit authorized rearm');
            }
          } else if(scenario==='child-input-reply-rearm') {
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
            await assert.rejects(rawCall('scout',{...scoutAuthority,name:'waiting-scout'}),/already active/);
            if(scout) {
              await assert.rejects(rawCall('developer',{...authority,name:'waiting-developer'}),/already active/);
              await assert.rejects(rawCall('subagent',{agent:'reviewer',task:'No worker',name:'waiting-team'}),/already active/);
            }
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
            await assert.rejects(rawCall('scout',{...scoutAuthority,name:'paused-scout'}),/already active/);
            if(scout) {
              await assert.rejects(rawCall('developer',{...authority,name:'paused-developer'}),/already active/);
              await assert.rejects(rawCall('subagent',{agent:'reviewer',task:'No worker',name:'paused-team'}),/already active/);
            }
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
          } else if(scenario==='provenance'&&scout) {
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
            const latest=entries.at(-1).data, original=structuredClone(entries);
            for(const bad of [undefined,null,{kind:'team'},{kind:'developer',approvalRef:'a',packetRef:'p'},{kind:'scout',discoveryAuthorityRef:''},{kind:'scout',discoveryAuthorityRef:'a',extra:true}]) {
              for(const entry of entries) {if(bad===undefined)delete entry.data.workflow;else entry.data.workflow=bad;}
              await start(extension);await assert.rejects(launch({name:'bad-provenance'}),/unavailable/);
            }
            entries.splice(0,entries.length,...original);await start(extension);
            await assert.rejects(rawCall('subagent_message',{name:'owned',message:'convert',approvalRef:'a',packetRef:'p',discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}),/cannot convert/);
            const resumed=await call('subagent_message',{name:'owned',message:'Bounded continuation'});assert.equal(resumed.details.status,'started');
          } else if(scenario==='provenance'||scenario==='legacy-team') {
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
            assert.equal(entries.at(-1).data.state,'completed');
            const latest=entries.at(-1).data;
            if(scenario==='legacy-team') {
              for(const entry of entries) delete entry.data.workflow;
              await start(extension);
              await assert.rejects(rawCall('subagent_message',{name:'owned',message:'convert',approvalRef:authority.approvalRef,packetRef:authority.packetRef}),/cannot convert/);
              await assert.rejects(rawCall('subagent_message',{name:'owned',message:'convert to Scout',discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}),/cannot convert/);
              const resumed=await rawCall('subagent_message',{name:'owned',message:'Legacy Team approved follow-up'});
              assert.equal(resumed.details.status,'started');assert.deepEqual(entries.at(-1).data.workflow,{kind:'team'});
            } else {
              for(const bad of [null,{},'developer',{kind:'unknown'},{kind:'developer',approvalRef:'',packetRef:'packet'},
                {kind:'developer',approvalRef:'approval',packetRef:'packet',extra:true},{kind:'team',approvalRef:'approval'}]) {
                latest.workflow=bad;
                await start(extension);
                await assert.rejects(launch({name:'malformed'}),/unavailable/);
                await assert.rejects(rawCall('subagent_message',{name:'owned',message:'adopt'}),/unavailable/);
              }
              latest.workflow={kind:'developer',approvalRef:authority.approvalRef,packetRef:authority.packetRef};
              // A Developer record cannot claim validator/reviewer pinned grants.
              const savedLoadout=latest.loadout;
              latest.loadout={...savedLoadout,agent:'reviewer',deliveryRole:'reviewer',toolAllowlist:'read,grep,find,ls,ask_question'};
              await start(extension);await assert.rejects(launch({name:'wrong-role'}),/unavailable/);
              latest.loadout=savedLoadout;
              await start(extension);
              await assert.rejects(rawCall('subagent_message',{name:'owned',message:'resume without approval'}),/original approved packet/);
              const resumed=await call('subagent_message',{name:'owned',message:'Approved bounded follow-up'});
              assert.equal(resumed.details.status,'started');assert.equal(entries.at(-1).data.workflow.kind,'developer');
            }
          } else if(scenario==='saved-resume') {
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);unlinkSync(process.env.DONE_FILE);
            assert.equal(entries.at(-1).data.state,'completed');
            // Simulate an accepted older 5.6 Sol record: new defaults cannot rewrite it.
            // New routing must never reinterpret it, even with no available models.
            for(const entry of entries) if(entry.customType==='delivery-tmux-owned-v1') {
              entry.data.loadout.model='openai/gpt-5.6-sol';entry.data.loadout.thinking='xhigh';
            }
            writeFileSync(record.sessionFile+'.loadout.json',JSON.stringify(record.loadout));
            await start(extension);
            const old=readFileSync(record.sessionFile+'.loadout.json','utf8');
            writeFileSync(record.sessionFile+'.loadout.json',JSON.stringify({...record.loadout,toolAllowlist:'bash,ask_question'}));
            await assert.rejects(call('subagent_message',{name:'owned',message:'resume'}),/loadout/);
            writeFileSync(record.sessionFile+'.loadout.json',old);
            const availableBeforeResume=registry.getAvailable;
            registry.getAvailable=()=>[]; // New defaults/availability must not rewrite pinned saved workers.
            const resumed=await call('subagent_message',{name:'owned',message:'Approved follow-up'});
            assert.equal(resumed.details.sessionFile,record.sessionFile);
            const replay=readFileSync(resumed.details.launchScriptFile,'utf8');
            for(const flag of record.resources.deny) assert.ok(replay.includes('--no-'+flag));
            assert.match(replay,/-e builtin:codemode/);
            assert.ok(replay.includes(scout?'read,grep,find,ls,codemode,ask_question':'read,grep,find,ls,bash,edit,write,codemode,ask_question'));
            assert.equal(entries.at(-1).data.loadout.identity,record.loadout.identity);
            assert.equal(entries.at(-1).data.loadout.model,record.loadout.model);
            assert.equal(entries.at(-1).data.loadout.thinking,record.loadout.thinking);
            assert.equal(readFileSync(record.sessionFile+'.loadout.json','utf8'),old);
            registry.getAvailable=availableBeforeResume;
          } else if(scenario==='pause-exit-timeout') {
            await call('subagent_message',{name:'owned',action:'pause'});
            writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);
            assert.equal(entries.at(-1).data.state,'paused');
            await assert.rejects(launch({name:'paused-terminal-sibling'}),/already active/);
            await sleep(500);assert.equal(entries.at(-1).data.state,'paused','Pause does not expire an execution grant');
            await call('subagent_message',{name:'owned',action:'stop'});
            assert.equal(entries.at(-1).data.state,'cancelled');
            assert.ok(messages.some(m=>m.customType==='subagent_cancelled'));
            unlinkSync(process.env.DONE_FILE);
            const next=await launch({name:'after-preserved-stop'});assert.equal(next.details.status,'started');
          } else if(scenario==='unresolved-owned') {
            // Simulate a saved active record without its matching live watcher.
            entries.at(-1).data.id='unknown-run';
            const other=await loadExtensions([${JSON.stringify(adapter)}],dir,createEventBus());assert.deepEqual(other.errors,[]);
            other.runtime.getAllTools=()=>[];other.runtime.getThinkingLevel=()=> 'medium';other.runtime.appendEntry=runtime.appendEntry;other.runtime.sendMessage=runtime.sendMessage;
            await start(other.extensions[0]);
            await assert.rejects(other.extensions[0].tools.get('subagent').definition.execute('id',{agent:'builder',task:'No worker'},undefined,undefined,ctx),/already active/);
            await assert.rejects(other.extensions[0].tools.get('subagent_message').definition.execute('id',{name:'owned',message:'Do not adopt',...(scout?{discoveryAuthorityRef:scoutAuthority.discoveryAuthorityRef}:developer?{approvalRef:authority.approvalRef,packetRef:authority.packetRef}:{})},undefined,undefined,ctx),/unresolved/);
            await assert.rejects(stop(other.extensions[0]),/teardown incomplete/);
          } else if(scenario==='cleanup-retry') {
            writeFileSync(process.env.FAIL_CLEANUP,'fail');writeFileSync(process.env.DONE_FILE,'done');await sleep(1200);
            assert.notEqual(entries.at(-1).data.state,'completed');
            await assert.rejects(launch({name:'blocked-by-cleanup'}),/cleanup unresolved/);
            await assert.rejects(stop(extension),/teardown/);
            unlinkSync(process.env.FAIL_CLEANUP);unlinkSync(process.env.DONE_FILE);
            await stop(extension);
          } else if(scenario==='stop') {
            await rawCall('subagent_message',{name:'owned',action:'stop'});
            await sleep(200);
            assert.equal(entries.at(-1).data.state,'cancelled');
            assert.ok(messages.some(m=>m.customType==='subagent_cancelled'));
            assert.ok(!messages.some(m=>m.details?.status==='completed'));
            const next=await rawCall('subagent',{agent:'reviewer',name:'team-after-developer-cancel',task:'No worker'});
            assert.equal(next.details.status,'started');assert.deepEqual(entries.at(-1).data.workflow,{kind:'team'});
          } else if(scenario==='timeout') {
            await sleep(200);assert.equal(entries.at(-1).data.state,'cancelled');
            assert.ok(messages.some(m=>m.customType==='subagent_cancelled'));
            assert.ok(!messages.some(m=>m.details?.status==='completed'));
            const next=await launch((developer||scout)?{name:'after-timeout'}:{name:'after-timeout',agent:'reviewer'});assert.equal(next.details.status,'started');
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
        const log=readFileSync(process.env.FAKE_LOG,'utf8');assert.doesNotMatch(log,/split-window|select-layout|kill-pane -t %unowned|kill-pane -t %parent/);
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
