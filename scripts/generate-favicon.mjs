// Regenerates public/favicon.ico from the Flow Leaf brand mark, replacing the stock
// Angular CLI default icon. Run: bun run favicon
//
// Browsers that don't support SVG favicons (or that have a stale favicon-cache entry
// keyed to favicon.ico) fall back to this file — it must show our mark, not the
// Angular shield, or the tab icon looks "stuck" on the old default.
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'node:fs';

const SIZES = [16, 32, 48];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10b981" /><stop offset="1" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="11" fill="url(#bg)" />
  <path d="M9 39 C 9 21, 21 9, 39 9 C 39 27, 27 39, 9 39 Z" fill="#ffffff" />
  <path d="M14.5 33.5 C 24 30, 20.5 19.5, 33 14.5" fill="none" stroke="#047857" stroke-width="2.4" stroke-linecap="round" />
</svg>`;

const svgBuf = Buffer.from(svg);
const pngBuffers = await Promise.all(
  SIZES.map((size) => sharp(svgBuf, { density: 384 }).resize(size, size).png().toBuffer()),
);
const icoBuffer = await pngToIco(pngBuffers);
writeFileSync('public/favicon.ico', icoBuffer);
console.log(`Generated public/favicon.ico from ${SIZES.length} sizes (${SIZES.join(', ')}px)`);
