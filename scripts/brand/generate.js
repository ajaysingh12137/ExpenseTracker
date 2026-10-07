// Generates every brand asset from design.js into the project.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const d = require('./design');

// Usage: npm i --no-save sharp && node scripts/brand/generate.js
const ROOT = path.resolve(__dirname, '../..');
const RES = path.join(ROOT, 'android/app/src/main/res');
const BRAND_DIR = path.join(ROOT, 'docs/brand');
const SHIFT = { x: -2, y: -2 };

const hex = c => `#FF${c.slice(1).toUpperCase()}`;
const write = (p, s) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
};

// ---------------------------------------------------------------- Android vector drawables
const VEC_HEAD = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from docs/brand/brand-mark.svg. Edit the design, not this file. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">`;

const gradientFill = (from, to, x0, y0, x1, y1) => `
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="${x0}" android:startY="${y0}" android:endX="${x1}" android:endY="${y1}">
                <item android:offset="0" android:color="${hex(from)}" />
                <item android:offset="1" android:color="${hex(to)}" />
            </gradient>
        </aapt:attr>`;

const highlight = (cx, cy, r) => `
        <aapt:attr name="android:fillColor">
            <gradient android:type="radial" android:centerX="${cx}" android:centerY="${cy}" android:gradientRadius="${r}">
                <item android:offset="0" android:color="#47FFFFFF" />
                <item android:offset="1" android:color="#00FFFFFF" />
            </gradient>
        </aapt:attr>`;

const glyphPaths = (color, accent) =>
  `${d.RUPEE.map(
    p => `
        <path android:pathData="${p}" android:strokeColor="${color}" android:strokeWidth="${d.STROKE}"
            android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000" />`,
  ).join('')}
    </group>
    <path android:pathData="${d.SPARK}" android:fillColor="${accent}" />`;

const background = `${VEC_HEAD}
    <path android:pathData="M0,0h108v108h-108z">${gradientFill(d.BRAND.from, d.BRAND.to, 0, 0, 108, 108)}
    </path>
    <path android:pathData="M0,0h108v108h-108z">${highlight(27, 16, 81)}
    </path>
</vector>
`;

const foreground = `${VEC_HEAD}
    <group android:translateX="${SHIFT.x}" android:translateY="${SHIFT.y}">${glyphPaths('#FFFFFFFF', hex(d.BRAND.accent))}
</vector>
`;

// Android 13+ themed icons: single colour, the system tints it.
const monochrome = `${VEC_HEAD}
    <group android:translateX="${SHIFT.x}" android:translateY="${SHIFT.y}">${glyphPaths('#FF000000', '#FF000000')}
</vector>
`;

// Splash: brand squircle with the glyph, small enough to sit inside the splash's circular mask.
const S = 0.46; // squircle side as a fraction of the canvas
const side = 108 * S;
const off = (108 - side) / 2;
const splash = `${VEC_HEAD}
    <group android:translateX="${off}" android:translateY="${off}">
        <path android:pathData="M${0.28 * side},0 H${0.72 * side} C${0.9 * side},0 ${side},${0.1 * side} ${side},${
  0.28 * side
} V${0.72 * side} C${side},${0.9 * side} ${0.9 * side},${side} ${0.72 * side},${side} H${0.28 * side} C${
  0.1 * side
},${side} 0,${0.9 * side} 0,${0.72 * side} V${0.28 * side} C0,${0.1 * side} ${0.1 * side},0 ${0.28 * side},0 Z">${gradientFill(
  d.BRAND.from,
  d.BRAND.to,
  0,
  0,
  side,
  side,
)}
        </path>
        <group android:scaleX="${S}" android:scaleY="${S}">
            <group android:translateX="${SHIFT.x}" android:translateY="${SHIFT.y}">${glyphPaths('#FFFFFFFF', hex(d.BRAND.accent)).replace(
  '\n    </group>',
  '\n            </group>',
)}
        </group>
    </group>
</vector>
`;

write(path.join(RES, 'drawable/ic_launcher_background.xml'), background);
write(path.join(RES, 'drawable/ic_launcher_foreground.xml'), foreground);
write(path.join(RES, 'drawable/ic_launcher_monochrome.xml'), monochrome);
write(path.join(RES, 'drawable/splash_icon.xml'), splash);

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;
write(path.join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
write(path.join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);

// ---------------------------------------------------------------- PNGs
const shifted = svg => svg.replace(/translate\(-2 0\)/, `translate(${SHIFT.x} ${SHIFT.y})`);

async function png(svg, size, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(shifted(svg)), { density: 384 }).resize(size, size).png().toFile(out);
}

(async () => {
  // Legacy launcher icons (Android 7.x has no adaptive icons).
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [dpi, size] of Object.entries(densities)) {
    await png(d.legacyIconSvg(size, false), size, path.join(RES, `mipmap-${dpi}/ic_launcher.png`));
    await png(d.legacyIconSvg(size, true), size, path.join(RES, `mipmap-${dpi}/ic_launcher_round.png`));
  }
  // Play Store listing icon: 512x512, full square (Play applies its own mask).
  await png(d.iconSvg(512, 'square'), 512, path.join(BRAND_DIR, 'play-store-icon-512.png'));
  await png(d.iconSvg(1024, 'squircle'), 1024, path.join(BRAND_DIR, 'brand-mark-1024.png'));
  write(path.join(BRAND_DIR, 'brand-mark.svg'), shifted(d.iconSvg(1024, 'squircle')));
  write(path.join(BRAND_DIR, 'brand-mark-square.svg'), shifted(d.iconSvg(1024, 'square')));
  console.log('ok');
})();
