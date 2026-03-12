#!/usr/bin/env node
// Build the site with only the specified artists included in dist/.
//
// Usage:
//   node scripts/build-artists.js wu-tang-clan
//   node scripts/build-artists.js wu-tang-clan kendrick-lamar
//   ARTISTS=wu-tang-clan,kendrick-lamar node scripts/build-artists.js
//
// If no artists are specified, all artists are included (same as npm run build).

import { build } from 'vite';
import fs from 'fs';
import path from 'path';

// Resolve Windows-compatible absolute path to project root
const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

// Resolve which artists to include
const fromEnv = process.env.ARTISTS?.split(',').map(s => s.trim()).filter(Boolean) || [];
const fromArgs = process.argv.slice(2);
const selected = [...new Set([...fromEnv, ...fromArgs])];

// Run the Vite build
console.log('Building...');
await build({ root: ROOT });

if (selected.length === 0) {
  console.log('\nNo artist filter specified — all artists included.');
  process.exit(0);
}

console.log(`\nFiltering dist/ to: ${selected.join(', ')}`);

const distData = path.join(ROOT, 'dist', 'data');
const manifestPath = path.join(distData, 'manifest.json');
const artistsDir = path.join(distData, 'artists');

// Remove unselected artist directories from dist/
if (fs.existsSync(artistsDir)) {
  for (const dir of fs.readdirSync(artistsDir)) {
    if (!selected.includes(dir)) {
      fs.rmSync(path.join(artistsDir, dir), { recursive: true, force: true });
      console.log(`  removed dist/data/artists/${dir}`);
    }
  }
}

// Rewrite manifest to only include selected artists
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const before = manifest.artists.length;
  manifest.artists = manifest.artists.filter(a => selected.includes(a.slug));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  manifest: ${before} → ${manifest.artists.length} artist(s)`);
}

// Warn about any requested slugs that don't exist
for (const slug of selected) {
  const dir = path.join(artistsDir, slug);
  if (!fs.existsSync(dir)) {
    console.warn(`  warning: no data found for "${slug}" — was it scraped?`);
  }
}

console.log('\nDone. Deploy the dist/ directory.');
