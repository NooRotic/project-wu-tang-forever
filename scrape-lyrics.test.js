import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanSongTitle, parseArgs, parseLyricsIntoVerses } from './scrape-lyrics.js';

// ── cleanSongTitle ──────────────────────────────────────────────────────────

describe('cleanSongTitle', () => {
  it('strips (Ft. Artist) from title', () => {
    expect(cleanSongTitle('Triumph (Ft. Cappadonna)')).toBe('Triumph');
  });

  it('strips [Ft. Artist] from title', () => {
    expect(cleanSongTitle('Da Mystery of Chessboxin [Ft. Method Man]')).toBe('Da Mystery of Chessboxin');
  });

  it('strips trailing Lyrics suffix', () => {
    expect(cleanSongTitle('C.R.E.A.M. Lyrics')).toBe('C.R.E.A.M.');
  });

  it('strips newline + whitespace + Lyrics (real scraped pattern)', () => {
    expect(cleanSongTitle('Triumph (Ft. Cappadonna)\n              Lyrics')).toBe('Triumph');
  });

  it('leaves clean titles untouched', () => {
    expect(cleanSongTitle('Protect Ya Neck')).toBe('Protect Ya Neck');
  });

  it('handles empty string', () => {
    expect(cleanSongTitle('')).toBe('');
  });

  it('is case-insensitive for Ft. pattern', () => {
    expect(cleanSongTitle('Track (ft. someone)')).toBe('Track');
  });

  it('handles multiple patterns combined', () => {
    expect(cleanSongTitle('Song (Ft. A & B)\n              Lyrics')).toBe('Song');
  });
});

