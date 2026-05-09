import { useCallback, useEffect, useRef, useState } from "react";
import { THEME_VAR_KEYS, THEMES, getTheme, type Theme } from "@/lib/themes";

const STORAGE_KEY = "uc-theme";

// Applies (or clears) a theme by setting CSS custom properties on :root.
export function applyTheme(theme: Theme | null) {
  const root = document.documentElement;

  if (!theme || Object.keys(theme.vars).length === 0) {
    // Reset all theme-owned CSS vars
    THEME_VAR_KEYS.forEach((k) => root.style.removeProperty(k));
    return;
  }

  // Apply vars
  Object.entries(theme.vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  // Reset any vars not defined by this theme (so switching between themes is clean)
  THEME_VAR_KEYS.forEach((k) => {
    if (!(k in theme.vars)) root.style.removeProperty(k);
  });
}

// Loads a Google Fonts stylesheet once per URL, caching in the DOM.
function loadFonts(url: string) {
  if (!url) return;
  const existing = document.querySelector(`link[data-theme-font]`);
  if (existing && (existing as HTMLLinkElement).href === url) return;
  if (existing) existing.remove();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.setAttribute("data-theme-font", "true");
  document.head.appendChild(link);
}

export function useTheme() {
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem(STORAGE_KEY) ?? "default";
  });
  const [previewId, setPreviewId] = useState<string | null>(null);

  // What's currently rendered on screen
  const displayedId = previewId ?? activeId;

  const applyRef = useRef(applyTheme);
  applyRef.current = applyTheme;

  useEffect(() => {
    const theme = displayedId === "default" ? null : getTheme(displayedId);
    applyTheme(theme);
    if (theme?.googleFontsUrl) loadFonts(theme.googleFontsUrl);
  }, [displayedId]);

  const setTheme = useCallback((id: string) => {
    setActiveId(id);
    setPreviewId(null);
    localStorage.setItem(STORAGE_KEY, id);
    const theme = id === "default" ? null : getTheme(id);
    applyTheme(theme);
    if (theme?.googleFontsUrl) loadFonts(theme.googleFontsUrl);
  }, []);

  const previewTheme = useCallback((id: string | null) => {
    setPreviewId(id);
  }, []);

  const surpriseMe = useCallback(() => {
    // Pick a random theme that isn't the current one
    const others = THEMES.filter((t) => t.id !== activeId);
    const pick = others[Math.floor(Math.random() * others.length)];
    if (pick) setTheme(pick.id);
  }, [activeId, setTheme]);

  return {
    activeId,
    previewId,
    displayedId,
    setTheme,
    previewTheme,
    surpriseMe,
    themes: THEMES,
  };
}

// Initializes theme from localStorage on first render — use once in the root layout.
export function useThemeInit() {
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id || id === "default") return;
    const theme = getTheme(id);
    applyTheme(theme);
    if (theme.googleFontsUrl) loadFonts(theme.googleFontsUrl);
  }, []);
}
