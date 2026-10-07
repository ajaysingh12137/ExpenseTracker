// Single source of truth for the brand mark. 108x108 grid = Android adaptive icon canvas;
// everything important stays inside the 66-unit safe circle around (54,54).
const BRAND = {
  from: '#4F46E5', // indigo
  to: '#9333EA', // violet
  accent: '#FFD58A', // warm gold spark ("logged automatically")
};

// Rupee glyph as round-capped strokes (reads cleanly from 24px to 512px).
const RUPEE = [
  'M36 35 H66', // top bar
  'M36 46 H66', // middle bar
  'M44 35 C56 35 61 40 61 45.5 C61 51.5 56 57 46 57 H40', // bowl
  'M40 57 L62 77', // leg
];
const STROKE = 7.5;

// Four-point spark, top right.
const SPARK =
  'M76 25 C76.8 29.6 78.4 31.2 83 32 C78.4 32.8 76.8 34.4 76 39 C75.2 34.4 73.6 32.8 69 32 C73.6 31.2 75.2 29.6 76 25 Z';

function glyphSvg({ color = '#FFFFFF', accent = BRAND.accent, shift = { x: -2, y: 0 } } = {}) {
  const t = `translate(${shift.x} ${shift.y})`;
  return `<g transform="${t}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${RUPEE.map(
    d => `<path d="${d}"/>`,
  ).join('')}</g><path d="${SPARK}" fill="${accent}"/>`;
}

function backgroundSvg() {
  return `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BRAND.from}"/>
    <stop offset="1" stop-color="${BRAND.to}"/>
  </linearGradient>
  <radialGradient id="hl" cx="0.25" cy="0.15" r="0.75">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="108" height="108" fill="url(#bg)"/>
<rect width="108" height="108" fill="url(#hl)"/>`;
}

/** Full icon as SVG. mask: 'square' (full bleed), 'squircle', or 'circle'. */
function iconSvg(size, mask = 'square') {
  const clip =
    mask === 'circle'
      ? '<clipPath id="m"><circle cx="54" cy="54" r="54"/></clipPath>'
      : mask === 'squircle'
      ? '<clipPath id="m"><rect width="108" height="108" rx="30" ry="30"/></clipPath>'
      : '';
  const open = clip ? `<g clip-path="url(#m)">` : '<g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">${
    clip ? `<defs>${clip}</defs>` : ''
  }${open}${backgroundSvg()}${glyphSvg()}</g></svg>`;
}

/** Legacy (pre-Android 8) launcher icons show the full 108 canvas; zoom to the 72 visible area. */
function legacyIconSvg(size, round) {
  const clip = round
    ? '<clipPath id="m"><circle cx="54" cy="54" r="36"/></clipPath>'
    : '<clipPath id="m"><rect x="18" y="18" width="72" height="72" rx="16" ry="16"/></clipPath>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="18 18 72 72"><defs>${clip}</defs><g clip-path="url(#m)">${backgroundSvg()}${glyphSvg()}</g></svg>`;
}

module.exports = { BRAND, RUPEE, STROKE, SPARK, iconSvg, legacyIconSvg, glyphSvg, backgroundSvg };