// ── parseArgs ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  let originalArgv;
  let exitSpy;

  beforeEach(() => {
    originalArgv = process.argv;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
  });

  afterEach(() => {
    process.argv = originalArgv;
    exitSpy.mockRestore();
  });

  it('parses --artist and --slug', () => {
    process.argv = ['node', 'scrape-lyrics.js', '--artist', 'Wu-Tang Clan', '--slug', 'Wu-tang-clan'];
    const args = parseArgs();
    expect(args.artist).toBe('Wu-Tang Clan');
    expect(args.slug).toBe('Wu-tang-clan');
  });

  it('parses --chunk-size, --offset, --chunks as numbers', () => {
    process.argv = ['node', 'scrape-lyrics.js', '--artist', 'A', '--slug', 'a', '--chunk-size', '10', '--offset', '5', '--chunks', '3'];
    const args = parseArgs();
    expect(args.chunkSize).toBe(10);
    expect(args.offset).toBe(5);
    expect(args.chunks).toBe(3);
  });

  it('parses boolean --clear flag', () => {
    process.argv = ['node', 'scrape-lyrics.js', '--artist', 'A', '--slug', 'a', '--clear'];
    const args = parseArgs();
    expect(args.clear).toBe(true);
  });

  it('parses --enrich flag', () => {
    process.argv = ['node', 'scrape-lyrics.js', '--artist', 'A', '--slug', 'a', '--enrich'];
    const args = parseArgs();
    expect(args.enrich).toBe(true);
    expect(args.enrichOnly).toBe(false);
  });

  it('parses --enrich-only flag (also sets enrich=true)', () => {
    process.argv = ['node', 'scrape-lyrics.js', '--artist', 'A', '--slug', 'a', '--enrich-only'];
    const args = parseArgs();
    expect(args.enrichOnly).toBe(true);
    expect(args.enrich).toBe(true);
  });

  it('calls process.exit(1) when required args missing', () => {
    process.argv = ['node', 'scrape-lyrics.js'];
    expect(() => parseArgs()).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ── parseLyricsIntoVerses ───────────────────────────────────────────────────

describe('parseLyricsIntoVerses', () => {
  it('returns empty array for empty input', () => {
    expect(parseLyricsIntoVerses('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseLyricsIntoVerses('   \n\n  ')).toEqual([]);
  });

  it('parses a single verse with artist', () => {
    const input = '[Verse 1: RZA]\nI bomb atomically';
    const verses = parseLyricsIntoVerses(input);
    expect(verses).toHaveLength(1);
    expect(verses[0].type).toBe('verse 1');
    expect(verses[0].artists).toEqual(['RZA']);
    expect(verses[0].lyrics).toBe('I bomb atomically');
  });

  it('parses chorus with artist', () => {
    const input = '[Chorus: Method Man]\nCash rules everything around me';
    const verses = parseLyricsIntoVerses(input);
    expect(verses).toHaveLength(1);
    expect(verses[0].type).toBe('chorus');
    expect(verses[0].artists).toEqual(['Method Man']);
  });

  it('parses intro section', () => {
    const input = '[Intro: RZA]\nShaolin shadowboxing';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('intro');
    expect(verses[0].artists).toEqual(['RZA']);
  });

  it('parses outro section', () => {
    const input = '[Outro: GZA]\nPeace to the gods';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('outro');
  });

  it('parses hook section', () => {
    const input = '[Hook: Raekwon]\nWu-Tang is for the children';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('hook');
  });

  it('parses interlude section', () => {
    const input = '[Interlude: RZA]\nAnd the saga continues';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('interlude');
  });

  it('parses bridge section', () => {
    const input = '[Bridge: Method Man]\nSome bridge lyrics';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('bridge');
  });

  it('handles section headers without artists (assigns empty array then Unknown)', () => {
    const input = '[Intro]\nSome intro words';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].artists).toEqual(['Unknown']);
  });

  it('splits multiple artists separated by comma', () => {
    const input = '[Verse 1: RZA, GZA]\nLyrics here';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].artists).toEqual(['RZA', 'GZA']);
  });

  it('splits multiple artists separated by &', () => {
    const input = '[Verse 1: RZA & GZA]\nLyrics here';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].artists).toEqual(['RZA', 'GZA']);
  });

  it('splits multiple artists separated by "and"', () => {
    const input = '[Verse 1: RZA and GZA]\nLyrics here';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].artists).toEqual(['RZA', 'GZA']);
  });

  it('splits multiple artists separated by /', () => {
    const input = '[Verse 1: RZA / GZA]\nLyrics here';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].artists).toEqual(['RZA', 'GZA']);
  });

  it('parses multiple consecutive sections', () => {
    const input = [
      '[Verse 1: RZA]',
      'First verse line',
      '[Chorus: Method Man]',
      'Chorus line',
      '[Verse 2: GZA]',
      'Second verse line',
    ].join('\n');
    const verses = parseLyricsIntoVerses(input);
    expect(verses).toHaveLength(3);
    expect(verses[0].type).toBe('verse 1');
    expect(verses[0].artists).toEqual(['RZA']);
    expect(verses[0].lyrics).toBe('First verse line');
    expect(verses[1].type).toBe('chorus');
    expect(verses[1].artists).toEqual(['Method Man']);
    expect(verses[1].lyrics).toBe('Chorus line');
    expect(verses[2].type).toBe('verse 2');
    expect(verses[2].artists).toEqual(['GZA']);
    expect(verses[2].lyrics).toBe('Second verse line');
  });

  it('lyrics do not bleed between verses', () => {
    const input = [
      '[Verse 1: RZA]',
      'Line from verse 1',
      '[Verse 2: GZA]',
      'Line from verse 2',
    ].join('\n');
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].lyrics).not.toContain('Line from verse 2');
    expect(verses[1].lyrics).not.toContain('Line from verse 1');
  });

  it('discards text before first section header', () => {
    const input = [
      'Some random preamble text',
      '[Verse 1: RZA]',
      'Actual lyrics here',
    ].join('\n');
    const verses = parseLyricsIntoVerses(input);
    expect(verses).toHaveLength(1);
    expect(verses[0].lyrics).toBe('Actual lyrics here');
    expect(verses[0].lyrics).not.toContain('preamble');
  });

  it('handles multiline lyrics within a verse', () => {
    const input = [
      '[Verse 1: Inspectah Deck]',
      'I bomb atomically',
      "Socrates' philosophies and hypotheses",
      "Can't define how I be droppin' these",
    ].join('\n');
    const verses = parseLyricsIntoVerses(input);
    expect(verses).toHaveLength(1);
    expect(verses[0].lyrics).toContain('I bomb atomically');
    expect(verses[0].lyrics).toContain("Can't define how I be droppin' these");
  });

  it('handles Pre-Chorus section type', () => {
    const input = '[Pre-Chorus: Method Man]\nGetting ready';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('pre-chorus');
  });

  it('handles Refrain section type', () => {
    const input = '[Refrain: GZA]\nRepeated line';
    const verses = parseLyricsIntoVerses(input);
    expect(verses[0].type).toBe('refrain');
  });

  it('regression: real Wu-Tang data pattern', () => {
    const input = [
      '[Intro: RZA]',
      'Wu-Tang Clan, coming at you',
      'Watch your step kid',
      '',
      '[Verse 1: Inspectah Deck]',
      'I bomb atomically',
      "Socrates' philosophies and hypotheses",
      "Can't define how I be droppin' these",
      'Mockeries',
      '',
      '[Chorus: Method Man]',
      'Wu-Tang! Wu-Tang! Wu-Tang!',
      '',
      '[Verse 2: GZA, RZA]',
      "It's the method, put your hands together",
      'Swords clashing in the darkness',
    ].join('\n');
    const verses = parseLyricsIntoVerses(input);
    expect(verses).toHaveLength(4);
    expect(verses[0].type).toBe('intro');
    expect(verses[0].artists).toEqual(['RZA']);
    expect(verses[0].lyrics).toContain('Watch your step kid');
    expect(verses[1].type).toBe('verse 1');
    expect(verses[1].artists).toEqual(['Inspectah Deck']);
    expect(verses[1].lyrics).toContain('Mockeries');
    expect(verses[2].type).toBe('chorus');
    expect(verses[2].artists).toEqual(['Method Man']);
    expect(verses[3].type).toBe('verse 2');
    expect(verses[3].artists).toEqual(['GZA', 'RZA']);
  });
});
