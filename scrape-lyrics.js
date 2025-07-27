// scrape-lyrics.js
// Scrapes Genius.com for artist, albums, and song lyrics

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const ARTIST_URL = 'https://genius.com/artists/Wu-tang-clan';
const ALBUMS_URL = 'https://genius.com/artists/Wu-tang-clan/albums';

async function fetchAlbums() {
  const res = await axios.get(ALBUMS_URL);
  const $ = cheerio.load(res.data);
  const albums = [];
  $(".mini_card-grid .mini_card").each((i, el) => {
    const albumTitle = $(el).find('.mini_card-title').text().trim();
    const albumUrl = $(el).find('a').attr('href');
    if (albumTitle && albumUrl) {
      albums.push({ title: albumTitle, url: albumUrl });
    }
  });
  return albums;
}

async function fetchSongsFromAlbum(albumUrl) {
  const res = await axios.get(albumUrl);
  const $ = cheerio.load(res.data);
  const songs = [];
  $(".chart_row-content-title a").each((i, el) => {
    const songTitle = $(el).text().trim();
    const songUrl = $(el).attr('href');
    if (songTitle && songUrl) {
      songs.push({ title: songTitle, url: songUrl });
    }
  });
  return songs;
}

async function fetchLyrics(songUrl) {
  const res = await axios.get(songUrl);
  const $ = cheerio.load(res.data);
  let lyrics = '';
  $('[data-lyrics-container="true"]').each((i, el) => {
    lyrics += $(el).text() + '\n';
  });
  return lyrics.trim();
}

async function main() {
  const artist = 'Wu-Tang Clan';
  const albums = await fetchAlbums();
  for (const album of albums) {
    album.songs = await fetchSongsFromAlbum(album.url);
    for (const song of album.songs) {
      song.lyrics = await fetchLyrics(song.url);
      console.log(`Fetched lyrics for: ${song.title}`);
    }
  }
  const data = { artist, albums };
  fs.writeFileSync('wu-tang-clan-lyrics.json', JSON.stringify(data, null, 2));
  console.log('Scraping complete. Data saved to wu-tang-clan-lyrics.json');
}

main().catch(console.error);
