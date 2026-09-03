const THEME_STORAGE_KEY = 'sec_theme';

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';

  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    const icon = toggle.querySelector('[data-theme-icon]');
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    if (icon) icon.className = isLight ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
  });
}

function setTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
applyTheme(savedTheme);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.dataset.theme;
      setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
  });
});
