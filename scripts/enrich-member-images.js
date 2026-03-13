#!/usr/bin/env node
// Fetches member/artist images from the Genius API, downloads them locally,
// and writes the local path into public/data/artists/{slug}/members/{member-slug}.json
// as an "image" field.
//
// Usage:
//   node scripts/enrich-member-images.js                  # all artists
//   node scripts/enrich-member-images.js wu-tang-clan     # one artist

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const GENIUS_API = 'https://api.genius.com';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

async function getToken() {
  const { GENIUS_CLIENT_ID: id, GENIUS_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) {
    console.error('Missing GENIUS_CLIENT_ID / GENIUS_CLIENT_SECRET in .env');
    process.exit(1);
  }
  const res = await axios.post(`${GENIUS_API}/oauth/token`, {
    grant_type: 'client_credentials', client_id: id, client_secret: secret,
  });
  return res.data.access_token;
}

// Returns an ordered array of candidate image URLs (exact matches first, then partial)
async function fetchArtistImageCandidates(token, name) {
  const res = await axios.get(`${GENIUS_API}/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: name, per_page: 10 },
  });
  const hits = res.data.response.hits || [];
  const nameLower = name.toLowerCase();
  const exact = [];
  const partial = [];
  const seen = new Set();
  for (const hit of hits) {
    const a = hit.result.primary_artist;
    if (!a?.image_url || seen.has(a.image_url)) continue;
    seen.add(a.image_url);
    if (a.name?.toLowerCase() === nameLower) exact.push(a.image_url);
    else if (a.name?.toLowerCase().includes(nameLower)) partial.push(a.image_url);
  }
  return [...exact, ...partial];
}

// Returns the saved local path on success, null on failure (404, timeout, etc.)
async function tryDownloadImage(imageUrl, destPath) {
  try {
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const contentType = res.headers['content-type'] || '';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const finalPath = destPath.replace(/\.\w+$/, `.${ext}`);
    fs.writeFileSync(finalPath, Buffer.from(res.data));
    return finalPath;
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const slugFilter = process.argv[2] ? [process.argv[2]] : null;
const manifestPath = path.join(ROOT, 'public/data/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const artists = manifest.artists.filter(a => !slugFilter || slugFilter.includes(a.slug));

if (artists.length === 0) {
  console.error(`No matching artists found. Available: ${manifest.artists.map(a => a.slug).join(', ')}`);
  process.exit(1);
}

const token = await getToken();

for (const artist of artists) {
  console.log(`\n${artist.name}`);
  const configPath = path.join(ROOT, `public/data/artists/${artist.slug}/config.json`);
  if (!fs.existsSync(configPath)) { console.log('  no config.json, skipping'); continue; }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const members = config.members || [];
  if (members.length === 0) { console.log('  no members, skipping'); continue; }

  for (const member of members) {
    const memberPath = path.join(ROOT, `public/data/artists/${artist.slug}/members/${member.slug}.json`);
    if (!fs.existsSync(memberPath)) { console.log(`  [skip] no JSON for ${member.name}`); continue; }

    const data = JSON.parse(fs.readFileSync(memberPath, 'utf8'));

    // Skip only if already saved as a local path; re-download external URLs
    if (data.image && !data.image.startsWith('http')) {
      console.log(`  [skip] ${member.name} already has local image`);
      continue;
    }

    // Build candidate list: existing external URL first (if any), then fresh API results
    let candidates = [];
    if (data.image?.startsWith('http')) candidates.push(data.image);
    await sleep(300);
    const apiCandidates = await fetchArtistImageCandidates(token, member.name);
    // Add API candidates not already in list
    for (const url of apiCandidates) {
      if (!candidates.includes(url)) candidates.push(url);
    }

    if (candidates.length === 0) { console.log(`  [miss] ${member.name} — no image candidates`); continue; }

    const destBase = path.join(ROOT, `public/data/artists/${artist.slug}/members/${member.slug}.jpg`);
    let savedPath = null;
    for (const url of candidates) {
      savedPath = await tryDownloadImage(url, destBase);
      if (savedPath) break;
      console.log(`  [try]  ${member.name} — failed ${url.slice(0, 60)}…`);
    }

    if (savedPath) {
      const relativePath = savedPath.replace(path.join(ROOT, 'public'), '').replace(/\\/g, '/');
      data.image = relativePath;
      fs.writeFileSync(memberPath, JSON.stringify(data, null, 2));
      console.log(`  [ok]   ${member.name} → ${relativePath}`);
    } else {
      console.log(`  [fail] ${member.name} — all ${candidates.length} candidates failed, use manual upload`);
    }
  }
}

console.log('\nDone.');
