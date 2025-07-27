// scrape-lyrics.js
// Scrapes Genius.com for artist, albums, and song lyrics



import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import process from 'process';


const GENIUS_BASE = 'https://genius.com';
const GENIUS_ALBUMS_PREFIX = 'https://genius.com/albums/';
const ARTIST_URL = `${GENIUS_BASE}/artists/Wu-tang-clan`;
const ALBUMS_URL = `${ARTIST_URL}/albums`;

async function fetchAlbums() {
  const res = await axios.get(ALBUMS_URL);
  const $ = cheerio.load(res.data);
  const albums = [];
  // Select all anchor tags with /albums/ in href
  $('a[href*="/albums/"]').each((i, el) => {
    const albumUrl = $(el).attr('href');
    // Only process Wu-Tang Clan albums, not the generic /albums page
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
  return songs;
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
  return { raw: lyrics.trim(), verses };
}

// Ensure process is available (Node.js global)
async function main() {
  const clear = process.argv.includes('--clear');
  // Parse chunk-size and offset from args
  let chunkSize = 25;
  let offset = 0;
  let chunks = 1;
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--chunk-size' && process.argv[i + 1]) {
      chunkSize = parseInt(process.argv[i + 1], 10);
    }
    if (process.argv[i] === '--offset' && process.argv[i + 1]) {
      offset = parseInt(process.argv[i + 1], 10);
    }
    if (process.argv[i] === '--chunks' && process.argv[i + 1]) {
      chunks = parseInt(process.argv[i + 1], 10);
    }
  }
  const dataDir = './data/artist/wu-tang-clan';
  const jsonFile = `${dataDir}/wu-tang-clan-lyrics.json`;
  const tmpFile = `${dataDir}/wu-tang-clan-lyrics.tmp.json`;
  // Ensure directory exists before writing
  fs.mkdirSync(dataDir, { recursive: true });
  if (clear) {
    try {
      fs.unlinkSync(jsonFile);
    } catch { /* ignore if file does not exist */ }
    try {
      fs.unlinkSync(tmpFile);
    } catch { /* ignore if file does not exist */ }
  }
  const artist = 'Wu-Tang Clan';
  const albums = await fetchAlbums();
  // Flatten all songs into a single array with album reference
  let allSongs = [];
  const seenSongUrls = new Set();
  for (const album of albums) {
    const songs = await fetchSongsFromAlbum(album.url);
    for (const song of songs) {
      if (seenSongUrls.has(song.url)) {
        console.log(`Duplicate song skipped: ${song.title} (${song.url})`);
        continue;
      }
      allSongs.push({ ...song, albumTitle: album.title });
      seenSongUrls.add(song.url);
    }
  }
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
    if (album.songs.find(s => s.url === songObj.url)) {
      console.log(`Duplicate in album skipped: ${songObj.title} (${songObj.url})`);
      continue;
    }
    // Remove any temp album reference before pushing
    const { albumTitle, ...songData } = songObj;
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
    const data = { artist, albums };
    for (const album of albums) {
      if (!Array.isArray(album.songs)) continue;
      for (const song of album.songs) {
        if ('lyrics' in song) {
          delete song.lyrics;
        }
      }
    }
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  }
  // On successful completion, replace the main JSON file
  fs.renameSync(tmpFile, jsonFile);
  console.log(`Scraping complete. Processed ${processed} songs (offset ${offset}). Data saved to ${jsonFile}`);
}

main().catch(console.error);
