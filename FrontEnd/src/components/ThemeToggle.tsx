import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "tgd1.theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyStoredTheme() {
  const t = read();
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

const LABEL: Record<Theme, string> = { system: "podle systému", light: "papír", dark: "tabule" };
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

/** Cycles system → paper (light) → blackboard (dark). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return (
    <button
      onClick={() => setTheme(NEXT[theme])}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-semibold text-muted hover:text-ink"
      title="Přepnout vzhled: papír (světlý) / tabule (tmavý) / podle systému"
      aria-label={`Vzhled: ${LABEL[theme]}. Klikni pro přepnutí.`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.5 2.5h6.5v11H1.5z" fill="currentColor" opacity="0.35" />
      </svg>
      {LABEL[theme]}
    </button>
  );
}
