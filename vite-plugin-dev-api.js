// vite-plugin-dev-api.js
// Dev-only Vite plugin that adds API middleware for artist search and scraping.
// These routes only exist during `vite dev` and are NOT included in production builds.

import 'dotenv/config';
import axios from 'axios';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import process from 'process';

const GENIUS_API_BASE = 'https://api.genius.com';

let cachedToken = null;

async function getGeniusToken() {
  if (cachedToken) return cachedToken;
  const clientId = process.env.GENIUS_CLIENT_ID;
  const clientSecret = process.env.GENIUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await axios.post(`${GENIUS_API_BASE}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  cachedToken = res.data.access_token;
  return cachedToken;
}

async function searchGenius(query) {
  const token = await getGeniusToken();
  if (!token) throw new Error('Genius API credentials not configured in .env');

  const res = await axios.get(`${GENIUS_API_BASE}/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, per_page: 20 },
  });

  // Extract unique artists from search hits
  const artistMap = new Map();
  for (const hit of res.data.response.hits || []) {
    const a = hit.result.primary_artist;
    if (a && !artistMap.has(a.id)) {
      artistMap.set(a.id, {
        name: a.name,
        slug: a.url?.replace('https://genius.com/artists/', '') || '',
        imageUrl: a.image_url || '',
        url: a.url || '',
        id: a.id,
      });
    }
  }
  return { artists: [...artistMap.values()].slice(0, 8) };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default function devApiPlugin() {
  return {
    name: 'dev-api',
    configureServer(server) {
      // Search Genius API for artists
      server.middlewares.use('/api/search', async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const query = url.searchParams.get('q');
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing q parameter' }));
          return;
        }
        try {
          const results = await searchGenius(query);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Trigger a scrape + enrich run
      server.middlewares.use('/api/scrape', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        try {
          const { artist, slug, chunkSize = 25, offset = 0 } = await readBody(req);
          if (!artist || !slug) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing artist or slug' }));
            return;
          }
          const cmd = `node scrape-lyrics.js --artist "${artist}" --slug "${slug}" --chunk-size ${chunkSize} --offset ${offset} --enrich`;
          exec(cmd, { timeout: 600000 }, (err, stdout, stderr) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: !err, stdout, stderr, error: err?.message }));
          });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Update a member's image — downloads external URLs or saves base64 file uploads locally
      // Body: { artistSlug, memberSlug, imageUrl?, imageBase64?, imageExt? }
      // imageUrl: external URL (will be downloaded) or local /data/... path (stored as-is)
      // imageBase64 + imageExt: raw file upload from the browser
      server.middlewares.use('/api/update-member-image', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        try {
          const { artistSlug, memberSlug, imageUrl, imageBase64, imageExt } = await readBody(req);
          if (!artistSlug || !memberSlug) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing artistSlug or memberSlug' }));
            return;
          }
          const memberPath = `./public/data/artists/${artistSlug}/members/${memberSlug}.json`;
          if (!fs.existsSync(memberPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Member file not found' }));
            return;
          }
          const membersDir = `./public/data/artists/${artistSlug}/members`;

          let localPath = null;

          if (imageBase64 && imageExt) {
            // File uploaded from browser — save base64 bytes to disk
            const filename = `${memberSlug}.${imageExt}`;
            fs.writeFileSync(path.join(membersDir, filename), Buffer.from(imageBase64, 'base64'));
            localPath = `/data/artists/${artistSlug}/members/${filename}`;
          } else if (imageUrl && /^https?:\/\//.test(imageUrl)) {
            // External URL — download and cache locally
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
            const ct = imgRes.headers['content-type'] || '';
            const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
            const filename = `${memberSlug}.${ext}`;
            fs.writeFileSync(path.join(membersDir, filename), Buffer.from(imgRes.data));
            localPath = `/data/artists/${artistSlug}/members/${filename}`;
          } else if (imageUrl) {
            // Already a local /data/... path — store as-is
            localPath = imageUrl;
          }

          const data = JSON.parse(fs.readFileSync(memberPath, 'utf8'));
          if (localPath) {
            data.image = localPath;
          } else {
            delete data.image;
          }
          fs.writeFileSync(memberPath, JSON.stringify(data, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, localPath }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Return current manifest
      server.middlewares.use('/api/manifest', (req, res) => {
        const manifestPath = './public/data/manifest.json';
        try {
          const data = fs.existsSync(manifestPath)
            ? fs.readFileSync(manifestPath, 'utf8')
            : '{"artists":[]}';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}
