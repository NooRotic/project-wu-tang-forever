// scrape-lyrics.js
// Scrapes Genius.com for artist, albums, and song lyrics
// Optionally enriches with Genius API metadata (pageviews, producers, etc.)

import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import process from 'process';

const GENIUS_BASE = 'https://genius.com';
const GENIUS_ALBUMS_PREFIX = 'https://genius.com/albums/';
const GENIUS_API_BASE = 'https://api.genius.com';

// Parse CLI args
function parseArgs() {
  const args = { artist: null, slug: null, chunkSize: 25, offset: 0, chunks: 1, clear: false, enrich: false, enrichOnly: false };
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--artist' && process.argv[i + 1]) {
      args.artist = process.argv[i + 1];
    }
    if (process.argv[i] === '--slug' && process.argv[i + 1]) {
      args.slug = process.argv[i + 1];
    }
    if (process.argv[i] === '--chunk-size' && process.argv[i + 1]) {
      args.chunkSize = parseInt(process.argv[i + 1], 10);
    }
    if (process.argv[i] === '--offset' && process.argv[i + 1]) {
      args.offset = parseInt(process.argv[i + 1], 10);
    }
    if (process.argv[i] === '--chunks' && process.argv[i + 1]) {
      args.chunks = parseInt(process.argv[i + 1], 10);
    }
    if (process.argv[i] === '--clear') {
      args.clear = true;
    }
    if (process.argv[i] === '--enrich') {
      args.enrich = true;
    }
    if (process.argv[i] === '--enrich-only') {
      args.enrichOnly = true;
      args.enrich = true;
    }
  }
  if (!args.artist || !args.slug) {
    console.error('Usage: node scrape-lyrics.js --artist "Artist Name" --slug Genius-slug [--chunk-size N] [--offset N] [--chunks N] [--clear] [--enrich] [--enrich-only]');
    console.error('Example: node scrape-lyrics.js --artist "Wu-Tang Clan" --slug Wu-tang-clan --enrich');
    process.exit(1);
  }
  return args;
}

// --- Genius API helpers ---

