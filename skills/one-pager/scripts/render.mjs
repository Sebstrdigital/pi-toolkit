import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModes } from './modes.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const text = (value, name) => { if (typeof value !== 'string' || !value.trim()) throw Error(`${name} must be nonempty text`); return value; };
const array = (value, name) => { if (!Array.isArray(value)) throw Error(`${name} must be an array`); return value; };
const safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; } };

// Escape first; never interpret source HTML or execute document code. This is a
// deliberately small Markdown reader, not a lossy AI rewrite of the source.
function inline(value) {
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s)]+)\)/g;
  let result = '', end = 0;
  for (const match of String(value).matchAll(pattern)) {
    result += escapeHTML(value.slice(end, match.index));
    if (match[1] !== undefined) result += `<code>${escapeHTML(match[1])}</code>`;
    else if (match[2] !== undefined) result += `<strong>${escapeHTML(match[2])}</strong>`;
    else {
      const url = safeURL(match[4]);
      result += url
        ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(match[3])}</a>`
        : `${escapeHTML(match[3])} <span class="muted">(${escapeHTML(match[4])})</span>`;
    }
    end = match.index + match[0].length;
  }
  return result + escapeHTML(value.slice(end));
}
export function renderMarkdown(value) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  let out = '', paragraph = [], list = null;
  const flush = () => { if (paragraph.length) { out += `<p>${paragraph.map(inline).join('<br>')}</p>`; paragraph = []; } if (list) { out += `</${list}>`; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      flush(); const fence = line.match(/^\s*(```+|~~~+)/)[1]; const code = [];
      while (++i < lines.length && !lines[i].trimStart().startsWith(fence)) code.push(lines[i]);
      out += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;
    } else if (/^#{1,6}\s/.test(line)) {
      flush(); const heading = line.match(/^(#{1,6})\s+(.*)$/); const level = Math.min(heading[1].length + 1, 6);
      out += `<h${level}>${inline(heading[2])}</h${level}>`;
    } else if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      flush(); const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      out += `<div class="table-wrap"><table><thead><tr>${cells(line).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`; i++;
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) out += `<tr>${cells(lines[++i]).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`;
      out += '</tbody></table></div>';
    } else if (/^\s*(?:[-*+] |\d+\. )/.test(line)) {
      if (paragraph.length) { out += `<p>${paragraph.map(inline).join('<br>')}</p>`; paragraph = []; }
      const type = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      if (list !== type) { if (list) out += `</${list}>`; out += `<${type}>`; list = type; }
      out += `<li>${inline(line.replace(/^\s*(?:[-*+] |\d+\. )/, ''))}</li>`;
    } else if (!line.trim()) flush();
    else { if (list) { out += `</${list}>`; list = null; } paragraph.push(line); }
  }
  flush(); return out;
}

