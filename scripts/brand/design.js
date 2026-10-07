// Single source of truth for the Notch brand mark. 108x108 grid = Android adaptive icon
// canvas; everything important stays inside the 66-unit safe circle around (54,54).
//
// Mark: four tally strokes crossed by a gold fifth -- "every rupee, noted".
const BRAND = {
  from: '#1E1B4B', // midnight indigo
  to: '#4F46E5', // brand indigo
  accent: '#FFD58A', // gold: the automatic fifth stroke
};

// White tally strokes (round caps).
const STROKES = ['M36 32 V76', 'M48 32 V76', 'M60 32 V76', 'M72 32 V76'];
const STROKE = 6.5;

// Gold diagonal that "closes" the tally.
const SLASH = 'M28 70 L80 38';
const SLASH_WIDTH = 7.5;

function glyphSvg({ color = '#FFFFFF', accent = BRAND.accent } = {}) {
  return `<g fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round">${STROKES.map(
    d => `<path d="${d}"/>`,
  ).join('')}</g><path d="${SLASH}" fill="none" stroke="${accent}" stroke-width="${SLASH_WIDTH}" stroke-linecap="round"/>`;
}

function backgroundSvg(from = BRAND.from, to = BRAND.to) {
  return `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/>
    <stop offset="1" stop-color="${to}"/>
  </linearGradient>
  <radialGradient id="hl" cx="0.25" cy="0.15" r="0.75">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="108" height="108" fill="url(#bg)"/>
<rect width="108" height="108" fill="url(#hl)"/>`;
}

/** Full icon as SVG. mask: 'square' (full bleed), 'squircle', or 'circle'. */
function iconSvg(size, mask = 'square', colors = {}) {
  const clip =
    mask === 'circle'
      ? '<clipPath id="m"><circle cx="54" cy="54" r="54"/></clipPath>'
      : mask === 'squircle'
      ? '<clipPath id="m"><rect width="108" height="108" rx="30" ry="30"/></clipPath>'
      : '';
  const open = clip ? `<g clip-path="url(#m)">` : '<g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">${
    clip ? `<defs>${clip}</defs>` : ''
  }${open}${backgroundSvg(colors.from, colors.to)}${glyphSvg()}</g></svg>`;
}

/** Legacy (pre-Android 8) launcher icons show the full 108 canvas; zoom to the 72 visible area. */
function legacyIconSvg(size, round) {
  const clip = round
    ? '<clipPath id="m"><circle cx="54" cy="54" r="36"/></clipPath>'
    : '<clipPath id="m"><rect x="18" y="18" width="72" height="72" rx="16" ry="16"/></clipPath>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="18 18 72 72"><defs>${clip}</defs><g clip-path="url(#m)">${backgroundSvg()}${glyphSvg()}</g></svg>`;
}

module.exports = {
  BRAND,
  STROKES,
  STROKE,
  SLASH,
  SLASH_WIDTH,
  iconSvg,
  legacyIconSvg,
  glyphSvg,
  backgroundSvg,
};
