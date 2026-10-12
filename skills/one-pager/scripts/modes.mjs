export const MODES = Object.freeze([
  { id: 'briefing', label: 'Briefing', description: 'Findings, evidence, and recommendations.' },
  { id: 'guide', label: 'Guide', description: 'Steps, instructions, and practical examples.' },
  { id: 'explainer', label: 'Explainer', description: 'Concepts, relationships, and visualizations.' },
  { id: 'decision-review', label: 'Decision review', description: 'Choices, trade-offs, risks, and feedback.' },
]);

export function validateModes(value, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum || value.length > 4 ||
      new Set(value).size !== value.length || value.some(id => !MODES.some(m => m.id === id))) {
    throw new Error(`Expected ${minimum}–4 distinct modes: ${MODES.map(m => m.id).join(', ')}`);
  }
  return [...value];
}

export function modeOptions(recommended) {
  validateModes(recommended);
  return [...MODES, { id: 'combine', label: 'Combine modes', description: 'Blend two or more modes into one coherent document.' }]
    .map(m => ({ value: m.id, label: m.label + ((recommended.length > 1 ? m.id === 'combine' : m.id === recommended[0]) ? ' (recommended)' : ''), description: m.description }));
}
