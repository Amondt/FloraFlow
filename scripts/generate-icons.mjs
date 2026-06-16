// Regenerates the PWA maskable app icons from the Flow Leaf brand mark.
// Edit the SVG below if the mark changes, then run: bun run icons
//
// Maskable icons are full-bleed (no rounded corners — the OS applies its own mask);
// the leaf sits well inside the central 80% safe zone so squircle/circle crops never clip it.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT = 'public/icons';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10b981" /><stop offset="1" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect width="48" height="48" fill="url(#bg)" />
  <path d="M9 39 C 9 21, 21 9, 39 9 C 39 27, 27 39, 9 39 Z" fill="#ffffff" />
  <path d="M14.5 33.5 C 24 30, 20.5 19.5, 33 14.5" fill="none" stroke="#047857" stroke-width="2.4" stroke-linecap="round" />
</svg>`;

mkdirSync(OUT, { recursive: true });
const buf = Buffer.from(svg);
await Promise.all(
  SIZES.map((size) =>
    sharp(buf, { density: 512 }).resize(size, size).png().toFile(`${OUT}/icon-${size}x${size}.png`),
  ),
);
console.log(`Generated ${SIZES.length} maskable icons in ${OUT}/`);
