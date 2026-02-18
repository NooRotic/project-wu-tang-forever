import { describe, it, expect } from 'vitest';
import { matchMember, formatViews, getDashboardStats } from './artistUtils.js';

// ── matchMember ─────────────────────────────────────────────────────────────

describe('matchMember', () => {
  const members = [
    { name: 'RZA', slug: 'rza', aliases: ['Bobby Digital', 'Prince Rakeem'] },
    { name: 'GZA', slug: 'gza', aliases: ['The Genius'] },
    { name: "Ol' Dirty Bastard", slug: 'ol-dirty-bastard', aliases: ['ODB', 'Dirt McGirt'] },
    { name: 'Method Man', slug: 'method-man', aliases: [] },
    { name: 'Raekwon', slug: 'raekwon', aliases: [] },
  ];

  it('matches exact name', () => {
    expect(matchMember('RZA', members)).toBe(members[0]);
  });

  it('matches name case-insensitively', () => {
    expect(matchMember('rza', members)).toBe(members[0]);
    expect(matchMember('method man', members)).toBe(members[3]);
  });

  it('matches by alias', () => {
    expect(matchMember('ODB', members)).toBe(members[2]);
    expect(matchMember('The Genius', members)).toBe(members[1]);
    expect(matchMember('Bobby Digital', members)).toBe(members[0]);
  });

  it('alias matching is case-insensitive', () => {
    expect(matchMember('odb', members)).toBe(members[2]);
    expect(matchMember('the genius', members)).toBe(members[1]);
  });

  it('returns undefined for unknown names', () => {
    expect(matchMember('Jay-Z', members)).toBeUndefined();
    expect(matchMember('', members)).toBeUndefined();
  });

  it('handles members with no aliases array', () => {
    const membersNoAlias = [{ name: 'Solo', slug: 'solo' }];
    expect(matchMember('Solo', membersNoAlias)).toBe(membersNoAlias[0]);
    expect(matchMember('Other', membersNoAlias)).toBeUndefined();
  });

  it('handles empty members array', () => {
    expect(matchMember('RZA', [])).toBeUndefined();
  });

  it('handles empty aliases array gracefully', () => {
    expect(matchMember('Method Man', members)).toBe(members[3]);
  });
});

// ── formatViews ─────────────────────────────────────────────────────────────

