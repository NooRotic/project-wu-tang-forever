// Generic alias matching — finds a member by name or alias
export function matchMember(creditedName, members) {
  return members.find(m =>
    m.name.toLowerCase() === creditedName.toLowerCase() ||
    m.aliases?.some(a => a.toLowerCase() === creditedName.toLowerCase())
  );
}

export function formatViews(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getDashboardStats(albums, members, wordQuery) {
  if (!albums || !members || members.length === 0) return [];
  const memberNames = members.map(m => m.name);
  const stats = {};
  memberNames.forEach(m => {
    stats[m] = { songs: new Set(), albums: new Set(), charCount: 0, totalBars: 0, maxBars: 0, uniqueWords: new Set(), soloVerses: 0, wordCount: 0, totalViews: 0 };
  });
  albums.forEach(album => {
    if (!album.songs) return;
    album.songs.forEach(song => {
      if (!song.verses) return;
      // Track which members appear in this song for pageview attribution
      const songMembers = new Set();
      song.verses.forEach(verse => {
        if (!verse.artists || !verse.lyrics) return;
        const bars = verse.lyrics.split('\n').filter(Boolean).length;
        const isSolo = verse.artists.length === 1;
        verse.artists.forEach(artist => {
          const matched = matchMember(artist, members);
          if (matched) {
            const s = stats[matched.name];
            s.songs.add(song.title);
            s.albums.add(album.title);
            songMembers.add(matched.name);
            s.charCount += verse.lyrics.length;
            s.totalBars += bars;
            if (bars > s.maxBars) s.maxBars = bars;
            if (isSolo) s.soloVerses++;
            verse.lyrics.toLowerCase().match(/[a-z']+/g)?.forEach(w => s.uniqueWords.add(w));
            if (wordQuery) {
              const regex = new RegExp(`\\b${wordQuery}\\b`, 'gi');
              s.wordCount += (verse.lyrics.match(regex) || []).length;
            }
          }
        });
      });
      // Attribute song pageviews to each member who appears
      if (song.pageviews && songMembers.size > 0) {
        songMembers.forEach(name => { stats[name].totalViews += song.pageviews; });
      }
    });
  });
  return memberNames.map(m => {
    const s = stats[m];
    const songCount = s.songs.size;
    return {
      name: m,
      songs: songCount,
      albums: s.albums.size,
      charCount: s.charCount,
      totalBars: s.totalBars,
      maxBars: s.maxBars,
      avgBars: songCount > 0 ? Math.round(s.totalBars / songCount) : 0,
      uniqueWords: s.uniqueWords.size,
      soloVerses: s.soloVerses,
      totalViews: s.totalViews,
      wordCount: s.wordCount
    };
  });
}