export function renderDocument(spec, { baseDir = process.cwd(), specBytes = JSON.stringify(spec), generatedAt = new Date().toISOString() } = {}) {
  text(spec.title, 'title'); text(spec.summary, 'summary'); validateModes(spec.modes);
  const sources = array(spec.sources ?? [], 'sources');
  const sourceMap = new Map();
  const docs = [];
  sources.forEach((source, index) => {
    text(source.id, 'source.id'); text(source.label, 'source.label');
    if (sourceMap.has(source.id)) throw Error(`Duplicate source: ${source.id}`);
    if (Boolean(source.path) === Boolean(source.url)) throw Error('Each source needs exactly one path or HTTP(S) URL');
    if (source.url && !safeURL(source.url)) throw Error(`Unsafe source URL: ${source.url}`);
    const item = { ...source, anchor: `source-${index + 1}`, number: index + 1 };
    if (source.path) {
      text(source.path, 'source.path'); const path = resolve(baseDir, source.path);
      const bytes = readFileSync(path);
      const content = bytes.toString('utf8');
      if (bytes.includes(0) || content.includes('\uFFFD')) throw Error(`Source must be a UTF-8 text document: ${path}`);
      const doc = { ...item, path, content, sha256: hash(bytes) }; docs.push(doc); Object.assign(item, doc);
    }
    sourceMap.set(source.id, item);
  });
  const refs = ids => {
    if (ids === undefined) return '';
    return `<span class="citations">${array(ids, 'references').map(id => {
      const source = sourceMap.get(id); if (!source) throw Error(`Unknown source reference: ${id}`);
      return `<a href="#${source.anchor}" title="${escapeHTML(source.label)}" aria-label="Source ${source.number}: ${escapeHTML(source.label)}">[${source.number}]</a>`;
    }).join(' ')}</span>`;
  };
  const sections = array(spec.sections, 'sections');
  if (!sections.length) throw Error('At least one section is required');
  let diagramCount = 0;
  const block = (b, depth = 0) => {
    if (depth > 8) throw Error('Details nesting is too deep');
    const cite = refs(b.references);
    switch (b.type) {
      case 'text': return `<p>${inline(text(b.text, 'block.text'))} ${cite}</p>`;
      case 'list': return `<ul>${array(b.items, 'list.items').map(s => `<li>${inline(text(s, 'list item'))}</li>`).join('')}</ul>${cite}`;
      case 'table': {
        const headers = array(b.headers, 'table.headers');
        return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${inline(text(h, 'table header'))}</th>`).join('')}</tr></thead><tbody>${array(b.rows, 'table.rows').map(row => {
          if (!Array.isArray(row) || row.length !== headers.length) throw Error('Table rows must match headers');
          return `<tr>${row.map(c => `<td>${inline(text(c, 'table cell'))}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div>${cite}`;
      }
      case 'steps': return `<ol class="steps">${array(b.items, 'steps.items').map(s => `<li><h3>${inline(text(s.title, 'step.title'))}</h3><p>${inline(text(s.text, 'step.text'))}</p></li>`).join('')}</ol>${cite}`;
      case 'details': return `<details><summary>${inline(text(b.title, 'details.title'))}</summary>${array(b.blocks, 'details.blocks').map(child => block(child, depth + 1)).join('')}</details>${cite}`;
      case 'diagram': {
        text(b.title, 'diagram.title'); text(b.description, 'diagram.description');
        const nodes = array(b.nodes, 'diagram.nodes'); const edges = array(b.edges, 'diagram.edges');
        if (!nodes.length || nodes.length > 8 || edges.length > 12) throw Error('Keep diagrams to 1–8 nodes and at most 12 edges');
        const positions = new Map();
        nodes.forEach((n, i) => { text(n.id, 'node.id'); text(n.label, 'node.label'); if (positions.has(n.id)) throw Error('Duplicate diagram node'); positions.set(n.id, i); });
        const h = nodes.length * 100 + 40;
        const marker = `arrow-${++diagramCount}`;
        const svgNodes = nodes.map((n, i) => {
          const chunks = text(n.label, 'node.label').match(/.{1,36}(?:\s|$)|.{1,36}/g) ?? [];
          if (chunks.length > 2) throw Error('Diagram node labels must fit two short lines');
          return `<g><rect x="20" y="${20 + i * 100}" width="340" height="70" rx="12"/><text x="190" y="${chunks.length > 1 ? 47 + i * 100 : 61 + i * 100}" text-anchor="middle">${chunks.map((s, j) => `<tspan x="190" dy="${j ? 22 : 0}">${escapeHTML(s.trim())}</tspan>`).join('')}</text></g>`;
        }).join('');
        const svgEdges = edges.map((edge, i) => {
          const from = positions.get(edge.from), to = positions.get(edge.to);
          if (from === undefined || to === undefined || from === to) throw Error('Diagram edges need distinct known endpoints');
          text(edge.label, 'edge.label'); const a = 55 + from * 100, z = 55 + to * 100, x = 390 + i * 12;
          return `<path d="M 360 ${a} H ${x} V ${z} H 366" marker-end="url(#${marker})"/>`;
        }).join('');
        // Text equivalent makes every relationship available without seeing SVG.
        return `<figure><figcaption><strong>${inline(b.title)}</strong> ${cite}<p>${inline(b.description)}</p></figcaption><svg class="diagram" viewBox="0 0 560 ${h}" role="img" aria-label="${escapeHTML(b.title)}"><defs><marker id="${marker}" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" class="arrow"/></marker></defs>${svgEdges}${svgNodes}</svg><ul class="relationships">${edges.map(e => `<li>${inline(nodes[positions.get(e.from)].label)} → ${inline(nodes[positions.get(e.to)].label)}: ${inline(e.label)}</li>`).join('')}</ul></figure>`;
      }
      default: throw Error(`Unknown block type: ${b.type}`);
    }
  };
  const sectionHTML = sections.map((s, i) => `<section id="section-${i + 1}"><div class="section-heading"><span class="eyebrow">${String(i + 1).padStart(2, '0')}</span><h2>${inline(text(s.title, 'section.title'))}</h2></div>${array(s.blocks, 'section.blocks').map(b => block(b)).join('')}</section>`).join('');
  const decisions = array(spec.decisions ?? [], 'decisions');
  if (decisions.length && !spec.modes.includes('decision-review')) throw Error('Decision controls require decision-review mode');
  if (spec.modes.includes('decision-review') && !decisions.length) throw Error('Decision-review needs at least one explicit decision');
  const decisionIds = new Set();
  const decisionHTML = decisions.map((d, i) => {
    text(d.id, 'decision.id'); text(d.title, 'decision.title'); text(d.proposal, 'decision.proposal'); text(d.rationale, 'decision.rationale');
    if (decisionIds.has(d.id)) throw Error('Duplicate decision id'); decisionIds.add(d.id);
    if (!array(d.references, 'decision.references').length) throw Error('Every decision needs a source reference');
    return `<article class="decision" id="decision-${i + 1}"><h3>${inline(d.title)} ${refs(d.references)}</h3><p>${inline(d.proposal)}</p><details><summary>Rationale, alternatives, and consequences</summary><h4>Why this is proposed</h4><p>${inline(d.rationale)}</p><h4>Alternatives</h4><ul>${array(d.alternatives, 'decision.alternatives').map(s => `<li>${inline(text(s, 'alternative'))}</li>`).join('')}</ul><h4>Consequences and risks</h4><ul>${array(d.consequences, 'decision.consequences').map(s => `<li>${inline(text(s, 'consequence'))}</li>`).join('')}</ul></details><div class="review-field"><label for="choice-${i}">Your position</label><select id="choice-${i}" data-decision="${escapeHTML(d.id)}"><option value="pending">Not reviewed</option><option value="accept">Accept</option><option value="changes">Request changes</option><option value="undecided">Undecided</option></select></div><label for="comment-${i}">Your comments</label><textarea id="comment-${i}" data-comment="${escapeHTML(d.id)}" rows="3" placeholder="Questions, requested changes, or conditions…"></textarea></article>`;
  }).join('');
  const reviewHTML = decisions.length ? `<section id="review"><div class="section-heading"><span class="eyebrow">Your say</span><h2>Decisions and feedback</h2></div><p class="notice">These are draft review positions, not formal approval or permission to implement. Opening or scrolling through content does not confirm that you have read it.</p>${decisionHTML}<h3>Overall position</h3><label for="overall">Your position on the complete proposal</label><select id="overall"><option value="pending">Not reviewed</option><option value="accept">Accept proposal</option><option value="changes">Request changes</option><option value="undecided">Undecided</option></select><label for="overall-comment">Overall comments</label><textarea id="overall-comment" rows="4"></textarea><p id="review-status" role="status"></p><div class="actions"><button id="copy-review">Copy review</button><button id="download-review">Download review JSON</button><button id="download-text">Download review text</button></div><p class="muted">Export and submit your review back to the agent. Browser drafts are best-effort only; this page never writes to your project.</p><details><summary>Preview exported review</summary><pre id="review-preview"></pre></details></section>` : '';
  const sourceHTML = [...sourceMap.values()].map(s => `<li id="${s.anchor}"><strong>${inline(s.label)}</strong>${s.url ? ` — <a href="${escapeHTML(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">Open source</a>` : ` — <a href="#document-${s.number}">Read complete document</a><p class="muted source-path">${escapeHTML(s.path)}<br>SHA-256: ${s.sha256}</p>`}</li>`).join('');
  const documents = docs.map(d => `<details id="document-${d.number}" class="source-document"><summary>Complete document: ${inline(d.label)}</summary><p class="muted source-path">${escapeHTML(d.path)} · SHA-256: ${d.sha256}</p><div class="original">${renderMarkdown(d.content)}</div><details><summary>Exact source text (all characters)</summary><pre>${escapeHTML(d.content)}</pre></details></details>`).join('');
  const contentHash = hash(JSON.stringify({ specSha256: hash(specBytes), documents: docs.map(d => ({ path: d.path, sha256: d.sha256 })) }));
  const metadata = { title: spec.title, modes: spec.modes, contentHash, specSha256: hash(specBytes), generatedAt, sources: [...sourceMap.values()].map(s => ({ id: s.id, label: s.label, ...(s.sha256 ? { path: s.path, sha256: s.sha256 } : { url: s.url }) })), decisions: decisions.map(d => ({ id: d.id, title: d.title, proposal: d.proposal, references: d.references })) };
  const nav = sections.map((s, i) => `<a href="#section-${i + 1}">${escapeHTML(s.title)}</a>`).join('') + (decisions.length ? '<a href="#review">Decisions and feedback</a>' : '') + (sources.length ? '<a href="#sources">Sources & complete documents</a>' : '');
  const asset = name => readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8');
  const favicon = `data:image/svg+xml,${encodeURIComponent(asset('favicon.svg'))}`;
  return `<!doctype html>\n<html lang="${escapeHTML(spec.language ?? 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHTML(spec.title)}</title><link rel="icon" type="image/svg+xml" sizes="any" href="${favicon}"><style>${asset('style.css')}</style></head><body><a class="skip-link" href="#content">Skip to content</a><header><div class="eyebrow">One-pager · ${spec.modes.map(escapeHTML).join(' + ')}</div><h1>${inline(spec.title)}</h1><p class="lede">${inline(spec.summary)}</p><p class="muted">Generated ${escapeHTML(generatedAt)} · A local document, not a live service.</p></header><div class="layout"><nav aria-label="Contents"><strong>On this page</strong>${nav}<div class="actions"><button id="expand-all">Expand all details</button><button id="collapse-all">Collapse details</button></div></nav><main id="content">${sectionHTML}${reviewHTML}${sources.length ? `<section id="sources"><h2>Sources & complete documents</h2><ol class="sources">${sourceHTML}</ol>${documents}</section>` : ''}<footer>Generated explanations are presentation aids. Sources remain authoritative. No background network requests.</footer></main></div><script type="application/json" id="document-meta">${JSON.stringify(metadata).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script><script>${asset('review.js')}</script></body></html>\n`;
}

export function renderFile(input, output) {
  const specBytes = readFileSync(input, 'utf8');
  const html = renderDocument(JSON.parse(specBytes), { baseDir: dirname(resolve(input)), specBytes });
  // Creation only: preserve previous artifacts, including conflicting symlinks.
  writeFileSync(output, html, { flag: 'wx', mode: 0o600 });
  return { path: resolve(output), bytes: Buffer.byteLength(html), sha256: hash(html) };
}

let entryPath;
try { if (process.argv[1]) entryPath = realpathSync(process.argv[1]); } catch { /* stdin or another non-file host entry */ }
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2) throw Error('Usage: node render.mjs INPUT.json OUTPUT.html (output must not exist)');
    console.log(JSON.stringify(renderFile(...args)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