describe('formatViews', () => {
  it('returns null for 0', () => {
    expect(formatViews(0)).toBeNull();
  });

  it('returns null for null', () => {
    expect(formatViews(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(formatViews(undefined)).toBeNull();
  });

  it('returns string for numbers under 1000', () => {
    expect(formatViews(999)).toBe('999');
    expect(formatViews(1)).toBe('1');
  });

  it('formats thousands with K suffix', () => {
    expect(formatViews(1500)).toBe('1.5K');
    expect(formatViews(1000)).toBe('1.0K');
    expect(formatViews(50000)).toBe('50.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatViews(2455660)).toBe('2.5M');
    expect(formatViews(1000000)).toBe('1.0M');
  });

  it('returns null for falsy values', () => {
    expect(formatViews(false)).toBeNull();
  });
});

// ── getDashboardStats ───────────────────────────────────────────────────────

describe('getDashboardStats', () => {
  const members = [
    { name: 'RZA', slug: 'rza', aliases: ['Bobby Digital'] },
    { name: 'GZA', slug: 'gza', aliases: ['The Genius'] },
  ];

  const makeAlbums = (songs) => [{ title: 'Test Album', songs }];

  it('returns empty array when albums is null', () => {
    expect(getDashboardStats(null, members, '')).toEqual([]);
  });

  it('returns empty array when members is empty', () => {
    expect(getDashboardStats([], [], '')).toEqual([]);
  });

  it('returns entry per member', () => {
    const albums = makeAlbums([]);
    const stats = getDashboardStats(albums, members, '');
    expect(stats).toHaveLength(2);
    expect(stats[0].name).toBe('RZA');
    expect(stats[1].name).toBe('GZA');
  });

  it('counts songs and albums correctly', () => {
    const albums = makeAlbums([
      { title: 'Song1', verses: [{ type: 'verse', artists: ['RZA'], lyrics: 'line1\nline2' }] },
      { title: 'Song2', verses: [{ type: 'verse', artists: ['RZA', 'GZA'], lyrics: 'line1' }] },
    ]);
    const stats = getDashboardStats(albums, members, '');
    const rza = stats.find(s => s.name === 'RZA');
    const gza = stats.find(s => s.name === 'GZA');
    expect(rza.songs).toBe(2);
    expect(rza.albums).toBe(1);
    expect(gza.songs).toBe(1);
    expect(gza.albums).toBe(1);
  });

  it('counts bars and maxBars correctly', () => {
    const albums = makeAlbums([
      { title: 'Song1', verses: [
        { type: 'verse', artists: ['RZA'], lyrics: 'line1\nline2\nline3' },
        { type: 'verse', artists: ['RZA'], lyrics: 'line1\nline2' },
      ] },
    ]);
    const stats = getDashboardStats(albums, members, '');
    const rza = stats.find(s => s.name === 'RZA');
    expect(rza.totalBars).toBe(5);
    expect(rza.maxBars).toBe(3);
  });

  it('counts soloVerses correctly', () => {
    const albums = makeAlbums([
      { title: 'Song1', verses: [
        { type: 'verse', artists: ['RZA'], lyrics: 'solo verse' },
        { type: 'verse', artists: ['RZA', 'GZA'], lyrics: 'shared verse' },
      ] },
    ]);
    const stats = getDashboardStats(albums, members, '');
    const rza = stats.find(s => s.name === 'RZA');
    expect(rza.soloVerses).toBe(1);
  });

  it('attributes alias-matched artists correctly', () => {
    const albums = makeAlbums([
      { title: 'Song1', verses: [{ type: 'verse', artists: ['Bobby Digital'], lyrics: 'line1' }] },
      { title: 'Song2', verses: [{ type: 'verse', artists: ['The Genius'], lyrics: 'line1' }] },
    ]);
    const stats = getDashboardStats(albums, members, '');
    const rza = stats.find(s => s.name === 'RZA');
    const gza = stats.find(s => s.name === 'GZA');
    expect(rza.songs).toBe(1);
    expect(gza.songs).toBe(1);
  });

  it('attributes pageviews to each member appearing in a song', () => {
    const albums = makeAlbums([
      { title: 'Song1', pageviews: 1000, verses: [
        { type: 'verse', artists: ['RZA'], lyrics: 'line' },
        { type: 'verse', artists: ['GZA'], lyrics: 'line' },
      ] },
    ]);
    const stats = getDashboardStats(albums, members, '');
    const rza = stats.find(s => s.name === 'RZA');
    const gza = stats.find(s => s.name === 'GZA');
    expect(rza.totalViews).toBe(1000);
    expect(gza.totalViews).toBe(1000);
  });

  it('no divide-by-zero when member has 0 songs', () => {
    const albums = makeAlbums([
      { title: 'Song1', verses: [{ type: 'verse', artists: ['RZA'], lyrics: 'line1' }] },
    ]);
    const stats = getDashboardStats(albums, members, '');
    const gza = stats.find(s => s.name === 'GZA');
    expect(gza.songs).toBe(0);
    expect(gza.avgBars).toBe(0);
  });

  it('counts word query matches', () => {
    const albums = makeAlbums([
      { title: 'Song1', verses: [
        { type: 'verse', artists: ['RZA'], lyrics: 'cream get the money cream cream' },
        { type: 'verse', artists: ['GZA'], lyrics: 'no matching words' },
      ] },
    ]);
    const stats = getDashboardStats(albums, members, 'cream');
    const rza = stats.find(s => s.name === 'RZA');
    const gza = stats.find(s => s.name === 'GZA');
    expect(rza.wordCount).toBe(3);
    expect(gza.wordCount).toBe(0);
  });

  it('handles songs with no verses gracefully', () => {
    const albums = makeAlbums([
      { title: 'Song1' },
      { title: 'Song2', verses: null },
    ]);
    const stats = getDashboardStats(albums, members, '');
    expect(stats).toHaveLength(2);
    expect(stats[0].songs).toBe(0);
  });
});
