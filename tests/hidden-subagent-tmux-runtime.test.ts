import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('isolated real tmux preserves pane/process identities, parallel workers, caller layout and unrelated panes', t => {
  const located=spawnSync('sh',['-c','command -v tmux'],{encoding:'utf8'});
  if(located.status!==0) { t.skip('tmux binary unavailable; real runtime check not performed'); return; }
  const tmux=located.stdout.trim();
  const dir=mkdtempSync(join(tmpdir(),'pi-hidden-runtime-'));
  // Every command uses an explicit unique socket, never the user's TMUX socket.
  const socket=join(dir,'socket');
  const args=['-S',socket,'-f','/dev/null'];
  const env={...process.env,HOME:dir,ENV:'',BASH_ENV:'',ZDOTDIR:dir,TMUX:'',TMUX_PANE:''};
  const run=(...command:string[])=>execFileSync(tmux,[...args,...command],{encoding:'utf8',env}).trim();
  try {
    run('new-session','-d','-s','hidden-test','-x','160','-y','50','/bin/sh');
    const parent=run('display-message','-p','-t','hidden-test','#{pane_id}');
    const parentWindow=run('display-message','-p','-t',parent,'#{window_id}');
    const unrelated=run('split-window','-d','-h','-t',parent,'-P','-F','#{pane_id}','/bin/sh');
    const other=run('new-window','-d','-t','hidden-test','-P','-F','#{pane_id}','/bin/sh');
    run('set-option','-g','default-shell','/bin/sh');
    run('new-session','-d','-s','pi-workers-unrelated','/bin/sh');
    const bin=join(dir,'bin');mkdirSync(bin);
    writeFileSync(join(bin,'tmux'),`#!/bin/sh\nexec '${tmux.replace(/'/g,"'\\''")}' -S '${socket}' -f /dev/null "$@"\n`,{mode:0o755});
    const code=`
      import assert from 'node:assert/strict';
      import {execFileSync} from 'node:child_process';
      import {pathToFileURL} from 'node:url';
      const own=await import(${JSON.stringify(resolve(root,'vendor/pi-interactive-subagents/pi-extension/subagents/surface-ownership.ts'))});
      const cmd=(...a)=>execFileSync('tmux',a,{encoding:'utf8'}).trim();
      const field=(pane,format)=>cmd('display-message','-p','-t',pane,format);
      const parent=${JSON.stringify(parent)}, unrelated=${JSON.stringify(unrelated)}, other=${JSON.stringify(other)}, parentWindow=${JSON.stringify(parentWindow)};
      const parentPid=field(parent,'#{pane_pid}'), unrelatedPid=field(unrelated,'#{pane_pid}'), otherPid=field(other,'#{pane_pid}');
      const layout=field(parent,'#{window_layout}');
      const parentSession=field(parent,'#{session_id}');
      const windows=()=>cmd('list-windows','-t',parentSession,'-F','#{window_id}').split('\\n').sort();
      const originalWindows=windows();
      const originalSessions=cmd('list-sessions','-F','#{session_id}');
      const a=own.createOwnedSurface('alpha',{runId:'a',sessionFile:${JSON.stringify(join(dir,'a'))},delivery:true});
      const b=own.createOwnedSurface('beta',{runId:'b',sessionFile:${JSON.stringify(join(dir,'b'))},delivery:true});
      const aPid=field(a,'#{pane_pid}'), bPid=field(b,'#{pane_pid}');
      assert.deepEqual(windows(),originalWindows,'hidden launches must not add windows to the parent session');
      assert.notEqual(field(a,'#{session_id}'),parentSession);
      assert.equal(field(a,'#{session_id}'),field(b,'#{session_id}'),'workers share an owned detached parking session');
      assert.equal(field(parent,'#{window_layout}'),layout,'launch must not change caller layout');
      assert.notEqual(field(a,'#{window_id}'),parentWindow);assert.notEqual(field(b,'#{window_id}'),parentWindow);
      assert.equal(field(parent,'#{pane_active}'),'1','launch must not steal focus');
      own.revealOwnedSurface(a,'a'); assert.equal(field(a,'#{window_id}'),parentWindow);assert.equal(field(a,'#{pane_active}'),'1');
      assert.deepEqual(windows(),originalWindows,'reveal adds only a pane, not a parent-session window');
      own.revealOwnedSurface(a,'a'); assert.equal(field(a,'#{pane_pid}'),aPid);
      own.revealOwnedSurface(b,'b'); assert.notEqual(field(a,'#{window_id}'),parentWindow); assert.equal(field(b,'#{window_id}'),parentWindow);
      const {requestPaneHide}=await import(${JSON.stringify(resolve(root,'vendor/pi-interactive-subagents/pi-extension/subagents/pane-control.ts'))});
      const hiding=requestPaneHide(${JSON.stringify(join(dir,'b'))},'b');
      own.processOwnedPaneRequests();await hiding;
      assert.notEqual(field(b,'#{window_id}'),parentWindow,'worker-originated hide parks the existing pane');
      assert.notEqual(field(b,'#{session_id}'),parentSession);
      assert.deepEqual(windows(),originalWindows,'switch/hide must not add parent-session windows');
      own.hideOwnedSurface();own.hideOwnedSurface();
      assert.equal(field(a,'#{pane_pid}'),aPid); assert.equal(field(b,'#{pane_pid}'),bPid);
      assert.equal(field(parent,'#{pane_active}'),'1');
      assert.equal(field(parent,'#{window_layout}'),layout,'hide restores caller split layout');
      assert.equal(field(parent,'#{pane_pid}'),parentPid);assert.equal(field(unrelated,'#{pane_pid}'),unrelatedPid);assert.equal(field(other,'#{pane_pid}'),otherPid);
      assert.throws(()=>own.revealOwnedSurface(unrelated,'a'),/owned/);
      own.revealOwnedSurface(a,'a');own.closeOwnedSurface(a,'a');own.closeOwnedSurface(b,'b');
      assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
      assert.equal(cmd('list-sessions','-F','#{session_id}'),originalSessions,'last close releases the owned parking anchor/session');
      // A lone shown worker must remain hideable, then closing it releases parking.
      const lone=own.createOwnedSurface('lone',{runId:'lone',sessionFile:${JSON.stringify(join(dir,'lone'))},delivery:true});
      const lonePid=field(lone,'#{pane_pid}');
      own.revealOwnedSurface(lone,'lone');own.hideOwnedSurface(lone,'lone');
      assert.equal(field(lone,'#{pane_pid}'),lonePid);
      assert.notEqual(field(lone,'#{session_id}'),parentSession);
      assert.deepEqual(windows(),originalWindows);
      own.closeOwnedSurface(lone,'lone');assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
      assert.equal(cmd('list-sessions','-F','#{session_id}'),originalSessions);
      // Resize while shown: restore the caller's proportional share, not stale dimensions.
      const resized=own.createOwnedSurface('resized',{runId:'resize',sessionFile:${JSON.stringify(join(dir,'resize'))},delivery:true});
      own.revealOwnedSurface(resized,'resize');cmd('resize-window','-t',parentWindow,'-x','200','-y','60');
      own.hideOwnedSurface(resized,'resize');assert.equal(field(parent,'#{pane_width}'),'100');
      own.closeOwnedSurface(resized,'resize');cmd('resize-window','-t',parentWindow,'-x','160','-y','50');
      // If someone adds their own window to parking, cleanup closes only owned panes.
      const guarded=own.createOwnedSurface('guarded',{runId:'guard',sessionFile:${JSON.stringify(join(dir,'guard'))},delivery:true});
      const parking=field(guarded,'#{session_id}');
      const foreign=cmd('new-window','-d','-t',parking,'-P','-F','#{pane_id}','/bin/sh');
      const foreignPid=field(foreign,'#{pane_pid}');
      own.closeOwnedSurface(guarded,'guard');assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
      assert.equal(field(foreign,'#{pane_pid}'),foreignPid,'Cleanup never kills another pane added to parking');
      const fresh=own.createOwnedSurface('fresh',{runId:'fresh',sessionFile:${JSON.stringify(join(dir,'fresh'))},delivery:true});
      assert.notEqual(field(fresh,'#{session_id}'),parking,'Do not adopt a leftover session containing foreign panes');
      own.closeOwnedSurface(fresh,'fresh');assert.deepEqual(windows(),originalWindows);
      assert.equal(field(foreign,'#{pane_pid}'),foreignPid);
      // Pre-parking retained ownership: actual legacy parent-session pane must close.
      const legacy=cmd('new-window','-d','-t',parentSession,'-P','-F','#{pane_id}','/bin/sh');
      const ownershipKey=Symbol.for('pi-toolkit/delivery-tmux/owned-surfaces/'+pathToFileURL(${JSON.stringify(resolve(root,'vendor/pi-interactive-subagents/pi-extension/subagents/surface-ownership.ts'))}).href);
      globalThis[ownershipKey].set(legacy,{runId:'legacy',sessionFile:${JSON.stringify(join(dir,'legacy'))},delivery:true});
      assert.equal(windows().length,originalWindows.length+1);
      own.closeOwnedSurface(legacy,'legacy');assert.deepEqual(windows(),originalWindows,'Closing a retained legacy worker removes its old parent window');
      assert.ok(!cmd('list-panes','-a','-F','#{pane_id}').split('\\n').includes(legacy),'Retained legacy pane is actually gone');
      assert.equal(field(parent,'#{pane_pid}'),parentPid);
      assert.equal(field(parent,'#{pane_pid}'),parentPid);assert.equal(field(unrelated,'#{pane_pid}'),unrelatedPid);assert.equal(field(other,'#{pane_pid}'),otherPid);
      console.log(JSON.stringify({parent,unrelated,other,workerA:a,workerB:b,aPid,bPid,identityPreserved:true,callerLayoutPreserved:true}));
    `;
    const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:15000,cwd:dir,env:{...env,TMUX:'isolated-test',TMUX_PANE:parent,PATH:bin+':/usr/bin:/bin'}});
    console.log(`Isolated socket: ${socket}\n${result.stdout}`);
    assert.equal(result.status,0,result.stderr);
  } finally {
    // Only this fixture's explicitly addressed server is shut down.
    spawnSync(tmux,[...args,'kill-server'],{env,encoding:'utf8'});
  }
});
