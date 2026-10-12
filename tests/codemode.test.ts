import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { DELIVERY_TOOLS, isSubagentLoadout } from "../vendor/pi-interactive-subagents/pi-extension/subagents/session.ts";

test("saved role loadouts accept exact legacy grants without upgrading them", () => {
  for (const role of ["builder", "validator", "reviewer"] as const) {
    const current = DELIVERY_TOOLS[role];
    const legacy = current.split(",").filter(name => name !== "codemode").join(",");
    const loadout = { deliveryRole: role, agent: role, toolAllowlist: legacy,
      model: null, thinking: "medium", systemPromptMode: null, identity: null,
      spawnable: null, autoExit: true, cwd: null, agentDir: null };
    assert.equal(isSubagentLoadout(loadout), true);
    assert.equal(loadout.toolAllowlist, legacy);
    assert.equal(isSubagentLoadout({ ...loadout, toolAllowlist: current }), true);
    assert.equal(isSubagentLoadout({ ...loadout, toolAllowlist: `${current},subagent` }), false);
    if (role === "reviewer") {
      for (const tool of ["bash", "edit", "write"]) {
        assert.equal(isSubagentLoadout({ ...loadout, toolAllowlist: `${current},${tool}` }), false);
      }
    }
  }
});

async function hostPath() {
  const command = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
  assert.equal(command.status, 0, "Installed Pi required for native code-mode checks");
  let path = dirname(await realpath(command.stdout.trim()));
  for (;;) {
    try {
      if (JSON.parse(await readFile(join(path, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent") return path;
    } catch {}
    const parent = dirname(path);
    assert.notEqual(parent, path);
    path = parent;
  }
}

// Real installed QuickJS and nested tool pipeline; no provider calls or tmux panes.
test("native code mode filters output and preserves fixed role tool boundaries", async t => {
  const host = await hostPath();
  const cwd = await mkdtemp(join(tmpdir(), "pi-codemode-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const program = `
    import assert from 'node:assert/strict';
    import {writeFileSync,readFileSync} from 'node:fs';
    const sdk=await import(${JSON.stringify(join(host, "dist/index.js"))});
    const cwd=${JSON.stringify(cwd)};
    writeFileSync(cwd+'/log.txt','PASS repeated noise\\n'.repeat(1000)+'FAIL exact evidence\\n');
    for(const role of ['builder','validator','reviewer']) {
      const settings=sdk.SettingsManager.inMemory({defaultTools:['+codemode'],codemode:{mode:'on'}});
      const nested=[];
      const loader=new sdk.DefaultResourceLoader({cwd,agentDir:cwd+'/agent',settingsManager:settings,
        noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,
        additionalExtensionPaths:['builtin:codemode'],
        extensionFactories:[{name:'codemode',builtin:true,factory:sdk.createCodemodeExtension()},pi=>{
          pi.registerTool({name:'orchestration_probe',description:'Model-only control',exposure:'model-only',
            parameters:{type:'object',properties:{}},execute:async()=>{throw Error('Must not execute');}});
          pi.on('tool_call',event=>{
            if(event.parentToolCallId)nested.push(event.toolName);
            if(event.toolName==='write')return {block:true,reason:'Fixture write approval denied'};
          });
        }]});
      await loader.reload();
      const tools=sdk.createReadOnlyTools(cwd);
      if(role!=='reviewer')tools.push(sdk.createBashTool(cwd));
      if(role==='builder')tools.push(sdk.createEditTool(cwd),sdk.createWriteTool(cwd));
      const {session}=await sdk.createAgentSession({cwd,agentDir:cwd+'/agent',tools:[...tools.map(t=>t.name),'codemode','orchestration_probe'],
        settingsManager:settings,resourceLoader:loader,sessionManager:sdk.SessionManager.inMemory(cwd)});
      try {
        await session.bindExtensions({});
        session.setActiveToolsByName([...tools.map(t=>t.name),'codemode','orchestration_probe']);
        const tool=session.agent.state.tools.find(t=>t.name==='codemode');
        assert.ok(tool,'Native tool active for '+role);
        const run=async code=>{
          // Synthetic assistant parent supplies pipeline attribution without a model request.
          session.agent.state.messages.push({role:'assistant',content:[{type:'toolCall',id:'fixture-'+role,name:'codemode',arguments:{code}}],
            api:'openai-responses',provider:'fixture',model:'fixture',timestamp:Date.now(),stopReason:'toolUse',
            usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
          const result=await tool.execute('fixture-'+role,{code});
          return result.content.filter(c=>c.type==='text').map(c=>c.text).join('\\n');
        };
        const output=await run('const raw=await tools.read({path:"log.txt"}); return raw.split("\\\\n").filter(line=>line.startsWith("FAIL"));');
        assert.match(output,/Script completed/);
        assert.match(output,/FAIL exact evidence/);
        assert.doesNotMatch(output,/PASS repeated noise/);
        assert.ok(output.length<2000);
        assert.ok(nested.includes('read'),'Nested read traversed tool hooks');
        const catalog=await run('return ALL_TOOLS.map(t=>t.name);');
        assert.doesNotMatch(catalog,/orchestration_probe/);
        if(role!=='builder') {
          assert.doesNotMatch(catalog,/"(?:edit|write)"/);
          const denied=await run('await tools.write({path:"forbidden.txt",content:"bad"});');
          assert.match(denied,/Script failed/);
        } else {
          const denied=await run('await tools.write({path:"forbidden.txt",content:"bad"});');
          assert.match(denied,/Fixture write approval denied/);
          assert.ok(nested.includes('write'),'Nested write reached approval hook');
          writeFileSync(cwd+'/edit.txt','old');
          const edited=await run('return await tools.edit({path:"edit.txt",oldText:"old",newText:"new"});');
          assert.match(edited,/Script completed/);
          assert.equal(readFileSync(cwd+'/edit.txt','utf8'),'new');
        }
        if(role==='reviewer') {
          assert.doesNotMatch(catalog,/"bash"/);
          assert.match(await run('await tools.bash({command:"true"});'),/Script failed/);
        }
      } finally {session.dispose();}
    }
    console.log('All roles: filtering, nested hooks, model-only exclusion and tool grants verified');
  `;
  const script = join(cwd, "probe.mjs");
  await writeFile(script, program);
  const result = spawnSync(process.execPath, [script], {
    cwd, encoding: "utf8", timeout: 60000, env: { ...process.env, PI_OFFLINE: "1" },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /All roles:/);
});
