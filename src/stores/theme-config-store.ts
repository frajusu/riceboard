import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface ThemeColors {
  [key: string]: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarAccent: string;
}

interface ThemeFonts {
  [key: string]: string;
  ui: string;
  mono: string;
  editor: string;
  simulation: string;
}

interface ThemeConfig {
  colors: ThemeColors;
  dark: ThemeColors;
  fonts: ThemeFonts;
}

interface ThemeConfigState {
  config: ThemeConfig | null;
  rawToml: string;
  configPath: string;
  loaded: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: (toml: string) => Promise<void>;
  applyTheme: () => void;
}

function parseToml(text: string): ThemeConfig {
  const result: ThemeConfig = {
    colors: {} as ThemeColors,
    dark: {} as ThemeColors,
    fonts: {} as ThemeFonts,
  };

  let currentSection = "";
  let isDark = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[(\w+(?:\.\w+)?)\]$/);
    if (sectionMatch) {
      const section = sectionMatch[1];
      if (section === "colors.dark") {
        currentSection = "dark";
        isDark = true;
      } else if (section === "colors") {
        currentSection = "colors";
        isDark = false;
      } else if (section === "fonts") {
        currentSection = "fonts";
      }
      continue;
    }

    const kvMatch = line.match(/^(\w+)\s*=\s*"?(.+?)"?\s*$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (currentSection === "colors" && !isDark) {
        (result.colors as Record<string, string>)[key] = value;
      } else if (currentSection === "dark" || (currentSection === "colors" && isDark)) {
        (result.dark as Record<string, string>)[key] = value;
      } else if (currentSection === "fonts") {
        (result.fonts as Record<string, string>)[key] = value;
      }
    }
  }

  return result;
}

function colorToHsl(hex: string): string {
  if (hex.startsWith("hsl") || hex.startsWith("rgb")) return hex;
  if (!hex.startsWith("#")) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h2 = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h2 = ((b - r) / d + 2) / 6;
    else h2 = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(h2 * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const DEFAULT_THEME_TOML = `# Riceboard Theme Configuration
# Edit these values to customize the app appearance.
# Colors use hex (#rrggbb) format.
# After editing, click "Save & Apply" in Settings.

[colors]
background = "#ffffff"
foreground = "#0a0a0a"
card = "#f8f9fa"
cardForeground = "#0a0a0a"
popover = "#ffffff"
popoverForeground = "#0a0a0a"
primary = "#7c3aed"
primaryForeground = "#ffffff"
secondary = "#f3f4f6"
secondaryForeground = "#1f2937"
muted = "#f3f4f6"
mutedForeground = "#6b7280"
accent = "#f3f4f6"
accentForeground = "#111827"
destructive = "#ef4444"
destructiveForeground = "#ffffff"
border = "#e5e7eb"
input = "#e5e7eb"
ring = "#7c3aed"
sidebarBackground = "#f8f9fa"
sidebarForeground = "#374151"
sidebarAccent = "#f3f4f6"

[colors.dark]
background = "#0f0f17"
foreground = "#cdd6f4"
card = "#181825"
cardForeground = "#cdd6f4"
popover = "#1e1e2e"
popoverForeground = "#cdd6f4"
primary = "#cba6f7"
primaryForeground = "#1e1e2e"
secondary = "#313244"
secondaryForeground = "#cdd6f4"
muted = "#313244"
mutedForeground = "#a6adc8"
accent = "#313244"
accentForeground = "#cdd6f4"
destructive = "#f38ba8"
destructiveForeground = "#1e1e2e"
border = "#313244"
input = "#313244"
ring = "#cba6f7"
sidebarBackground = "#11111b"
sidebarForeground = "#cdd6f4"
sidebarAccent = "#1e1e2e"

[fonts]
ui = "Inter, system-ui, sans-serif"
mono = "JetBrains Mono, Fira Code, Cascadia Code, monospace"
editor = "JetBrains Mono, Fira Code, Cascadia Code, Consolas, Segoe UI Emoji, monospace"
simulation = "monospace"
`;

export const useThemeConfigStore = create<ThemeConfigState>((set, get) => ({
  config: null,
  rawToml: "",
  configPath: "",
  loaded: false,

  loadConfig: async () => {
    try {
      const toml = await invoke<string>("read_theme_config");
      const path = await invoke<string>("get_theme_config_path");
      if (!toml.trim()) {
        set({ config: null, rawToml: "", configPath: path, loaded: true });
        return;
      }
      const config = parseToml(toml);
      set({ config, rawToml: toml, configPath: path, loaded: true });
    } catch (e) {
      console.error("Failed to load theme config:", e);
      set({ loaded: true });
    }
  },

  saveConfig: async (toml: string) => {
    try {
      await invoke("write_theme_config", { content: toml });
      const config = parseToml(toml);
      set({ config, rawToml: toml });
      get().applyTheme();
    } catch (e) {
      console.error("Failed to save theme config:", e);
    }
  },

  applyTheme: () => {
    const { config } = get();
    if (!config || !config.colors || !config.colors.background) return;
    const isDark = document.documentElement.classList.contains("dark");
    const colors = isDark ? config.dark : config.colors;
    const root = document.documentElement;

    const map: Record<string, string> = {
      background: "--background",
      foreground: "--foreground",
      card: "--card",
      cardForeground: "--card-foreground",
      popover: "--popover",
      popoverForeground: "--popover-foreground",
      primary: "--primary",
      primaryForeground: "--primary-foreground",
      secondary: "--secondary",
      secondaryForeground: "--secondary-foreground",
      muted: "--muted",
      mutedForeground: "--muted-foreground",
      accent: "--accent",
      accentForeground: "--accent-foreground",
      destructive: "--destructive",
      destructiveForeground: "--destructive-foreground",
      border: "--border",
      input: "--input",
      ring: "--ring",
    };

    for (const [key, cssVar] of Object.entries(map)) {
      const val = (colors as Record<string, string>)[key];
      if (val) root.style.setProperty(cssVar, colorToHsl(val));
    }

    const sidebarMap: Record<string, string> = {
      sidebarBackground: "--sidebar-background",
      sidebarForeground: "--sidebar-foreground",
      sidebarAccent: "--sidebar-accent",
    };
    for (const [key, cssVar] of Object.entries(sidebarMap)) {
      const val = (colors as Record<string, string>)[key];
      if (val) root.style.setProperty(cssVar, colorToHsl(val));
    }
  },
}));
