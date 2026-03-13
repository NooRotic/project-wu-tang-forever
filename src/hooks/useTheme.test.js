// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, resetTheme } from './useTheme.js';

describe('applyTheme', () => {
  beforeEach(() => {
    resetTheme();
  });

  it('sets CSS variables from config theme', () => {
    applyTheme({
      name: 'Wu-Tang Clan',
      theme: {
        primaryColor: '#F8D000',
        primaryColorHover: '#fff200',
        headerFont: "'Oswald', sans-serif",
      },
    });
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#F8D000');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('#fff200');
    expect(root.style.getPropertyValue('--font-heading')).toBe("'Oswald', sans-serif");
    expect(root.style.getPropertyValue('--color-primary-glow')).toBe('#F8D00088');
    expect(root.style.getPropertyValue('--color-primary-faint')).toBe('#F8D00044');
  });

  it('sets document title with artist name', () => {
    applyTheme({ name: 'Wu-Tang Clan', theme: { primaryColor: '#F8D000' } });
    expect(document.title).toBe('Wu-Tang Clan Word Explorer');
  });

  it('sets default document title when name is empty', () => {
    applyTheme({ name: '', theme: { primaryColor: '#F8D000' } });
    expect(document.title).toBe('Word Explorer');
  });

  it('does nothing when config is null', () => {
    const titleBefore = document.title;
    applyTheme(null);
    expect(document.title).toBe(titleBefore);
  });

  it('does nothing when config.theme is missing', () => {
    const titleBefore = document.title;
    applyTheme({ name: 'Test' });
    expect(document.title).toBe(titleBefore);
  });
});

describe('resetTheme', () => {
  it('removes CSS variables', () => {
    applyTheme({
      name: 'Test',
      theme: { primaryColor: '#F8D000', primaryColorHover: '#fff200', headerFont: 'Arial' },
    });
    resetTheme();
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('');
    expect(root.style.getPropertyValue('--color-primary-hover')).toBe('');
    expect(root.style.getPropertyValue('--color-primary-glow')).toBe('');
    expect(root.style.getPropertyValue('--color-primary-faint')).toBe('');
    expect(root.style.getPropertyValue('--font-heading')).toBe('');
  });

  it('resets document title', () => {
    document.title = 'Wu-Tang Clan — Word Explorer';
    resetTheme();
    expect(document.title).toBe('Word Explorer');
  });

  it('is safe to call multiple times', () => {
    resetTheme();
    resetTheme();
    expect(document.title).toBe('Word Explorer');
  });
});
