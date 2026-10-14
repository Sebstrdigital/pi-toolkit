import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../vendor/pi-interactive-subagents/pi-extension/subagents/surface-ownership.ts', import.meta.url));
for (const scenario of ['launch-failure', 'session-failure', 'launch-keeper-failure', 'keeper-close-failure', 'worker-close-failure', 'restore-failure', 'legacy-owned-reload']) {
  test(`owned parking: ${scenario} retains failures and retries only owned resources`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi-worker-parking-'));
    const bin = join(dir, 'bin'); mkdirSync(bin);
    writeFileSync(join(bin, 'tmux'), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_LOG"
case "$1" in
 display-message) case "$*" in *pane_width*) printf '80 50 160 50\\n' ;; *window_width*) printf '160 50\\n' ;; *) printf '$parent\\n' ;; esac ;;
 new-session) [ ! -f "$FIXTURE/fail-session" ] || exit 23; printf '$parking %%anchor\\n' ;;
 new-window) [ ! -f "$FIXTURE/fail-launch" ] || exit 24; printf '%%worker\\n' ;;
 kill-pane) if [ "$3" = %anchor ]; then [ ! -f "$FIXTURE/fail-keeper" ] || exit 29; else [ ! -f "$FIXTURE/fail-worker" ] || exit 28; fi ;;
 resize-pane) [ ! -f "$FIXTURE/fail-restore" ] || exit 27 ;;
 join-pane|break-pane|select-pane) exit 0 ;;
 *) exit 99 ;;
esac
`, { mode: 0o755 });
    const program = `
      import assert from 'node:assert/strict';
      import {writeFileSync, unlinkSync, readFileSync} from 'node:fs';
      import {execFileSync} from 'node:child_process';
      import {pathToFileURL} from 'node:url';
      const dir=${JSON.stringify(dir)}, scenario=${JSON.stringify(scenario)};
      if(scenario==='legacy-owned-reload') {
        // Pre-parking createSurface used a parent-session new-window, with no parking Set.
        const pane=execFileSync('tmux',['new-window','-d','-t','$parent','-P','-F','#{pane_id}'],{encoding:'utf8'}).trim();
        const key=Symbol.for('pi-toolkit/delivery-tmux/owned-surfaces/'+pathToFileURL(${JSON.stringify(source)}).href);
        globalThis[key]=new Map([[pane,{runId:'legacy',sessionFile:dir+'/legacy',delivery:true}]]);
      }
      const own = await import(${JSON.stringify(source)});
      const fail=name=>writeFileSync(dir+'/fail-'+name,'fail');
      const clear=name=>unlinkSync(dir+'/fail-'+name);
      const log=()=>readFileSync(process.env.FAKE_LOG,'utf8');
      const create=()=>own.createOwnedSurface('worker',{runId:'run',sessionFile:dir+'/worker',delivery:true});
      if(scenario==='legacy-owned-reload') {
        assert.equal(own.hasUnreconciledSurfaces(new Set()),true,'Retained old ownership survives new module loading');
        own.closeOwnedSurface('%worker','legacy');
        assert.equal((log().match(/kill-pane -t %worker/g)||[]).length,1,'Unregistered owned worker still requires confirmed closure');
        assert.equal(own.hasUnreconciledSurfaces(new Set()),false);
        assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
        assert.ok(!log().includes('new-session'),'Closing a legacy surface does not allocate parking');
      } else if(scenario==='session-failure') {
        fail('session');assert.throws(create,/new-session/);
        assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
        assert.ok(!log().includes('kill-pane'),'No resource was allocated');
      } else if(scenario==='launch-failure'||scenario==='launch-keeper-failure') {
        fail('launch');if(scenario==='launch-keeper-failure')fail('keeper');
        assert.throws(create,/new-window/,'Original worker launch error remains authoritative');
        if(scenario==='launch-keeper-failure') {
          assert.equal(own.cleanupOwnedSurfaces().length,1);
          clear('keeper');
        }
        assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
        assert.ok(!log().includes('kill-pane -t %worker'));
        clear('launch');const pane=create();own.closeOwnedSurface(pane,'run');
        const names=[...log().matchAll(/new-session -d -s (pi-workers-\\S+)/g)].map(m=>m[1]);
        assert.equal(new Set(names).size,names.length,'Later parking allocation uses a fresh name');
      } else {
        const pane=create();
        if(scenario==='restore-failure') {
          own.revealOwnedSurface(pane,'run');fail('restore');
          assert.throws(()=>own.hideOwnedSurface(pane,'run'),/resize-pane/);
          const moves=log().split('break-pane').length;
          clear('restore');own.revealOwnedSurface(pane,'run');own.hideOwnedSurface(pane,'run');
          assert.equal(log().split('break-pane').length,moves+1,'Retry restores geometry without re-breaking an already-hidden pane');
        } else {
          const fault=scenario==='keeper-close-failure'?'keeper':'worker';fail(fault);
          assert.throws(()=>own.closeOwnedSurface(pane,'run'),/kill-pane/);
          assert.equal(own.hasUnreconciledSurfaces(new Set()),true);
          clear(fault);
        }
        own.closeOwnedSurface(pane,'run');assert.deepEqual(own.cleanupOwnedSurfaces(),[]);
        if(scenario==='keeper-close-failure') assert.equal((log().match(/kill-pane -t %worker/g)||[]).length,1,'Keeper retry cannot kill an already-closed worker');
      }
      if(scenario!=='legacy-owned-reload') assert.ok(!log().includes('new-window -d -t $parent'));
      assert.ok(!log().includes('kill-pane -t %parent'));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
      encoding: 'utf8', timeout: 15000, cwd: dir,
      env: { ...process.env, HOME: dir, ENV: '', BASH_ENV: '', ZDOTDIR: dir, TMUX: 'fake', TMUX_PANE: '%parent', PATH: bin + ':/usr/bin:/bin', FIXTURE: dir, FAKE_LOG: join(dir, 'tmux.log') },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}
