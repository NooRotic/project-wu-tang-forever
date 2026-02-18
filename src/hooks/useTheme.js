export function applyTheme(config) {
  if (!config?.theme) return;
  const root = document.documentElement;
  const t = config.theme;
  if (t.primaryColor) {
    root.style.setProperty('--color-primary', t.primaryColor);
    root.style.setProperty('--color-primary-glow', t.primaryColor + '88');
    root.style.setProperty('--color-primary-faint', t.primaryColor + '44');
  }
  if (t.primaryColorHover) root.style.setProperty('--color-primary-hover', t.primaryColorHover);
  if (t.headerFont) root.style.setProperty('--font-heading', t.headerFont);
  document.title = config.name ? `${config.name} — Lyrics Explorer` : 'Lyrics Explorer';
}

export function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-primary-hover');
  root.style.removeProperty('--color-primary-glow');
  root.style.removeProperty('--color-primary-faint');
  root.style.removeProperty('--font-heading');
  document.title = 'Lyrics Explorer';
}
