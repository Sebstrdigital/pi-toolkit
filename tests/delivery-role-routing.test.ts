import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const routing = fileURLToPath(new URL("../extensions/delivery-tmux/role-routing.ts", import.meta.url));
for (const scenario of ["defaults", "strong-start", "exact-availability", "effort-support", "narrow-builder"]) {
  test(`role routing with installed effort API: ${scenario}`, async t => {
    const located = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
    assert.equal(located.status, 0, "Required installed host unavailable, not a skip");
    let host = dirname(await realpath(located.stdout.trim()));
    for (;;) {
      try { if (JSON.parse(await readFile(join(host, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent") break; } catch {}
      const parent = dirname(host); assert.notEqual(parent, host); host = parent;
    }
    const dir = await mkdtemp(join(tmpdir(), "role-routing-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    // Use the real host ModelRegistry facade over a deterministic runtime
    // snapshot. No credential reads, provider requests, sessions or panes.
    await writeFile(join(dir, "probe.ts"), `
      import assert from 'node:assert/strict';
      import {resolveRoleRoute} from ${JSON.stringify(routing)};
      import {ModelRegistry} from ${JSON.stringify(join(host, "dist/core/model-registry.js"))};
      export default function(pi) {
        pi.registerTool({name:'probe',parameters:{type:'object',properties:{}},execute:async()=>{
          const mini='openai/gpt-5.4-mini',terra='openai/gpt-5.6-terra',sol='openai/gpt-6.1-sol',luna='openai/gpt-6-luna';
          const models=[mini,terra,sol,luna,'other/gpt-5.4-mini','openai/custom/id'].map(name=>{
            const slash=name.indexOf('/');return {provider:name.slice(0,slash),id:name.slice(slash+1),type:'chat',api:'openai-responses',
              name,reasoning:true,thinkingLevelMap:{off:name===sol?null:'none',minimal:null,xhigh:'xhigh'},input:['text'],contextWindow:128000,maxTokens:16000,
              cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
          });
          let available=models, error;
          const queries=[];
          const registry=new ModelRegistry({getError:()=>error,getModel:(provider,id)=>{queries.push([provider,id]);return models.find(m=>m.provider===provider&&m.id===id)},getAvailableSnapshot:()=>available});
          const route=(role,choice={},restricted=false)=>resolveRoleRoute(role,choice,registry,restricted);
          const scenario=${JSON.stringify(scenario)};
          if(scenario==='defaults') {
            for(const [role,model,thinking] of [['scout',terra,'medium'],['builder',terra,'medium'],['validator',terra,'medium'],['reviewer',terra,'high']]) {
              assert.deepEqual(route(role),{model,thinking});
              assert.doesNotMatch(model,/astra/i);
            }
            assert.deepEqual(route('scout',{taskKind:'lookup'}),{model:luna,thinking:'low'});
            assert.deepEqual(route('scout',{taskKind:'analysis'}),{model:terra,thinking:'medium'});
            assert.deepEqual(route('scout',{taskKind:'lookup',model:luna,thinking:'none'},true),{model:luna,thinking:'off'});
          } else if(scenario==='strong-start') {
            for(const [role,model,thinking] of [['scout',sol,'medium'],['builder',sol,'high'],['validator',sol,'high'],['reviewer',sol,'high']]) {
              assert.deepEqual(route(role,{profile:'strong'}),{model,thinking});
            }
            assert.equal(route('reviewer',{model:sol,thinking:'xhigh'},true).thinking,'xhigh');
            assert.deepEqual(route('scout',{taskKind:'lookup',profile:'strong'},true),{model:terra,thinking:'medium'});
            assert.equal(route('scout',{profile:'strong',thinking:'low'},true).thinking,'low');
            assert.throws(()=>route('builder',{profile:'retry'}),/Invalid routing profile/);
            assert.throws(()=>route('builder',{taskKind:'lookup'}),/Invalid Scout taskKind/);
          } else if(scenario==='exact-availability') {
            assert.deepEqual(route('builder',{model:'openai/custom/id'}),{model:'openai/custom/id',thinking:'medium'});
            assert.deepEqual(queries.at(-1),['openai','custom/id']);
            for(const model of ['gpt-5.4-mini','openai/GPT-5.4-mini','OPENAI/gpt-5.4-mini','openai/gpt-5.4-mini-extra','openai/ gpt-5.4-mini']) assert.throws(()=>route('builder',{model}),/exact|unavailable/);
            available=models.filter(m=>m.provider!=='openai');
            assert.throws(()=>route('scout'),/authentication unavailable/);
            available=models;error='bad catalog';assert.throws(()=>route('builder'),/registry unavailable/);
          } else if(scenario==='effort-support') {
            assert.equal(route('builder',{model:mini,thinking:'none'}).thinking,'off');
            models[0].thinkingLevelMap.off=null;
            assert.throws(()=>route('builder',{model:mini,thinking:'none'}),/Unsupported thinking off/);
            assert.throws(()=>route('scout',{model:mini},true),/candidate scout profiles/);
            assert.throws(()=>route('scout',{thinking:'off'},true),/candidate scout profiles/);
            models[3].thinkingLevelMap.low=null;
            assert.throws(()=>route('scout',{taskKind:'lookup'}),/Unsupported thinking low/);
            assert.throws(()=>route('builder',{model:sol,thinking:'none'}),/Unsupported thinking off/);
            models[2].thinkingLevelMap.xhigh=null;
            assert.throws(()=>route('reviewer',{model:sol,thinking:'xhigh'}),/Unsupported thinking xhigh/);
            models[2].reasoning=false;
            assert.throws(()=>route('builder',{profile:'strong'}),/Unsupported thinking high/);
            assert.throws(()=>route('validator',{thinking:'bogus'}),/Unsupported thinking/);
            for(const value of [null,12,{},'', ' ']) {
              assert.throws(()=>route('builder',{model:value}),/Invalid routing model/);
              assert.throws(()=>route('builder',{thinking:value}),/Invalid routing thinking/);
            }
          } else {
            for(const [model,thinking] of [[terra,'medium'],[sol,'medium'],[sol,'high']]) assert.deepEqual(route('builder',{model,thinking},true),{model,thinking});
            assert.deepEqual(route('builder',{},true),{model:terra,thinking:'medium'});
            for(const choice of [{model:mini},{model:'openai/gpt-5.6-sol'},{model:luna},{model:'astra/model'},{model:terra,thinking:'high'},{model:sol,thinking:'xhigh'},{thinking:'off'}]) assert.throws(()=>route('builder',choice,true),/candidate builder profiles|Astra/);
            assert.deepEqual(route('validator',{model:'other/gpt-5.4-mini',thinking:'medium'}),{model:'other/gpt-5.4-mini',thinking:'medium'},'Explicit supported Team choices remain independent');
          }
          return {content:[],details:{}};
        }});
      }
    `);
    const program = `
      const {loadExtensions}=await import(${JSON.stringify(join(host, "dist/core/extensions/loader.js"))});
      const {createEventBus}=await import(${JSON.stringify(join(host, "dist/core/event-bus.js"))});
      const loaded=await loadExtensions([${JSON.stringify(join(dir, "probe.ts"))}],${JSON.stringify(dir)},createEventBus());
      if(loaded.errors.length)throw Error(JSON.stringify(loaded.errors));
      await loaded.extensions[0].tools.get('probe').definition.execute('id',{},undefined,undefined,{});
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
      cwd: dir, encoding: "utf8", timeout: 15000,
      env: { ...process.env, HOME: dir, PI_CODING_AGENT_DIR: dir + "/agent", PI_OFFLINE: "1", PATH: "/usr/bin:/bin" },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}
