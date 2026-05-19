// Theme toggle. The initial theme is applied in <head> before paint
// (see index.html) so reloads don't flash. This module delegates clicks
// on the toggle button (the button lives in a template that gets cloned
// on every home render, so delegation avoids re-binding).

const STORAGE_KEY = "theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setupThemeToggle() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btn-theme");
    if (!btn) return;
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
  });

  // Follow OS changes only while the user hasn't picked a theme manually.
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", (e) => {
      let saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
      if (saved !== "light" && saved !== "dark") {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  }
}
