import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicJson, readJson } from '../vendor/pi-interactive-subagents/pi-extension/subagents/control.ts';
import { isPaneHideRequest, requestPaneHide } from '../vendor/pi-interactive-subagents/pi-extension/subagents/pane-control.ts';

test('pane-hide requests reject malformed/unsupported payloads',()=>{
  for(const value of [null, [], {}, {action:'reveal',runId:'a',requestId:'r'}, {action:'hide',runId:'',requestId:'r'}, {action:'hide',runId:'a',requestId:'x'.repeat(101)}]) assert.equal(isPaneHideRequest(value),false);
  assert.equal(isPaneHideRequest({action:'hide',runId:'a',requestId:'r'}),true);
});

test('hide confirmation is correlated and timeout retires only its own request',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pi-pane-control-'));
  const session=join(dir,'worker');
  const waiting=requestPaneHide(session,'a');
  const request=readJson(session+'.pane-request');
  atomicJson(session+'.pane-response',{runId:'a',requestId:'stale',status:'hidden'});
  let finished=false;waiting.then(()=>{finished=true;},()=>{});
  await new Promise(resolve=>setTimeout(resolve,70));assert.equal(finished,false,'stale response cannot acknowledge new command');
  atomicJson(session+'.pane-response',{runId:'a',requestId:request.requestId,status:'hidden'});
  await waiting;assert.equal(existsSync(session+'.pane-request'),false);assert.equal(existsSync(session+'.pane-response'),false);
  const error=requestPaneHide(session,'a');
  const errorRequest=readJson(session+'.pane-request');
  atomicJson(session+'.pane-response',{runId:'a',requestId:errorRequest.requestId,status:'error',error:'pane move failed'});
  await assert.rejects(error,/pane move failed/);
  const timeout=requestPaneHide(session,'a');
  await assert.rejects(timeout,/not confirmed/);
  assert.equal(existsSync(session+'.pane-request'),false,'timed-out request cannot move a pane later');
  const superseded=requestPaneHide(session,'a');
  atomicJson(session+'.pane-request',{action:'hide',runId:'a',requestId:'newer'});
  await assert.rejects(superseded,/not confirmed/);
  assert.equal(readJson(session+'.pane-request').requestId,'newer','do not erase a newer request');
});
