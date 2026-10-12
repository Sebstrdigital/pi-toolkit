(() => {
  'use strict';
  const meta = JSON.parse(document.getElementById('document-meta').textContent);
  document.getElementById('expand-all').addEventListener('click', () => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  document.getElementById('collapse-all').addEventListener('click', () => document.querySelectorAll('details').forEach(d => { d.open = false; }));
  // Hash links to complete documents must reveal their collapsed contents.
  function revealTarget() {
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    let parent = target;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }
  window.addEventListener('hashchange', revealTarget);
  revealTarget();
  if (!meta.decisions.length) return;

  const key = `one-pager-review:${meta.contentHash}`;
  const allowed = new Set(['pending', 'accept', 'changes', 'undecided']);
  const selections = [...document.querySelectorAll('[data-decision]')];
  const comments = [...document.querySelectorAll('[data-comment]')];
  const overall = document.getElementById('overall');
  const overallComment = document.getElementById('overall-comment');
  const status = document.getElementById('review-status');
  const preview = document.getElementById('review-preview');
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && saved.contentHash === meta.contentHash) {
      selections.forEach(select => { const choice = saved.decisions?.find(d => d.id === select.dataset.decision); if (allowed.has(choice?.position)) select.value = choice.position; });
      comments.forEach(area => { const choice = saved.decisions?.find(d => d.id === area.dataset.comment); if (typeof choice?.comment === 'string') area.value = choice.comment; });
      if (allowed.has(saved.overall?.position)) overall.value = saved.overall.position;
      if (typeof saved.overall?.comment === 'string') overallComment.value = saved.overall.comment;
    }
  } catch { storageAvailable = false; }

  function review() {
    return {
      schemaVersion: 1, kind: 'one-pager-review-draft', ...meta,
      exportedAt: new Date().toISOString(),
      authority: 'Draft feedback only. Submit explicitly through the project acceptance process. Not implementation authorization.',
      overall: { position: overall.value, comment: overallComment.value },
      decisions: meta.decisions.map((d, i) => ({ ...d, position: selections[i].value, comment: comments[i].value })),
    };
  }
  function reviewText(value) {
    const lines = [`Review draft: ${value.title}`, `Content SHA-256: ${value.contentHash}`, `Presentation SHA-256: ${value.specSha256}`, value.authority, '', `Overall: ${value.overall.position}`, value.overall.comment, '', 'Source identities:'];
    value.sources.forEach(s => lines.push(`${s.id}: ${s.label} — ${s.path || s.url}${s.sha256 ? ` (SHA-256: ${s.sha256})` : ''}`));
    lines.push('', 'All decisions (including unreviewed):');
    value.decisions.forEach(d => lines.push('', `${d.title}: ${d.position}`, `Proposal: ${d.proposal}`, `Sources: ${d.references.join(', ')}`, d.comment));
    return lines.join('\n');
  }
  function update() {
    const value = review();
    preview.textContent = reviewText(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; }
    const pending = value.decisions.filter(d => d.position === 'pending').length;
    status.textContent = `${pending} of ${value.decisions.length} decisions not reviewed. ${storageAvailable ? 'Draft saved in this browser (best effort).' : 'Browser storage unavailable; export your review before closing.'}${overall.value === 'accept' && value.decisions.some(d => d.position !== 'accept') ? ' Overall acceptance differs from one or more individual positions; resolve or explain before submission.' : ''}`;
  }
  [...selections, ...comments, overall, overallComment].forEach(el => el.addEventListener('input', update));
  function download(content, extension, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = `one-pager-review-${meta.contentHash.slice(0, 12)}.${extension}`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  document.getElementById('download-review').addEventListener('click', () => download(JSON.stringify(review(), null, 2) + '\n', 'json', 'application/json'));
  document.getElementById('download-text').addEventListener('click', () => download(reviewText(review()) + '\n', 'txt', 'text/plain'));
  document.getElementById('copy-review').addEventListener('click', async () => {
    const button = document.getElementById('copy-review');
    try {
      await navigator.clipboard.writeText(reviewText(review())); button.textContent = 'Copied!';
    } catch {
      preview.closest('details').open = true;
      const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(preview); selection.removeAllRanges(); selection.addRange(range);
      button.textContent = 'Select/copy preview, or download';
    }
  });
  update();
})();
