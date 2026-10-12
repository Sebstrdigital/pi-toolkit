import { existsSync, lstatSync, readlinkSync, readFileSync, mkdirSync, symlinkSync, writeFileSync, copyFileSync, chmodSync, mkdtempSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const agent = resolve(process.env.HOME, '.pi/agent');
const options = new Set(process.argv.slice(2));
for (const option of options) if (!['--with-delivery-tmux', '--with-progress', '--hide-thinking', '--with-one-pager'].includes(option)) throw Error(`Unknown option: ${option}`);
const links = [['agent/AGENTS.md', 'AGENTS.md'], ...['debug','grill-me','zoom-out','duadigital-pdf-maker','homelab-validation','delivery','discovery','addy-engineering'].map(n=>[`skills/${n}`,`skills/${n}`]), ['extensions/delivery-worker','extensions/delivery-worker']];
if (options.has('--with-delivery-tmux')) links.push(['extensions/delivery-tmux','extensions/delivery-tmux']);
if (options.has('--with-progress')) links.push(['extensions/lean-progress','extensions/lean-progress']);
if (options.has('--with-one-pager')) links.push(['skills/one-pager','skills/one-pager'], ['extensions/one-pager','extensions/one-pager']);
const present = p => existsSync(p) || (()=>{try { lstatSync(p); return true; } catch(e) { if(e.code==='ENOENT') return false; throw e; }})();
// Preflight ALL destinations and parent directories before any user mutation.
for (const parent of [resolve(process.env.HOME,'.pi'), agent, resolve(agent,'skills'), resolve(agent,'extensions')]) {
  if (present(parent) && (!lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink())) throw Error(`Refusing non-directory or symlink parent: ${parent}`);
}
const missing = [];
for (const [source, target] of links) {
  const p = resolve(agent,target), s = resolve(root,source);
  if (present(p)) {
    if (!lstatSync(p).isSymbolicLink() || readlinkSync(p)!==s) throw Error(`Refusing to overwrite: ${p}`);
  } else missing.push([s,p]);
}
const settingsPath = resolve(agent,'settings.json');
let original = null, updated = null;
if (options.has('--with-progress') || options.has('--hide-thinking')) {
  if (present(settingsPath)) {
    if (!lstatSync(settingsPath).isFile() || lstatSync(settingsPath).isSymbolicLink()) throw Error('Refusing non-regular settings.json');
    original = readFileSync(settingsPath,'utf8');
  }
  const raw = original ?? '{}\n';
  const settings = JSON.parse(raw);
  if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw Error('settings must be an object');
  if (options.has('--with-progress')) {
    for (const key of ['packages','extensions']) {
      if (settings[key] !== undefined && !Array.isArray(settings[key])) throw Error(`${key} must be an array`);
      for (const entry of settings[key] ?? []) {
        const source = typeof entry === 'string' ? entry : entry?.source;
        if (typeof source !== 'string') throw Error(`Invalid ${key} registration`);
        if (/todo|lean-progress|pify\/task|native-todo/i.test(source)) throw Error(`Conflicting progress registration: ${source}`);
      }
    }
    // Known conventional controllers are rejected. Arbitrary controller names
    // are also checked by the installed runtime before toolkit activation.
    for (const name of present(resolve(agent,'extensions')) ? readdirSync(resolve(agent,'extensions')) : []) {
      if (/todo|progress/i.test(name) && name !== 'lean-progress') throw Error(`Conflicting progress target: ${name}`);
    }
  }
  if (options.has('--hide-thinking') && settings.hideThinkingBlock !== true) {
    // Locate top-level value spans without reserializing unrelated bytes.
    let pos=0; const ws=()=>{while (/\s/.test(raw[pos] ?? '') && pos<raw.length) pos++;};
    const string=()=>{ const start=pos++; while(pos<raw.length) {if(raw[pos]==='\\') pos+=2; else if(raw[pos++]==='"') return JSON.parse(raw.slice(start,pos));} throw Error('Bad string'); };
    const value=()=>{ws(); if(raw[pos]==='"') {string();return;} if(raw[pos]==='{' || raw[pos]==='[') {const close=raw[pos++]==='{'?'}':']';ws();while(raw[pos]!==close){if(raw[pos]===',' || raw[pos]===':')pos++;else value();ws();}pos++;return;} while(pos<raw.length && !/[\s,}\]]/.test(raw[pos]))pos++;};
    ws();pos++;ws();const spans=new Map();
    while(raw[pos]!=='}') {const key=string();ws();pos++;ws();const start=pos;value();if(spans.has(key))throw Error('Duplicate settings key');spans.set(key,[start,pos]);ws();if(raw[pos]===','){pos++;ws();}else break;}
    if (spans.has('hideThinkingBlock')) {const [start,end]=spans.get('hideThinkingBlock');updated=raw.slice(0,start)+'true'+raw.slice(end);}
    else updated=raw.slice(0,pos)+(spans.size?',':'')+'"hideThinkingBlock": true'+raw.slice(pos);
  }
}
if (!missing.length && updated===null) process.exit(0);
mkdirSync(agent,{recursive:true});
const backup=mkdtempSync(join(agent,'toolkit-backup-'));chmodSync(backup,0o700);
if (updated!==null && original!==null) {copyFileSync(settingsPath,join(backup,'settings.json'));chmodSync(join(backup,'settings.json'),lstatSync(settingsPath).mode & 0o777);}
writeFileSync(join(backup,'manifest.json'),JSON.stringify({root,settingsChanged:updated!==null,settingsExisted:original!==null,newLinks:missing},null,2)+'\n',{mode:0o600});
mkdirSync(resolve(agent,'skills'),{recursive:true});mkdirSync(resolve(agent,'extensions'),{recursive:true});
for (const [source,target] of missing) symlinkSync(source,target);
if (updated!==null) writeFileSync(settingsPath,updated,{mode:0o600});
console.log(`Toolkit backup/rollback manifest: ${backup}`);
// Preflight avoids known partial failures, not a global transaction: filesystem
// failures or concurrent changes can still interrupt these sequential writes.