async function getGeniusToken() {
  const clientId = process.env.GENIUS_CLIENT_ID;
  const clientSecret = process.env.GENIUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn('GENIUS_CLIENT_ID / GENIUS_CLIENT_SECRET not set in .env — skipping enrichment');
    return null;
  }
  const res = await axios.post(`${GENIUS_API_BASE}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  return res.data.access_token;
}

async function geniusApi(token, path, params = {}) {
  const res = await axios.get(`${GENIUS_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data.response;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanSongTitle(title) {
  // Strip featured artist info and extra suffixes from scraped titles
  // e.g. "Triumph (Ft. Cappadonna)\n              Lyrics" → "Triumph"
  return title
    .replace(/\s*\(Ft\..*?\)/gi, '')
    .replace(/\s*\[Ft\..*?\]/gi, '')
    .replace(/\s*Lyrics\s*$/i, '')
    .replace(/\n.*/s, '')
    .trim();
}

async function searchSongId(token, songTitle, artistName) {
  const cleaned = cleanSongTitle(songTitle);
  const query = `${cleaned} ${artistName}`;
  const res = await geniusApi(token, '/search', { q: query, per_page: 10 });
  if (!res.hits || res.hits.length === 0) return null;

  const artistLower = artistName.toLowerCase();
  const titleLower = cleaned.toLowerCase();

  // Pass 1: exact title + exact artist
  for (const hit of res.hits) {
    const r = hit.result;
    if (r.primary_artist?.name?.toLowerCase() === artistLower &&
        r.title?.toLowerCase() === titleLower) {
      return r.id;
    }
  }
  // Pass 2: title contains match + exact artist
  for (const hit of res.hits) {
    const r = hit.result;
    if (r.primary_artist?.name?.toLowerCase() === artistLower &&
        r.title?.toLowerCase().includes(titleLower)) {
      return r.id;
    }
  }
  // Pass 3: first hit from same artist
  for (const hit of res.hits) {
    if (hit.result.primary_artist?.name?.toLowerCase() === artistLower) {
      return hit.result.id;
    }
  }
  return null; // Don't guess — skip if no artist match
}

async function fetchSongMetadata(token, songId) {
  const res = await geniusApi(token, `/songs/${songId}`);
  const s = res.song;
  return {
    geniusId: s.id,
    pageviews: s.stats?.pageviews || 0,
    producers: s.producer_artists?.map(a => a.name) || [],
    writers: s.writer_artists?.map(a => a.name) || [],
    featuredArtists: s.featured_artists?.map(a => a.name) || [],
    releaseDate: s.release_date_for_display || null,
    songArtUrl: s.song_art_image_url || null,
    appleMusicId: s.apple_music_id || null,
  };
}

async function enrichSongsWithApi(token, albums, artistName) {
  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  const totalSongs = albums.reduce((n, a) => n + (a.songs?.length || 0), 0);

  console.log(`\nEnriching ${totalSongs} songs with Genius API metadata...`);

  for (const album of albums) {
    if (!album.songs) continue;
    for (const song of album.songs) {
      const displayTitle = cleanSongTitle(song.title);
      // Skip if already enriched (has pageviews)
      if (song.pageviews !== undefined) {
        skipped++;
        continue;
      }
      try {
        const songId = await searchSongId(token, song.title, artistName);
        if (!songId) {
          console.log(`  [skip] No API match for: ${displayTitle}`);
          failed++;
          continue;
        }
        await sleep(200); // Rate limit spacing
        const meta = await fetchSongMetadata(token, songId);
        Object.assign(song, meta);
        enriched++;
        console.log(`  [${enriched}/${totalSongs}] ${displayTitle} — ${meta.pageviews.toLocaleString()} views`);
      } catch (err) {
        failed++;
        console.log(`  [error] ${displayTitle}: ${err.message}`);
      }
      await sleep(200);
    }
  }
  console.log(`Enrichment complete: ${enriched} enriched, ${skipped} already done, ${failed} failed`);
}

async function fetchAlbums(slug) {
  const albumsUrl = `${GENIUS_BASE}/artists/${slug}/albums`;
  const res = await axios.get(albumsUrl);
  const $ = cheerio.load(res.data);
  const albums = [];
  // Select all anchor tags with /albums/ in href
  $('a[href*="/albums/"]').each((i, el) => {
    const albumUrl = $(el).attr('href');
    // Only process albums, not the generic /albums page
    if (albumUrl === GENIUS_ALBUMS_PREFIX) return;
    // Extract album title from <h3> child
    const albumTitle = $(el).find('h3').text().trim();
    if (albumTitle && albumUrl.startsWith(GENIUS_ALBUMS_PREFIX)) {
      albums.push({ title: albumTitle, url: albumUrl });
    }
  });
  return albums;
}

async function fetchSongsFromAlbum(albumUrl) {
  const res = await axios.get(albumUrl);
  const $ = cheerio.load(res.data);
  // Extract album cover art from og:image meta tag
  const coverArtUrl = $('meta[property="og:image"]').attr('content') || '';
  const songs = [];
  const seen = new Set();
  $('a[href^="https://genius.com/"]').each((i, el) => {
    const songUrl = $(el).attr('href');
    const songTitle = $(el).text().trim();
    // Only add if it looks like a song (not album, not video, etc), not instrumental, not duplicate
    if (
      songTitle &&
      songUrl &&
      /lyrics$/.test(songUrl) &&
      !/instrumental/i.test(songTitle) &&
      !seen.has(songUrl)
    ) {
      songs.push({ title: songTitle, url: songUrl });
      seen.add(songUrl);
    }
  });
  return { songs, coverArtUrl };
}

function parseLyricsIntoVerses(lyrics) {
  // Remove any text before the first [Section: ...] tag
  const firstSectionIdx = lyrics.search(/\[(Intro|Verse|Chorus|Outro|Bridge|Hook|Interlude|Pre-Chorus|Refrain)[\s:-]/i);
  if (firstSectionIdx > 0) {
    lyrics = lyrics.slice(firstSectionIdx);
  }
  const verses = [];
  let currentLyrics = '';
  let currentArtists = [];
  let currentType = 'verse';
  const sectionRegex = /\[(Intro|Verse(?: \d+)?|Chorus|Outro|Bridge|Hook|Interlude|Pre-Chorus|Refrain)[\s:-]*([^\]]+)?\]/gi;
  const lines = lyrics.split(/\n+/);
  for (let line of lines) {
    let lastIndex = 0;
    let match;
    // Find all section headers in the line
    while ((match = sectionRegex.exec(line)) !== null) {
      // Add lyrics before this section header to the currentLyrics
      const before = line.slice(lastIndex, match.index);
      if (before.trim()) {
        currentLyrics += before + '\n';
      }
      // If we have accumulated lyrics, push the previous section
      if (currentLyrics.trim()) {
        verses.push({
          type: currentType.toLowerCase(),
          artists: currentArtists.length > 0 ? currentArtists : ['Unknown'],
          lyrics: currentLyrics.trim()
        });
        currentLyrics = '';
      }
      // Start new section
      currentType = match[1].toLowerCase();
      if (match[2]) {
        currentArtists = match[2].split(/,|&| and |\//i).map(a => a.trim()).filter(Boolean);
      } else {
        currentArtists = [];
      }
      lastIndex = sectionRegex.lastIndex;
    }
    // Add the rest of the line after the last section header
    const after = line.slice(lastIndex);
    if (after.trim()) {
      currentLyrics += after + '\n';
    }
    // Reset regex lastIndex for next line
    sectionRegex.lastIndex = 0;
  }
  if (currentLyrics.trim()) {
    verses.push({
      type: currentType.toLowerCase(),
      artists: currentArtists.length > 0 ? currentArtists : ['Unknown'],
      lyrics: currentLyrics.trim()
    });
  }
  return verses;
}

async function fetchLyrics(songUrl) {
  const res = await axios.get(songUrl);
  const $ = cheerio.load(res.data);
  let lyrics = '';
  $('[data-lyrics-container="true"]').each((i, el) => {
    // Get HTML, replace <br> with \n, then strip HTML tags
    let html = $(el).html() || '';
    html = html.replace(/<br\s*\/?>(\s*)/gi, '\n');
    // Remove any remaining HTML tags
    const text = cheerio.load('<div>' + html + '</div>')('div').text();
    lyrics += text + '\n';
  });
  const verses = parseLyricsIntoVerses(lyrics);
  return { raw: lyrics.trim(), verses };
}

function generateConfigTemplate(artistName, slug, albums) {
  // Count distinct credited artists across all verses to detect group vs solo
  const allArtists = new Set();
  for (const album of albums) {
    if (!album.songs) continue;
    for (const song of album.songs) {
      if (!song.verses) continue;
      for (const verse of song.verses) {
        if (verse.artists) verse.artists.forEach(a => allArtists.add(a));
      }
    }
  }
  const isGroup = allArtists.size > 3;
  const configPath = `./public/data/artists/${slug}/config.json`;
  if (fs.existsSync(configPath)) return; // Don't overwrite existing config

  const members = isGroup
    ? [...allArtists].filter(a => a !== 'Unknown').slice(0, 15).map(name => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        color: '#F8D000',
        aliases: [],
        wiki: ''
      }))
    : [];

  const config = {
    slug,
    name: artistName,
    type: isGroup ? 'group' : 'solo',
    geniusSlug: slug,
    theme: {
      primaryColor: '#F8D000',
      primaryColorHover: '#fff200',
      headerFont: "'Oswald', Impact, Arial Black, Arial, sans-serif",
      logo: ''
    },
    members,
    tagline: '',
    disclaimer: `Tribute project — Not affiliated with ${artistName} or Genius.com`,
    bioTitle: artistName,
    dashboardTitle: `${artistName} Dashboard`
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Generated config template at ${configPath}`);
}

function updateManifest(artistName, slug, albums) {
  const manifestPath = './public/data/manifest.json';
  let manifest = { artists: [] };
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const albumCount = albums.filter(a => a.songs && a.songs.length > 0).length;
  let songCount = 0;
  albums.forEach(a => { if (a.songs) songCount += a.songs.length; });

  // Try to read config for logo/color
  let primaryColor = '#F8D000';
  let logo = '';
  const configPath = `./public/data/artists/${slug}/config.json`;
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    primaryColor = config.theme?.primaryColor || primaryColor;
    logo = config.theme?.logo || logo;
  }

  // Case-insensitive match to prevent duplicates from casing differences
  const existing = manifest.artists.findIndex(a => a.slug.toLowerCase() === slug.toLowerCase());
  const entry = {
    slug,
    name: artistName,
    type: albumCount > 0 ? 'group' : 'solo',
    primaryColor,
    logo,
    albumCount,
    songCount
  };
  if (existing >= 0) {
    manifest.artists[existing] = entry;
  } else {
    manifest.artists.push(entry);
  }
  fs.mkdirSync('./public/data', { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Updated manifest at ${manifestPath}`);
}

async function main() {
  const args = parseArgs();
  const { artist, chunkSize, offset, chunks, clear, enrich, enrichOnly } = args;
  // Genius slug preserves original casing for API requests;
  // storage slug is always lowercase to prevent duplicates
  const geniusSlug = args.slug;
  const slug = args.slug.toLowerCase();

  const dataDir = `./public/data/artists/${slug}`;
  const jsonFile = `${dataDir}/lyrics.json`;
  const tmpFile = `${dataDir}/lyrics.tmp.json`;
  // Ensure directory exists before writing
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(`${dataDir}/members`, { recursive: true });
  if (clear) {
    try {
      fs.unlinkSync(jsonFile);
    } catch { /* ignore if file does not exist */ }
    try {
      fs.unlinkSync(tmpFile);
    } catch { /* ignore if file does not exist */ }
  }

  // --- Enrich-only mode: skip scraping, just add API metadata ---
  if (enrichOnly) {
    if (!fs.existsSync(jsonFile)) {
      console.error(`No existing data at ${jsonFile} — run scraping first`);
      process.exit(1);
    }
    const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const token = await getGeniusToken();
    if (!token) process.exit(1);
    await enrichSongsWithApi(token, existing.albums, artist);
    fs.writeFileSync(jsonFile, JSON.stringify(existing, null, 2));
    console.log(`Enriched data saved to ${jsonFile}`);
    return;
  }

  // --- Normal scraping flow ---
  // Load existing data to merge with (preserves previous chunk runs)
  let existingAlbums = {};
  if (fs.existsSync(jsonFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      if (existing.albums) {
        for (const album of existing.albums) {
          existingAlbums[album.title] = album;
        }
      }
      console.log(`Loaded existing data: ${Object.keys(existingAlbums).length} albums`);
    } catch { /* ignore corrupt file */ }
  }

  console.log(`Scraping ${artist} (Genius slug: ${geniusSlug}, storage: ${slug})...`);
  const albums = await fetchAlbums(geniusSlug);

  // Merge existing song data into freshly fetched album list
  for (const album of albums) {
    const prev = existingAlbums[album.title];
    if (prev) {
      album.songs = prev.songs || [];
      if (prev.coverArtUrl) album.coverArtUrl = prev.coverArtUrl;
    }
  }

  // Flatten all songs into a single array with album reference
  let allSongs = [];
  const seenSongUrls = new Set();
  // Track already-scraped song URLs so we skip them
  for (const album of albums) {
    if (album.songs) {
      for (const song of album.songs) {
        seenSongUrls.add(song.url);
      }
    }
  }
  for (const album of albums) {
    const { songs, coverArtUrl } = await fetchSongsFromAlbum(album.url);
    if (coverArtUrl) album.coverArtUrl = coverArtUrl;
    for (const song of songs) {
      if (seenSongUrls.has(song.url)) continue;
      allSongs.push({ ...song, albumTitle: album.title });
      seenSongUrls.add(song.url);
    }
  }
  console.log(`Found ${allSongs.length} new songs to process`);
  // Calculate total number of songs to process
  const totalToProcess = chunkSize * chunks;
  const songsToProcess = allSongs.slice(offset, offset + totalToProcess);
  // Map album titles to album objects for easy lookup
  const albumMap = new Map(albums.map(a => [a.title, a]));
  let processed = 0;
  for (const songObj of songsToProcess) {
    const album = albumMap.get(songObj.albumTitle);
    if (!album.songs) album.songs = [];
    // Avoid duplicate song entries in album.songs
    if (album.songs.find(s => s.url === songObj.url)) continue;
    // Remove any temp album reference before pushing
    const { albumTitle: _albumTitle, ...songData } = songObj;
    album.songs.push(songData);
    try {
      const lyricsData = await fetchLyrics(songObj.url);
      // Find the song in album.songs and update its verses
      const songInAlbum = album.songs.find(s => s.url === songObj.url);
      if (songInAlbum) songInAlbum.verses = lyricsData.verses;
      processed++;
      console.log(`Fetched lyrics for: ${songObj.title}`);
    } catch (err) {
      // Find the song in album.songs and set error
      const songInAlbum = album.songs.find(s => s.url === songObj.url);
      if (songInAlbum) {
        songInAlbum.verses = [];
        songInAlbum.error = err.message || 'Error fetching lyrics';
      }
      console.log(`Error fetching lyrics for: ${songObj.title}`);
    }
    // Save progress after each song to a temp file
    const saveData = { artist, albums };
    for (const a of albums) {
      if (!Array.isArray(a.songs)) continue;
      for (const song of a.songs) {
        if ('lyrics' in song) delete song.lyrics;
      }
    }
    fs.writeFileSync(tmpFile, JSON.stringify(saveData, null, 2));
  }
  // On successful completion, replace the main JSON file
  if (fs.existsSync(tmpFile)) {
    fs.renameSync(tmpFile, jsonFile);
  } else {
    // No new songs to process — save merged data anyway (for cover art updates)
    fs.writeFileSync(jsonFile, JSON.stringify({ artist, albums }, null, 2));
  }
  console.log(`Scraping complete. Processed ${processed} new songs (offset ${offset}). Data saved to ${jsonFile}`);

  // --- API enrichment pass (if --enrich flag is set) ---
  if (enrich) {
    const token = await getGeniusToken();
    if (token) {
      const savedData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      await enrichSongsWithApi(token, savedData.albums, artist);
      fs.writeFileSync(jsonFile, JSON.stringify(savedData, null, 2));
      console.log(`Enriched data saved to ${jsonFile}`);
    }
  }

  // Generate config template if none exists
  generateConfigTemplate(artist, slug, albums);
  // Update manifest
  updateManifest(artist, slug, albums);
}

const isMain = process.argv[1] && (process.argv[1].endsWith('scrape-lyrics.js') || process.argv[1].endsWith('scrape-lyrics'));
if (isMain) main().catch(console.error);

export { cleanSongTitle, parseArgs, parseLyricsIntoVerses, generateConfigTemplate, updateManifest };
