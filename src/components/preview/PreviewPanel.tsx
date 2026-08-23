import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Monitor, Layout, Zap, Play, Square } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";

function parseColor(c: string): string {
  if (!c) return "#cba6f7";
  if (c.startsWith("#")) return c.length === 7 ? c : c;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,]+/).filter(Boolean);
    if (p.length >= 3) {
      return "#" + p.slice(0, 3).map(x => {
        const n = parseInt(x);
        return isNaN(n) ? "00" : Math.min(255, n).toString(16).padStart(2, "0");
      }).join("");
    }
  }
  if (/^[0-9a-fA-F]{6}$/.test(c)) return "#" + c;
  return c;
}

function parseKeyValue(content: string, sep: RegExp = /=/): Record<string, string> {
  const kv: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("//") || t.startsWith("--")) continue;
    const m = t.match(sep);
    if (m && m.index !== undefined) {
      kv[t.substring(0, m.index).trim()] = t.substring(m.index + m[0].length).trim();
    }
  }
  return kv;
}

function parseToml(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let current = "";
  sections[current] = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const sectionMatch = t.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1].trim();
      sections[current] = {};
      continue;
    }
    const eqIdx = t.indexOf("=");
    if (eqIdx > 0) {
      const key = t.substring(0, eqIdx).trim();
      const val = t.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      sections[current][key] = val;
    }
  }
  return sections;
}

function parseIni(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let current = "main";
  sections[current] = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith(";")) continue;
    const sectionMatch = t.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1].trim();
      sections[current] = {};
      continue;
    }
    const eqIdx = t.indexOf("=");
    if (eqIdx > 0) {
      sections[current][t.substring(0, eqIdx).trim()] = t.substring(eqIdx + 1).trim();
    }
  }
  return sections;
}

// --- Hyprland ---
function parseHyprland(content: string) {
  const r = {
    gapsIn: 5, gapsOut: 10, borderSize: 2, rounding: 8,
    layout: "dwindle", activeBorderColor: "#cba6f7", inactiveBorderColor: "#45475a",
    blurEnabled: true, blurSize: 3, blurPasses: 1,
    activeOpacity: 1.0, inactiveOpacity: 1.0,
    animationsEnabled: true, animBezier: "ease, 0.25, 0.1, 0.25, 1",
    execOnce: [] as string[], exec: [] as string[],
    binds: [] as { mods: string; key: string; dispatcher: string; arg: string }[],
    terminal: "kitty", variables: {} as Record<string, string>,
    windowRules: [] as string[], layerRules: [] as string[],
    monitorConfig: "", envVars: [] as string[],
  };
  let section = "";
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.match(/^\w[\w-]*\s*\{/)) { section = t.split("{")[0].trim(); continue; }
    if (t === "}") { section = ""; continue; }
    const eqIdx = t.indexOf("=");
    if (eqIdx < 0) continue;
    const rawKey = t.substring(0, eqIdx).trim();
    const rawVal = t.substring(eqIdx + 1).trim();
    const fk = section ? `${section}.${rawKey}` : rawKey;
    if (rawKey.startsWith("$")) { r.variables[rawKey] = rawVal; continue; }
    if (rawKey === "monitor") { r.monitorConfig = rawVal; continue; }
    if (rawKey === "exec-once") { r.execOnce.push(rawVal); continue; }
    if (rawKey === "exec") { r.exec.push(rawVal); continue; }
    if (rawKey === "env") { r.envVars.push(rawVal); continue; }
    if (rawKey === "source") continue;
    if (rawKey.startsWith("windowrule")) { r.windowRules.push(rawVal); continue; }
    if (rawKey === "layerrule") { r.layerRules.push(rawVal); continue; }
    if (rawKey.startsWith("bind")) {
      const parts = rawVal.split(",").map(s => s.trim());
      if (parts.length >= 3) r.binds.push({ mods: parts[0], key: parts[1], dispatcher: parts[2], arg: parts.slice(3).join(", ") });
      continue;
    }
    if (rawKey.startsWith("animation")) { r.animBezier = rawVal; continue; }
    if (fk === "general.gaps_in") r.gapsIn = parseInt(rawVal) || 5;
    else if (fk === "general.gaps_out") r.gapsOut = parseInt(rawVal) || 10;
    else if (fk === "general.border_size") r.borderSize = parseInt(rawVal) || 2;
    else if (fk === "general.layout") r.layout = rawVal;
    else if (fk === "general.col.active_border") r.activeBorderColor = parseColor(rawVal.split(" ")[0]);
    else if (fk === "general.col.inactive_border") r.inactiveBorderColor = parseColor(rawVal.split(" ")[0]);
    else if (fk === "decoration.rounding") r.rounding = parseInt(rawVal) || 8;
    else if (fk === "decoration.blur.enabled" || fk === "decoration.blur:enabled") r.blurEnabled = rawVal !== "false";
    else if (fk === "decoration.blur.size") r.blurSize = parseInt(rawVal) || 3;
    else if (fk === "decoration.blur.passes") r.blurPasses = parseInt(rawVal) || 1;
    else if (fk === "decoration.active_opacity") r.activeOpacity = parseFloat(rawVal) || 1;
    else if (fk === "decoration.inactive_opacity") r.inactiveOpacity = parseFloat(rawVal) || 1;
    else if (fk === "animations.enabled") r.animationsEnabled = rawVal !== "false" && rawVal !== "no";
  }
  for (const b of r.binds) {
    if (b.dispatcher === "exec" && (b.arg.toLowerCase().includes("kitty") || b.arg.toLowerCase().includes("alacritty") || b.arg.toLowerCase().includes("ghostty")))
      r.terminal = b.arg.split(" ").pop() || "kitty";
  }
  return r;
}

function parseWaybar(content: string) {
  try {
    const c = content.split("\n").filter(l => !l.trim().startsWith("//") && !l.trim().startsWith("/*")).join("\n");
    const j = JSON.parse(c);
    return {
      left: j["modules-left"] || [], center: j["modules-center"] || [], right: j["modules-right"] || [],
      position: j.position || "top", height: j.height || 32, spacing: j.spacing || 4,
    };
  } catch {
    return { left: ["hyprland/workspaces"], center: ["clock"], right: ["pulseaudio", "network", "battery", "tray"], position: "top", height: 32, spacing: 4 };
  }
}

function parseKitty(content: string) {
  const kv: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const sp = t.indexOf(" ");
    if (sp > 0) { const k = t.substring(0, sp).trim(); const v = t.substring(sp + 1).trim(); if (k.match(/^[a-z_]+$/i) && !k.startsWith("map") && !k.startsWith("action") && !k.startsWith("mouse_map")) kv[k] = v; }
  }
  return {
    fontFamily: kv.font_family || "monospace", fontSize: parseFloat(kv.font_size || "12"),
    background: kv.background || "#1e1e2e", foreground: kv.foreground || "#cdd6f4",
    bgOpacity: parseFloat(kv.background_opacity || "1"), padding: parseInt(kv.window_padding_width || "0"),
    cursor: kv.cursor || "#f5e0dc", selBg: kv.selection_background || "#45475a",
    colors: Array.from({ length: 16 }, (_, i) => kv[`color${i}`] || ""),
  };
}

function parseAlacritty(content: string) {
  const kv = parseKeyValue(content, /\s*[:=]\s*/);
  const fontM = content.match(/family\s*=\s*"([^"]+)"/);
  const sizeM = content.match(/size\s*=\s*([\d.]+)/);
  const bgM = content.match(/primary\s*[\s\S]*?background\s*=\s*'#?([0-9a-fA-F]+)'/);
  const fgM = content.match(/primary\s*[\s\S]*?foreground\s*=\s*'#?([0-9a-fA-F]+)/);
  const colors: Record<string, string> = {};
  const colorM = content.match(/colors\s*\{([\s\S]*)\}/);
  if (colorM) {
    for (const m of colorM[1].matchAll(/(\w+)\s*=\s*'#?([0-9a-fA-F]{6})'/g)) colors[m[1]] = "#" + m[2];
  }
  return {
    fontFamily: fontM?.[1] || "monospace", fontSize: parseFloat(sizeM?.[1] || "11"),
    background: bgM ? "#" + bgM[1] : "#1e1e2e", foreground: fgM ? "#" + fgM[1] : "#cdd6f4",
    opacity: parseFloat(kv.opacity || "1"), padding: parseInt(kv.padding?.split("x")?.[0] || "0"),
    colors,
  };
}

function parseGhostty(content: string) {
  const kv = parseKeyValue(content);
  const colorMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(kv)) {
    if (k.startsWith("palette") || k.startsWith("color")) {
      colorMap[k] = v.startsWith("#") ? v : "#" + v;
    }
  }
  return {
    fontFamily: kv.font_family || "monospace", fontSize: parseFloat(kv.font_size || "13"),
    background: kv.background || "#1e1e2e", foreground: kv.foreground || "#cdd6f4",
    windowPaddingX: parseInt(kv.window_padding_x || "0"),
    windowPaddingY: parseInt(kv.window_padding_y || "0"),
    colors: colorMap,
  };
}

function parseFoot(content: string) {
  const sections = parseIni(content);
  const main = sections["main"] || sections[""] || {};
  const colors = sections["colors"] || {};
  const font = main.font || "monospace";
  const bg = colors.background || "#1e1e2e";
  const fg = colors.foreground || "#cdd6f4";
  const palette = colors.palette || "";
  return {
    font, fontSize: parseFloat(font.match(/:size=(\d+)/)?.[1] || "12"),
    background: parseColor(bg), foreground: parseColor(fg),
    dpiAware: main.dpi_aware !== "no",
    pad: main.pad || "8x8",
    cursorBlink: main.cursor !== "block-no-blink",
    boldIsBright: main.bold_is_bright === "yes",
    palette: palette.split(",").map((s: string) => s.trim()).filter(Boolean),
  };
}

function parseFuzzel(content: string) {
  const kv = parseKeyValue(content);
  const font = kv.font || "monospace";
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(kv)) {
    if (k.includes("color")) colors[k] = v;
  }
  return {
    font, fontSize: parseFloat(font.match(/:size=(\d+)/)?.[1] || "12"),
    width: parseInt(kv.width || "30"), lines: parseInt(kv.lines || "8"),
    prompt: kv.prompt || "> ", placeholder: kv.placeholder || "Search...",
    colors,
  };
}

function parseSwaync(content: string) {
  try {
    const cleaned = content.replace(/\/\/.*$/gm, "");
    const j = JSON.parse(cleaned);
    return {
      width: j.controlCenter?.width || 350,
      borderRadius: j.controlCenter?.borderRadius || 10,
      headerFontSize: j.controlCenter?.headerFontSize || 14,
      bodyFontSize: j.controlCenter?.bodyFontSize || 13,
      timeout: j.timeout || 5000,
      maxVisible: j.maxVisible || 10,
      fadeIn: j.fadeIn !== false,
      positionX: j.positionX || "right",
    };
  } catch {
    return { width: 350, borderRadius: 10, headerFontSize: 14, bodyFontSize: 13, timeout: 5000, maxVisible: 10, fadeIn: true, positionX: "right" };
  }
}

function parseYazi(content: string) {
  const toml = parseToml(content);
  const general = toml["manager"] || toml[""] || {};
  return {
    layout: general.layout || ["ratio", "2, 4, 4"],
    sortBy: general.sort_by || "modified",
    sortReverse: general.sort_reverse === "true",
    showHidden: general.show_hidden === "true",
    showSymlink: general.show_symlink === "true",
    linemode: general.linemode || "size",
    ratio: general.ratio || "2, 4, 4",
  };
}

function parseWlogout(content: string) {
  const lines = content.split("\n");
  const buttons: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.includes("label") && !t.startsWith("//")) {
      const m = t.match(/"([^"]+)"/);
      if (m) buttons.push(m[1]);
    }
  }
  return { buttons, layoutFile: "layout" };
}

function parseLazygit(content: string) {
  try {
    const cleaned = content.replace(/#.*$/gm, "");
    const kv = parseKeyValue(cleaned);
    return {
      gui: kv.gui?.includes("true") !== false,
      showIcons: kv.show_icons !== "false",
      nerdFontsVersion: parseInt(kv.nerd_fonts_version || "3"),
      theme: kv.theme || "dark-plain",
    };
  } catch {
    return { gui: true, showIcons: true, nerdFontsVersion: 3, theme: "dark-plain" };
  }
}

function parseBat(content: string) {
  const kv = parseKeyValue(content);
  return {
    theme: (kv.theme || "catppuccin-mocha").replace(/["']/g, ""),
    style: kv.style || "full",
    numbers: kv.numbers !== "never",
    decorations: kv.decorations || "full",
    grid: kv.grid === "true",
    italicText: kv["italic-text"] || "always",
    paging: kv.paging || "auto",
  };
}

function parseEza(content: string) {
  const hasIcons = content.includes("--icons") || content.includes("icons=auto");
  const hasGit = content.includes("--git") || content.includes("icons=auto");
  const hasLong = content.includes("--long") || content.includes("-l");
  return { hasIcons, hasGit, hasLong, alias: content.trim() || "eza" };
}

function parseWallust(content: string) {
  const toml = parseToml(content);
  const general = toml[""] || {};
  return {
    backend: general.backend || "fast_resize",
    cache_dir: general.cache_dir || "$XDG_CACHE_HOME/wallust",
    colorspace: general.colorspace || "rgb",
    template_dir: general.template_dir || "",
    threshold: parseInt(general.threshold || "10"),
  };
}

function parseMako(content: string) {
  const kv: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("="); if (eq > 0) { kv[t.substring(0, eq).trim()] = t.substring(eq + 1).trim(); }
    else { const sp = t.indexOf(" "); if (sp > 0) kv[t.substring(0, sp).trim()] = t.substring(sp + 1).trim(); }
  }
  return { font: kv.font || "monospace 10", width: parseInt(kv.width || "350"), borderRadius: parseInt(kv["border-radius"] || "8"), bgColor: kv["background-color"] || "#1e1e2ee6", textColor: kv["text-color"] || "#cdd6f4", borderColor: kv["border-color"] || "#cba6f7", timeout: parseInt(kv["default-timeout"] || "5000"), maxWidth: parseInt(kv["max-visible"] || "5") };
}

function parseDunst(content: string) {
  const sections: Record<string, Record<string, string>> = {};
  let current = "global";
  sections[current] = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("[")) { current = t.replace(/[\[\]]/g, "").trim(); sections[current] = {}; continue; }
    const eq = t.indexOf("=");
    if (eq > 0) sections[current][t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
  }
  const g = sections["global"] || {};
  return {
    font: g.font || "monospace 10", width: parseInt(g.width || "300"), height: parseInt(g.height || "300"),
    cornerRadius: parseInt(g.corner_radius || "10"), padding: parseInt(g.padding || "10"),
    bgColor: g.background || "#1e1e2e", textColor: g.foreground || "#cdd6f4",
    frameColor: g.frame_color || "#cba6f7", fontSize: parseInt((g.font.match(/(\d+)/)?.[1]) || "10"),
    timeout: parseInt(g.timeout || "5"), maxIconSize: parseInt(g.max_icon_size || "32"),
  };
}

function parseRofi(content: string) {
  const fontM = content.match(/font:\s*"([^"]+)"/);
  const widthM = content.match(/width:\s*(\d+)px/);
  const radiusM = content.match(/border-radius:\s*(\d+)px/);
  const bgM = content.match(/background-color:\s*@?(\w+)/);
  const accentM = content.match(/accent:\s*#([0-9a-fA-F]+)/);
  return {
    font: fontM ? fontM[1] : "monospace 12", hasIcons: content.includes("show-icons"),
    modi: content.match(/modi:\s*"([^"]+)"/)?.[1]?.split(",").map(s => s.trim()) || ["drun", "run"],
    width: parseInt(widthM?.[1] || "600"), borderRadius: parseInt(radiusM?.[1] || "8"),
    accentColor: accentM ? "#" + accentM[1] : "#cba6f7",
  };
}

function parseWofi(content: string) {
  const kv: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const sp = t.indexOf(" "); if (sp > 0) kv[t.substring(0, sp).trim()] = t.substring(sp + 1).trim();
  }
  return {
    width: parseInt(kv.width || "600"), height: parseInt(kv.height || "0"),
    show: kv.show || "drun", prompt: kv.prompt || "Search...",
    allowImages: content.includes("allow_images=true"),
    insensitive: content.includes("insensitive=true"),
  };
}

function parseNvim(content: string) {
  const t = content.match(/colorscheme\s+(\w+)/)?.[1] || "catppuccin";
  return { theme: t, hasTelescope: content.includes("telescope"), hasTreesitter: content.includes("treesitter"), hasLsp: content.includes("nvim-lspconfig"), hasLazy: content.includes("lazy"), pluginCount: (content.match(/\{[^}]*"[^"]*\/[^"]*"/g) || []).length };
}

function parseZsh(content: string) {
  const t = content.match(/ZSH_THEME="([^"]+)"/)?.[1]?.split("/").pop() || "robbyrussell";
  const p = content.match(/plugins=\(([\s\S]*?)\)/)?.[1]?.trim().split(/\s+/) || [];
  return { theme: t, plugins: p, hasP10k: content.includes("powerlevel10k"), hasAutosuggestions: content.includes("autosuggestions") };
}

function parseFish(content: string) {
  const themeM = content.match(/fish_theme\s+(\w+)/);
  const setThemeM = content.match(/set\s+-g\s+fish_theme\s+(\w+)/);
  const plugins = (content.match(/fisher\s+install\s+([^\n]+)/g) || []).map(m => m.split(/\s+/).pop() || "");
  return { theme: themeM?.[1] || setThemeM?.[1] || "default", plugins, hasFisher: content.includes("fisher"), hasAutopair: content.includes("autopair"), hasZoxide: content.includes("zoxide") };
}

function parseBash(content: string) {
  const promptM = content.match(/PS1='([^']+)'/);
  const aliasCount = (content.match(/^alias\s+/gm) || []).length;
  const hasNvm = content.includes("NVM_DIR") || content.includes("nvm");
  const hasConda = content.includes("conda");
  const hasPnpm = content.includes("PNPM_HOME");
  return { prompt: promptM?.[1] || "\\u@\\h:\\w\\$ ", aliasCount, hasNvm, hasConda, hasPnpm, hasBashCompletion: content.includes("bash_completion") };
}

function parseTmux(content: string) {
  return { prefix: content.match(/set\s+-g\s+prefix\s+(\S+)/)?.[1] || "C-b", hasMouse: content.includes("mouse on"), hasVi: content.includes("mode-keys vi"), hasTPM: content.includes("tpm"), bindCount: (content.match(/^bind/gm) || []).length };
}

function parseBtop(content: string) {
  const kv: Record<string, string> = {};
  for (const line of content.split("\n")) { const t = line.trim(); if (!t || t.startsWith("#") || t.startsWith("[")) continue; const eq = t.indexOf("="); if (eq > 0) kv[t.substring(0, eq).trim()] = t.substring(eq + 1).trim(); }
  return { theme: kv.color_theme || "catppuccin_mocha", updateMs: parseInt(kv.update_ms || "2000"), useIcons: kv.use_icons !== "False" };
}

function parseHyprpaper(content: string) {
  const kv = parseKeyValue(content);
  const preload = content.match(/preload\s*=\s*(.+)/g)?.map(m => m.split("=")[1].trim()) || [];
  const wallpaper = kv.wallpaper || "";
  const splash = kv.splash !== "false";
  return { preload, wallpaper, splash, ipcEnabled: kv.ipc !== "false" };
}

function parseHyprlock(content: string) {
  const kv = parseKeyValue(content);
  return {
    bgColor: kv.background || kv.color || "#1e1e2e",
    fontFamily: kv.font_family || kv.font || "monospace",
    fontSize: parseInt(kv.font_size || "96"),
    showClock: content.includes("clock") || content.includes("date"),
    showText: content.includes("text"),
    inputField: content.includes("input"),
    blurPasses: parseInt(kv.blur_passes || "4"),
    noise: parseFloat(kv.noise || "0.01"),
  };
}

function parseCava(content: string) {
  const kv = parseKeyValue(content);
  return {
    method: kv.method || "auto", framerate: parseInt(kv.framerate || "60"),
    sensitivity: parseInt(kv.sensitivity || "100"), bars: parseInt(kv.bars || "20"),
    barWidth: parseInt(kv.bar_width || "8"), barSpacing: parseInt(kv.bar_spacing || "2"),
    colors: content.match(/gradient\s*=/) ? "gradient" : "single",
    stereo: kv.stereo === "true", reverse: kv.reverse === "true",
  };
}

function parseEww(content: string) {
  const widgets = (content.match(/\(defwindow\s+(\w+)/g) || []).map(m => m.split(/\s+/)[1]);
  const vars = (content.match(/\(defvar\s+(\w+)/g) || []).map(m => m.split(/\s+/)[1]);
  const buttons = (content.match(/\(button\s/g) || []).length;
  const labels = (content.match(/\(label\s/g) || []).length;
  const hasBox = content.includes("(box");
  const hasScale = content.includes("(scale");
  return { widgets, vars, buttons, labels, hasBox, hasScale, widgetCount: widgets.length };
}

function parseStarship(content: string) {
  const kv = parseKeyValue(content);
  return {
    format: kv.format || "",
    promptChar: kv.character?.match(/success_symbol\s*=\s*"([^"]+)"/)?.[1] || "$",
    username: content.includes("username"),
    hostname: content.includes("hostname"),
    directory: kv.directory?.match(/truncation_length\s*=\s*(\d+)/)?.[1] || "3",
    modules: Object.keys(kv).filter(k => k.includes("disabled")).length,
  };
}

function parseFastfetch(content: string) {
  try {
    const cleaned = content.replace(/\/\/.*$/gm, "");
    const j = JSON.parse(cleaned);
    return {
      logoType: j.logo?.type || "builtin",
      moduleOrder: j.modules?.map((m: { type: string }) => m.type) || [],
      colorKeys: j.modules?.filter((m: { type: string }) => m.type === "Title" || m.type === "Separator").length || 0,
    };
  } catch {
    return { logoType: "builtin", moduleOrder: [] as string[], colorKeys: 0 };
  }
}

const sys = { user: "faust", host: "arch", os: "Arch Linux", wm: "Hyprland", term: "kitty", cpu: "Ryzen 7 5800X", mem: "6.2 / 16 GB", time: "14:32", wifi: "HomeNetwork", battery: 92, volume: 80 };

function DesktopSimulation({ hCfg, wCfg, kCfg, mCfg, rCfg, nCfg, bCfg }: {
  hCfg: ReturnType<typeof parseHyprland>; wCfg: ReturnType<typeof parseWaybar>;
  kCfg: ReturnType<typeof parseKitty>; mCfg: ReturnType<typeof parseMako>;
  rCfg: ReturnType<typeof parseRofi>; nCfg: ReturnType<typeof parseNvim>;
  bCfg: ReturnType<typeof parseBtop>;
}) {
  const [showRofi, setShowRofi] = useState(false);
  const [showMako, setShowMako] = useState(true);
  const [activeWs, setActiveWs] = useState(1);
  const [focusedWin, setFocusedWin] = useState(0);

  const isMaster = hCfg.layout === "master";
  const hasWaybar = hCfg.execOnce.some(e => e.includes("waybar")) || hCfg.exec.some(e => e.includes("waybar"));
  const hasSWWW = hCfg.execOnce.some(e => e.includes("swww")) || hCfg.exec.some(e => e.includes("swww"));
  const hasMako = hCfg.execOnce.some(e => e.includes("mako")) || hCfg.exec.some(e => e.includes("mako"));

  const blurCSS = hCfg.blurEnabled ? `blur(${Math.min(hCfg.blurSize * hCfg.blurPasses, 16)}px)` : "none";
  const wsColors = ["#89b4fa", "#a6e3a1", "#cba6f7", "#f9e2af", "#f38ba8", "#fab387", "#89dceb", "#f5c2e7", "#74c7ec", "#b4befe"];

  return (
    <div className="relative select-none">
      <div className="rounded-xl overflow-hidden border border-[#313244]/50 font-mono relative" style={{ height: 400, backgroundColor: "#1e1e2e" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1e1e2e 0%, #181825 40%, #1e1e2e 70%, #31324422 100%)" }}>
          {hasSWWW && <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 70%, rgba(203,166,247,0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(137,180,250,0.1) 0%, transparent 50%)" }} />}
        </div>
        {hasWaybar && (
          <div className="relative z-20 flex items-center justify-between px-2" style={{ height: Math.min(wCfg.height, 36), backgroundColor: "rgba(17,17,27,0.95)", borderBottom: "1px solid rgba(49,50,68,0.5)" }}>
            <div className="flex items-center" style={{ gap: wCfg.spacing }}>
              {wCfg.left.includes("hyprland/workspaces") && Array.from({ length: 10 }, (_, i) => (
                <button key={i} onClick={() => setActiveWs(i + 1)} className="rounded flex items-center justify-center transition-all" style={{ width: 22, height: 22, fontSize: 11, backgroundColor: i + 1 === activeWs ? `${wsColors[i % wsColors.length]}33` : "transparent", color: i + 1 === activeWs ? wsColors[i % wsColors.length] : "#585b70", border: i + 1 === activeWs ? `1px solid ${wsColors[i % wsColors.length]}55` : "1px solid transparent" }}>{i + 1}</button>
              ))}
              {wCfg.left.includes("hyprland/window") && <span className="ml-1 text-[#cdd6f4] text-[11px]">kitty ~ </span>}
            </div>
            <div className="flex items-center" style={{ gap: wCfg.spacing * 2, fontSize: 11 }}>
              {wCfg.center.map((m: string, i: number) => m === "clock" && <span key={i} className="text-[#f9e2af]">{sys.time}</span>)}
            </div>
            <div className="flex items-center text-[#a6adc8]" style={{ gap: wCfg.spacing, fontSize: 11 }}>
              {wCfg.right.includes("pulseaudio") && <span className="text-[#f5c2e7]">{sys.volume}%</span>}
              {wCfg.right.includes("network") && <span className="text-[#89b4fa]">{sys.wifi}</span>}
              {wCfg.right.includes("battery") && <span className="text-[#a6e3a1]">{sys.battery}%</span>}
            </div>
          </div>
        )}
        <div className="relative z-10 h-full" style={{ padding: hasWaybar ? `0 ${hCfg.gapsOut}px ${hCfg.gapsOut}px` : hCfg.gapsOut }}>
          <div className="h-full flex" style={{ gap: hCfg.gapsIn, padding: hCfg.gapsIn }}>
            {isMaster ? (
              <>
                <div className="flex-1 flex flex-col" style={{ gap: hCfg.gapsIn }}>
                  <div className="flex-1 flex flex-col overflow-hidden cursor-pointer" onClick={() => setFocusedWin(0)} style={{ border: `${hCfg.borderSize}px solid ${focusedWin === 0 ? hCfg.activeBorderColor : hCfg.inactiveBorderColor}`, borderRadius: hCfg.rounding, opacity: focusedWin === 0 ? hCfg.activeOpacity : hCfg.inactiveOpacity, backdropFilter: blurCSS, backgroundColor: kCfg.background }}>
                    <div className="flex items-center px-2 py-0.5 text-[11px]" style={{ backgroundColor: "#181825", borderBottom: "1px solid #313244", fontFamily: kCfg.fontFamily }}>
                      <div className="flex gap-1.5 mr-2"><div className="w-2 h-2 rounded-full bg-[#f38ba8]" /><div className="w-2 h-2 rounded-full bg-[#f9e2af]" /><div className="w-2 h-2 rounded-full bg-[#a6e3a1]" /></div>
                      <span className="text-[#cdd6f4]">{hCfg.terminal}</span>
                      <span className="ml-auto text-[#585b70]">~</span>
                    </div>
                    <div className="flex-1 p-2.5 overflow-hidden" style={{ color: kCfg.foreground, fontSize: 11, fontFamily: kCfg.fontFamily, lineHeight: 1.7 }}>
                      <div><span style={{ color: "#cdd6f4" }}>{sys.user}@{sys.host}</span><span style={{ color: "#585b70" }}>:</span><span style={{ color: "#cdd6f4" }}>~</span><span style={{ color: "#585b70" }}>$</span> neofetch</div>
                      <div className="flex gap-3 mt-1">
                        <div style={{ color: "#cdd6f4", fontSize: 10, lineHeight: 1.4, whiteSpace: "pre" }}>{`  /\\_/\\  \n ( o.o ) \n  > ^ <  \n /|   |\\\n(_|   |_)`}</div>
                        <div className="text-[10px] leading-relaxed" style={{ fontFamily: kCfg.fontFamily }}>
                          <div><span style={{ color: "#cdd6f4" }}>OS</span> {sys.os}</div>
                          <div><span style={{ color: "#cdd6f4" }}>WM</span> {hCfg.layout}</div>
                          <div><span style={{ color: "#cdd6f4" }}>Term</span> {hCfg.terminal}</div>
                          <div><span style={{ color: "#cdd6f4" }}>CPU</span> {sys.cpu}</div>
                          <div><span style={{ color: "#cdd6f4" }}>Mem</span> {sys.mem}</div>
                        </div>
                      </div>
                      <div className="mt-1.5"><span style={{ color: "#cdd6f4" }}>$</span> <span style={{ color: "#585b70" }}>{"█"}</span></div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col" style={{ gap: hCfg.gapsIn }}>
                  <div className="flex-1 flex flex-col overflow-hidden cursor-pointer" onClick={() => setFocusedWin(1)} style={{ border: `${hCfg.borderSize}px solid ${focusedWin === 1 ? hCfg.activeBorderColor : hCfg.inactiveBorderColor}`, borderRadius: hCfg.rounding, opacity: focusedWin === 1 ? hCfg.activeOpacity : hCfg.inactiveOpacity, backdropFilter: blurCSS, backgroundColor: kCfg.background }}>
                    <div className="flex items-center px-2 py-0.5 text-[11px]" style={{ backgroundColor: "#181825", borderBottom: "1px solid #313244", fontFamily: kCfg.fontFamily }}>
                      <div className="flex gap-1.5 mr-2"><div className="w-2 h-2 rounded-full bg-[#f38ba8]" /><div className="w-2 h-2 rounded-full bg-[#f9e2af]" /><div className="w-2 h-2 rounded-full bg-[#a6e3a1]" /></div>
                      <span style={{ color: "#f38ba8" }}>nvim init.lua</span>
                    </div>
                    <div className="flex-1 p-2.5 overflow-hidden" style={{ color: kCfg.foreground, fontSize: 10, fontFamily: kCfg.fontFamily, lineHeight: 1.7 }}>
                      <div style={{ color: "#585b70" }}>{`-- bootstrap lazy.nvim`}</div>
                      <div><span style={{ color: "#cba6f7" }}>require</span>(<span style={{ color: "#a6e3a1" }}>"lazy"</span>).setup({"{"}</div>
                      {nCfg.hasLazy && <div className="pl-2">{`{ `}<span style={{ color: "#a6e3a1" }}>"catppuccin/nvim"</span>{` },`}</div>}
                      <div>{"})"}</div>
                      <div className="mt-1"><span style={{ color: "#f38ba8" }}>vim</span>.cmd(<span style={{ color: "#a6e3a1" }}>"colorscheme {nCfg.theme}"</span>)</div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden cursor-pointer" onClick={() => setFocusedWin(2)} style={{ border: `${hCfg.borderSize}px solid ${focusedWin === 2 ? hCfg.activeBorderColor : hCfg.inactiveBorderColor}`, borderRadius: hCfg.rounding, opacity: focusedWin === 2 ? hCfg.activeOpacity : hCfg.inactiveOpacity, backdropFilter: blurCSS, backgroundColor: kCfg.background }}>
                    <div className="flex-1 p-2.5 overflow-hidden" style={{ color: kCfg.foreground, fontSize: 10, fontFamily: kCfg.fontFamily, lineHeight: 1.7 }}>
                      <div className="flex justify-between"><span>CPU</span><span style={{ color: "#a6e3a1" }}>42%</span></div>
                      <div className="h-1.5 rounded overflow-hidden mt-0.5" style={{ backgroundColor: "#313244" }}><div className="h-full rounded" style={{ width: "42%", backgroundColor: "#89b4fa" }} /></div>
                      <div className="flex justify-between mt-1"><span>MEM</span><span style={{ color: "#f9e2af" }}>6.2/16</span></div>
                      <div className="h-1.5 rounded overflow-hidden mt-0.5" style={{ backgroundColor: "#313244" }}><div className="h-full rounded" style={{ width: "39%", backgroundColor: "#f9e2af" }} /></div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 flex flex-col overflow-hidden cursor-pointer" onClick={() => setFocusedWin(0)} style={{ border: `${hCfg.borderSize}px solid ${focusedWin === 0 ? hCfg.activeBorderColor : hCfg.inactiveBorderColor}`, borderRadius: hCfg.rounding, opacity: focusedWin === 0 ? hCfg.activeOpacity : hCfg.inactiveOpacity, backdropFilter: blurCSS, backgroundColor: kCfg.background }}>
                  <div className="flex items-center px-2 py-0.5 text-[11px]" style={{ backgroundColor: "#181825", borderBottom: "1px solid #313244", fontFamily: kCfg.fontFamily }}>
                    <div className="flex gap-1.5 mr-2"><div className="w-2 h-2 rounded-full bg-[#f38ba8]" /><div className="w-2 h-2 rounded-full bg-[#f9e2af]" /><div className="w-2 h-2 rounded-full bg-[#a6e3a1]" /></div>
                    <span style={{ color: "#cdd6f4" }}>{hCfg.terminal}</span>
                  </div>
                  <div className="flex-1 p-2.5 overflow-hidden" style={{ color: kCfg.foreground, fontSize: 11, fontFamily: kCfg.fontFamily, lineHeight: 1.7 }}>
                    <div><span style={{ color: "#cdd6f4" }}>{sys.user}@{sys.host}</span><span style={{ color: "#585b70" }}>:</span><span style={{ color: "#cdd6f4" }}>~</span><span style={{ color: "#585b70" }}>$</span> neofetch</div>
                    <div className="flex gap-3 mt-1">
                      <div style={{ color: "#cdd6f4", fontSize: 10, lineHeight: 1.4, whiteSpace: "pre" }}>{`  /\\_/\\  \n ( o.o ) \n  > ^ <  \n /|   |\\\n(_|   |_)`}</div>
                      <div style={{ color: "#a6adc8", fontSize: 10, lineHeight: 1.6 }}>
                        <div><span style={{ color: "#cdd6f4" }}>OS</span> {sys.os}</div>
                        <div><span style={{ color: "#cdd6f4" }}>WM</span> {hCfg.layout}</div>
                        <div><span style={{ color: "#cdd6f4" }}>CPU</span> {sys.cpu}</div>
                      </div>
                    </div>
                    <div className="mt-1.5"><span style={{ color: "#cdd6f4" }}>$</span> <span style={{ color: "#585b70" }}>{"█"}</span></div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col" style={{ gap: hCfg.gapsIn }}>
                  <div className="flex-1 flex flex-col overflow-hidden cursor-pointer" onClick={() => setFocusedWin(1)} style={{ border: `${hCfg.borderSize}px solid ${focusedWin === 1 ? hCfg.activeBorderColor : hCfg.inactiveBorderColor}`, borderRadius: hCfg.rounding, opacity: focusedWin === 1 ? hCfg.activeOpacity : hCfg.inactiveOpacity, backdropFilter: blurCSS, backgroundColor: kCfg.background }}>
                    <div className="flex items-center px-2 py-0.5 text-[11px]" style={{ backgroundColor: "#181825", borderBottom: "1px solid #313244", fontFamily: kCfg.fontFamily }}>
                      <div className="flex gap-1.5 mr-2"><div className="w-2 h-2 rounded-full bg-[#f38ba8]" /><div className="w-2 h-2 rounded-full bg-[#f9e2af]" /><div className="w-2 h-2 rounded-full bg-[#a6e3a1]" /></div>
                      <span style={{ color: "#f38ba8" }}>nvim</span>
                    </div>
                    <div className="flex-1 p-2.5 overflow-hidden" style={{ color: kCfg.foreground, fontSize: 10, fontFamily: kCfg.fontFamily, lineHeight: 1.7 }}>
                      <div style={{ color: "#585b70" }}>{`-- lazy.nvim setup`}</div>
                      <div><span style={{ color: "#cba6f7" }}>require</span>(<span style={{ color: "#a6e3a1" }}>"lazy"</span>).setup({"{"}</div>
                      <div className="pl-2">{`{ `}<span style={{ color: "#a6e3a1" }}>"catppuccin"</span>{` },`}</div>
                      <div>{"})"}</div>
                      <div><span style={{ color: "#f38ba8" }}>vim</span>.cmd(<span style={{ color: "#a6e3a1" }}>"colorscheme {nCfg.theme}"</span>)</div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden cursor-pointer" onClick={() => setFocusedWin(2)} style={{ border: `${hCfg.borderSize}px solid ${focusedWin === 2 ? hCfg.activeBorderColor : hCfg.inactiveBorderColor}`, borderRadius: hCfg.rounding, opacity: focusedWin === 2 ? hCfg.activeOpacity : hCfg.inactiveOpacity, backdropFilter: blurCSS, backgroundColor: kCfg.background }}>
                    <div className="flex-1 p-2.5 overflow-hidden" style={{ color: kCfg.foreground, fontSize: 10, fontFamily: kCfg.fontFamily, lineHeight: 1.7 }}>
                      <div className="flex justify-between"><span>CPU</span><span style={{ color: "#a6e3a1" }}>42%</span></div>
                      <div className="h-1.5 rounded overflow-hidden mt-0.5" style={{ backgroundColor: "#313244" }}><div className="h-full rounded" style={{ width: "42%", backgroundColor: "#89b4fa" }} /></div>
                      <div className="flex justify-between mt-1"><span>MEM</span><span style={{ color: "#f9e2af" }}>6.2/16</span></div>
                      <div className="h-1.5 rounded overflow-hidden mt-0.5" style={{ backgroundColor: "#313244" }}><div className="h-full rounded" style={{ width: "39%", backgroundColor: "#f9e2af" }} /></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {showRofi && (
            <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setShowRofi(false)}>
              <div className="w-72 overflow-hidden" style={{ border: `2px solid #cba6f7`, borderRadius: hCfg.rounding, backgroundColor: "#1e1e2e", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", fontFamily: kCfg.fontFamily }} onClick={e => e.stopPropagation()}>
                <div className="px-3 py-2 text-[11px] flex items-center gap-2" style={{ backgroundColor: "#181825", borderBottom: "1px solid #45475a" }}>
                  <span style={{ color: "#cba6f7" }}>{">"}</span>
                  <span style={{ color: "#a6adc8" }}>Type to search...</span>
                </div>
                {["firefox", "kitty", "neovim", "thunar", "pavucontrol", "htop"].map((app, i) => (
                  <div key={app} className="px-3 py-1 text-[11px] flex items-center gap-2" style={{ backgroundColor: i === 0 ? "#cba6f722" : "transparent", color: i === 0 ? "#cba6f7" : "#a6adc8" }}>
                    {rCfg.hasIcons && <span style={{ fontSize: 10 }}>{["", "", "", "", "", ""][i] || ""}</span>}
                    <span>{app}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hasMako && showMako && (
            <div className="absolute z-30" style={{ top: hasWaybar ? Math.min(wCfg.height, 36) + 8 : 8, right: 8 }}>
              <div className="p-2.5 text-[11px]" style={{ maxWidth: mCfg.maxWidth * 80, borderRadius: mCfg.borderRadius, backgroundColor: "#1e1e2e", border: `2px solid ${mCfg.borderColor}`, color: mCfg.textColor, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", fontFamily: kCfg.fontFamily }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: mCfg.borderColor, fontWeight: "bold" }}>WiFi connected</span>
                  <button className="text-[10px] opacity-50 hover:opacity-100" onClick={() => setShowMako(false)}>x</button>
                </div>
                <div style={{ color: "#cdd6f4" }}>Connected to {sys.wifi}</div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 py-1 text-[9px]" style={{ backgroundColor: "rgba(17,17,27,0.85)", borderTop: "1px solid rgba(49,50,68,0.4)" }}>
          {hCfg.binds.filter(b => b.dispatcher === "exec").slice(0, 4).map((b, i) => (
            <span key={i} className="text-[#585b70]">{b.mods}+{b.key}={b.arg.split(" ").pop()}</span>
          ))}
          <span className="text-[#585b70]">{hCfg.binds.length} binds</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-1">
          <button onClick={() => setShowRofi(!showRofi)} className="px-2 py-1 rounded text-[10px] transition-colors font-medium" style={{ backgroundColor: showRofi ? "#1e1e2e" : "#313244", color: showRofi ? "#cdd6f4" : "#a6adc8", border: `1px solid ${showRofi ? "#45475a" : "transparent"}` }}>{t("preview.rofiToggle")}</button>
          {hasMako && <button onClick={() => setShowMako(!showMako)} className="px-2 py-1 rounded text-[10px] transition-colors font-medium" style={{ backgroundColor: showMako ? "#1e1e2e" : "#313244", color: showMako ? "#cdd6f4" : "#a6adc8", border: `1px solid ${showMako ? "#45475a" : "transparent"}` }}>{t("preview.makoToggle")}</button>}
        </div>
        <div className="text-[10px] text-[#585b70]">{t("preview.clickFocus")}</div>
      </div>
    </div>
  );
}

const pluginFilePatterns: Record<string, string[]> = {
  hyprland: ["hyprland.conf", "hypr.conf"],
  waybar: ["config", "config.jsonc", "style.css"],
  kitty: ["kitty.conf"],
  alacritty: ["alacritty.toml", "alacritty.yml"],
  ghostty: ["config"],
  rofi: ["config.rasi"],
  wofi: ["config"],
  neovim: ["init.lua"], nvim: ["init.lua"],
  zsh: [".zshrc", ".zshenv"],
  fish: ["config.fish"],
  bash: [".bashrc", ".bash_profile"],
  mako: ["config"],
  dunst: ["dunstrc"],
  tmux: ["tmux.conf", ".tmux.conf"],
  btop: ["btop.conf"],
  swww: [],
  hyprpaper: ["hyprpaper.conf"],
  hyprlock: ["hyprlock.conf"],
  eww: ["eww.yuck"],
  cava: ["config"],
  starship: ["starship.toml"],
  fastfetch: ["config.jsonc"],
  foot: ["foot.ini", "foot.conf"],
  fuzzel: ["fuzzel.ini", "fuzzel.conf"],
  swaync: ["config.json", "style.css"],
  yazi: ["yazi.toml", "theme.toml", "keymap.toml"],
  wlogout: ["layout", "style.css"],
  lazygit: ["config.yml", "config.yaml"],
  bat: ["config"],
  eza: [],
  wallust: ["wallust.toml"],
};

function getPluginForFile(name: string): string | null {
  const l = name.toLowerCase();
  for (const k of Object.keys(pluginFilePatterns)) if (l.includes(k)) return k;
  return null;
}

const InfoCard = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => {
  return (
    <div className="rounded-lg p-2.5 font-mono text-[11px] bg-[#1e1e2e]">
      <div className="flex items-center gap-1.5 mb-2"><span style={{ color }} className="font-bold">{title}</span></div>
      <div className="space-y-1.5 text-[10px] text-[#a6adc8]">{children}</div>
    </div>
  );
};

const Tag = ({ color, children }: { color: string; children: React.ReactNode }) => {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#313244]" style={{ color }}>{children}</span>
  );
};

export function PreviewPanel() {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const openTabs = useAppStore((s) => s.openTabs);
  const previewOpen = useAppStore((s) => s.previewOpen);
  const togglePreview = useAppStore((s) => s.togglePreview);
  const previewWidth = useAppStore((s) => s.previewWidth);
  const setPreviewWidth = useAppStore((s) => s.setPreviewWidth);
  const dimColor = "text-muted-foreground";
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const pluginName = activeTab ? getPluginForFile(activeTab.name) : null;
  const content = activeTab?.content || "";

  const findTabContent = (plugin: string): string => {
    const tab = openTabs.find(t => getPluginForFile(t.name) === plugin);
    return tab?.content || "";
  };

  const hyprlandC = findTabContent("hyprland") || (pluginName === "hyprland" ? content : "");
  const waybarC = findTabContent("waybar") || (pluginName === "waybar" ? content : "");
  const kittyC = findTabContent("kitty") || (pluginName === "kitty" ? content : "");
  const makoC = findTabContent("mako") || (pluginName === "mako" ? content : "");
  const rofiC = findTabContent("rofi") || (pluginName === "rofi" ? content : "");
  const nvimC = findTabContent("nvim") || (pluginName === "neovim" ? content : "");
  const btopC = findTabContent("btop") || (pluginName === "btop" ? content : "");

  const showDesktop = useAppStore((s) => s.showDesktop);
  const toggleShowDesktop = useAppStore((s) => s.toggleShowDesktop);
  const fontSizeOverrides = useAppStore((s) => s.fontSizeOverrides);
  const isLinux = useAppStore((s) => s.isLinux);
  const livePlugins = useAppStore((s) => s.livePlugins);
  const startLivePreview = useAppStore((s) => s.startLivePreview);
  const stopLivePreview = useAppStore((s) => s.stopLivePreview);

  const hCfg = useMemo(() => { try { return parseHyprland(hyprlandC); } catch { return parseHyprland(""); } }, [hyprlandC]);
  const wCfg = useMemo(() => { try { return parseWaybar(waybarC); } catch { return parseWaybar(""); } }, [waybarC]);
  const kCfg = useMemo(() => { try { return parseKitty(kittyC); } catch { return parseKitty(""); } }, [kittyC]);
  const mCfg = useMemo(() => { try { return parseMako(makoC); } catch { return parseMako(""); } }, [makoC]);
  const rCfg = useMemo(() => { try { return parseRofi(rofiC); } catch { return parseRofi(""); } }, [rofiC]);
  const nCfg = useMemo(() => { try { return parseNvim(nvimC); } catch { return parseNvim(""); } }, [nvimC]);
  const bCfg = useMemo(() => { try { return parseBtop(btopC); } catch { return parseBtop(""); } }, [btopC]);

  const hasDesktop = hyprlandC.length > 0;

  const pluginReloadCommands: Record<string, string> = {
    hyprland: "hyprctl reload",
    waybar: "killall waybar && waybar",
    mako: "makoctl reload",
    dunst: "dunstctl reload",
    rofi: "",
    kitty: "killall -SIGUSR1 kitty",
    alacritty: "",
    ghostty: "",
    neovim: "", nvim: "",
    tmux: "tmux source-file ~/.tmux.conf",
    btop: "",
    hyprpaper: "hyprctl reload",
    hyprlock: "",
    swaync: "swaync-client -R",
    wallust: "wallust run <wallpaper>",
  };

  if (!previewOpen) {
    return (
      <div className="w-8 flex flex-col items-center py-2 border-l">
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={togglePreview}><Eye className="h-3.5 w-3.5 text-muted-foreground" /></Button>
        </TooltipTrigger><TooltipContent>Mostrar preview</TooltipContent></Tooltip>
      </div>
    );
  }

  const renderReloadButton = (plugin: string) => {
    const cmd = pluginReloadCommands[plugin];
    if (!cmd) return null;
    return null;
  };

  const renderPluginInfo = () => {
    if (!pluginName || !content) return null;

    if (pluginName === "hyprland") {
      const c = parseHyprland(content);
      return <InfoCard title="hyprland.conf" color="#cba6f7">
        <div className="flex justify-between"><span className={dimColor}>layout</span><span className="text-[#cdd6f4]">{c.layout}</span></div>
        {([["gaps_in", c.gapsIn+"px"], ["gaps_out", c.gapsOut+"px"], ["border_size", c.borderSize+"px"], ["rounding", c.rounding+"px"],
          ["blur", c.blurEnabled ? `on (${c.blurSize}/${c.blurPasses})` : "off"], ["animations", c.animationsEnabled ? "on" : "off"],
        ] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span className="text-[#cdd6f4]">{v}</span></div>)}
        <div className={`mt-1.5 text-[9px] ${dimColor}`}>{c.binds.length} binds | {c.execOnce.length} exec-once</div>
        {renderReloadButton("hyprland")}
      </InfoCard>;
    }
    if (pluginName === "waybar") { const c = parseWaybar(content); return <InfoCard title="waybar/config" color="#a6e3a1"><div className="flex justify-between"><span className={dimColor}>position</span><span>{c.position}</span></div><div className="flex justify-between"><span className={dimColor}>height</span><span>{c.height}px</span></div><div className={dimColor}>left: [{c.left.join(", ")}]</div><div className={dimColor}>right: [{c.right.join(", ")}]</div>{renderReloadButton("waybar")}</InfoCard>; }
    if (pluginName === "kitty") { const c = parseKitty(content); return <InfoCard title="kitty.conf" color="#cba6f7">{([["font_size", c.fontSize+""], ["bg", c.background], ["fg", c.foreground], ["opacity", c.bgOpacity+""], ["padding", c.padding+"px"]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}{renderReloadButton("kitty")}</InfoCard>; }
    if (pluginName === "alacritty") { const c = parseAlacritty(content); return <InfoCard title="alacritty.toml" color="#f38ba8">{([["font", c.fontFamily], ["size", c.fontSize+""], ["bg", c.background], ["opacity", c.opacity+""]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}</InfoCard>; }
    if (pluginName === "ghostty") { const c = parseGhostty(content); return <InfoCard title="ghostty/config" color="#89dceb">{([["font", c.fontFamily], ["size", c.fontSize+""], ["bg", c.background], ["padding_x", c.windowPaddingX+"px"]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}</InfoCard>; }
    if (pluginName === "rofi") { const c = parseRofi(content); return <InfoCard title="config.rasi" color="#fab387"><div className={dimColor}>font: {c.font}</div><div className={dimColor}>modi: {c.modi.join(", ")}</div><div className={dimColor}>icons: {c.hasIcons ? "on" : "off"}</div><div className={dimColor}>width: {c.width}px</div></InfoCard>; }
    if (pluginName === "wofi") { const c = parseWofi(content); return <InfoCard title="wofi/config" color="#fab387"><div className={dimColor}>width: {c.width}px</div><div className={dimColor}>show: {c.show}</div><div className={dimColor}>prompt: {c.prompt}</div><div className={dimColor}>images: {c.allowImages ? "on" : "off"}</div></InfoCard>; }
    if (pluginName === "neovim" || pluginName === "nvim") { const c = parseNvim(content); return <InfoCard title="init.lua" color="#f38ba8"><div className="flex flex-wrap gap-1 mb-1">{c.hasLazy && <Tag color="#cba6f7">lazy.nvim</Tag>}<Tag color="#f38ba8">{c.theme}</Tag>{c.hasTelescope && <Tag color="#89b4fa">telescope</Tag>}{c.hasTreesitter && <Tag color="#a6e3a1">treesitter</Tag>}</div><div className={`text-[9px] ${dimColor}`}>plugins={c.pluginCount}</div></InfoCard>; }
    if (pluginName === "zsh") { const c = parseZsh(content); return <InfoCard title=".zshrc" color="#f9e2af"><div className="flex flex-wrap gap-1 mb-1"><Tag color="#f9e2af">{c.theme}</Tag>{c.hasP10k && <Tag color="#cba6f7">p10k</Tag>}</div><div className={`text-[9px] ${dimColor}`}>plugins=[{c.plugins.join(", ")}]</div></InfoCard>; }
    if (pluginName === "fish") { const c = parseFish(content); return <InfoCard title="config.fish" color="#a6e3a1"><div className="flex flex-wrap gap-1 mb-1"><Tag color="#a6e3a1">{c.theme}</Tag>{c.hasFisher && <Tag color="#89b4fa">fisher</Tag>}{c.hasZoxide && <Tag color="#cba6f7">zoxide</Tag>}</div><div className={`text-[9px] ${dimColor}`}>plugins: {c.plugins.join(", ") || "none"}</div></InfoCard>; }
    if (pluginName === "bash") { const c = parseBash(content); return <InfoCard title=".bashrc" color="#a6e3a1"><div className={dimColor}>aliases: {c.aliasCount}</div><div className="flex flex-wrap gap-1 mt-1">{c.hasNvm && <Tag color="#a6e3a1">nvm</Tag>}{c.hasConda && <Tag color="#cba6f7">conda</Tag>}{c.hasPnpm && <Tag color="#f9e2af">pnpm</Tag>}{c.hasBashCompletion && <Tag color="#89b4fa">completion</Tag>}</div></InfoCard>; }
    if (pluginName === "mako") { const c = parseMako(content); return <InfoCard title="mako/config" color="#f5c2e7"><div className={dimColor}>width: {c.width}px</div><div className={dimColor}>radius: {c.borderRadius}px</div><div className={dimColor}>timeout: {c.timeout}ms</div>{renderReloadButton("mako")}</InfoCard>; }
    if (pluginName === "dunst") { const c = parseDunst(content); return <InfoCard title="dunstrc" color="#f5c2e7"><div className={dimColor}>width: {c.width}px</div><div className={dimColor}>radius: {c.cornerRadius}px</div><div className={dimColor}>padding: {c.padding}px</div><div className={dimColor}>timeout: {c.timeout}s</div>{renderReloadButton("dunst")}</InfoCard>; }
    if (pluginName === "tmux") { const c = parseTmux(content); return <InfoCard title="tmux.conf" color="#a6adc8"><div className="flex flex-wrap gap-1 mb-1"><Tag color="#a6adc8">prefix={c.prefix}</Tag>{c.hasTPM && <Tag color="#89b4fa">tpm</Tag>}{c.hasVi && <Tag color="#a6e3a1">vi</Tag>}</div><div className={`text-[9px] ${dimColor}`}>binds={c.bindCount} mouse={c.hasMouse?"on":"off"}</div>{renderReloadButton("tmux")}</InfoCard>; }
    if (pluginName === "btop") { const c = parseBtop(content); return <InfoCard title="btop.conf" color="#89dceb"><div className={dimColor}>theme: {c.theme}</div><div className={dimColor}>update: {c.updateMs}ms</div></InfoCard>; }
    if (pluginName === "swww") return <InfoCard title="swww-daemon" color="#89dceb"><div className={`text-[9px] ${dimColor}`}>Runtime only: swww img &lt;path&gt; --transition-type fade</div></InfoCard>;
    if (pluginName === "hyprpaper") { const c = parseHyprpaper(content); return <InfoCard title="hyprpaper.conf" color="#cba6f7"><div className={dimColor}>wallpaper: {c.wallpaper || "not set"}</div><div className={dimColor}>preloaded: {c.preload.length}</div><div className={dimColor}>splash: {c.splash ? "on" : "off"}</div></InfoCard>; }
    if (pluginName === "hyprlock") { const c = parseHyprlock(content); return <InfoCard title="hyprlock.conf" color="#cba6f7"><div className={dimColor}>bg: {c.bgColor}</div><div className={dimColor}>font: {c.fontFamily} {c.fontSize}px</div><div className={dimColor}>blur: {c.blurPasses} passes</div><div className={dimColor}>clock: {c.showClock ? "on" : "off"}</div></InfoCard>; }
    if (pluginName === "eww") { const c = parseEww(content); return <InfoCard title="eww.yuck" color="#f9e2af"><div className="flex flex-wrap gap-1 mb-1">{c.widgets.map(w => <Tag key={w} color="#f9e2af">{w}</Tag>)}</div><div className={`text-[9px] ${dimColor}`}>widgets={c.widgetCount} vars={c.vars.length} buttons={c.buttons}</div></InfoCard>; }
    if (pluginName === "cava") { const c = parseCava(content); return <InfoCard title="cava/config" color="#89dceb"><div className={dimColor}>method: {c.method}</div><div className={dimColor}>bars: {c.bars} (w:{c.barWidth} s:{c.barSpacing})</div><div className={dimColor}>framerate: {c.framerate}fps</div><div className={dimColor}>sensitivity: {c.sensitivity}</div></InfoCard>; }
    if (pluginName === "starship") { const c = parseStarship(content); return <InfoCard title="starship.toml" color="#f9e2af"><div className={dimColor}>modules: {c.modules}</div><div className={dimColor}>prompt: {c.promptChar}</div><div className={dimColor}>truncation: {c.directory}</div></InfoCard>; }
    if (pluginName === "fastfetch") { const c = parseFastfetch(content); return <InfoCard title="config.jsonc" color="#89dceb"><div className={dimColor}>logo: {c.logoType}</div><div className={dimColor}>modules: {c.moduleOrder.length}</div>{c.moduleOrder.length > 0 && <div className={`text-[9px] ${dimColor}`}>[{c.moduleOrder.slice(0, 6).join(", ")}{c.moduleOrder.length > 6 ? "..." : ""}]</div>}</InfoCard>; }
    if (pluginName === "foot") { const c = parseFoot(content); return <InfoCard title="foot.ini" color="#a6adc8">{([["font", c.font], ["size", c.fontSize+""], ["bg", c.background], ["fg", c.foreground], ["pad", c.pad], ["bold_is_bright", c.boldIsBright ? "yes" : "no"]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}{renderReloadButton("foot")}</InfoCard>; }
    if (pluginName === "fuzzel") { const c = parseFuzzel(content); return <InfoCard title="fuzzel.ini" color="#f9e2af">{([["font", c.font], ["size", c.fontSize+""], ["width", c.width+""], ["lines", c.lines+""], ["prompt", c.prompt]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}{renderReloadButton("fuzzel")}</InfoCard>; }
    if (pluginName === "swaync") { const c = parseSwaync(content); return <InfoCard title="swaync/config.json" color="#f5c2e7">{([["width", c.width+"px"], ["radius", c.borderRadius+"px"], ["timeout", c.timeout+"ms"], ["max_visible", c.maxVisible+""], ["position", c.positionX]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}{renderReloadButton("swaync")}</InfoCard>; }
    if (pluginName === "yazi") { const c = parseYazi(content); return <InfoCard title="yazi.toml" color="#a6e3a1">{([["sort", c.sortBy], ["hidden", c.showHidden ? "on" : "off"], ["linemode", c.linemode], ["ratio", c.ratio]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}</InfoCard>; }
    if (pluginName === "wlogout") { const c = parseWlogout(content); return <InfoCard title="wlogout/layout" color="#f38ba8"><div className={dimColor}>buttons: {c.buttons.length}</div><div className="flex flex-wrap gap-1 mt-1">{c.buttons.map(b => <Tag key={b} color="#f38ba8">{b}</Tag>)}</div></InfoCard>; }
    if (pluginName === "lazygit") { const c = parseLazygit(content); return <InfoCard title="config.yml" color="#89b4fa">{([["show_icons", c.showIcons ? "on" : "off"], ["nerd_fonts", c.nerdFontsVersion+""], ["theme", c.theme]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}{renderReloadButton("lazygit")}</InfoCard>; }
    if (pluginName === "bat") { const c = parseBat(content); return <InfoCard title="config" color="#f5c2e7">{([["theme", c.theme], ["style", c.style], ["numbers", c.numbers ? "on" : "off"], ["grid", c.grid ? "on" : "off"], ["paging", c.paging]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}</InfoCard>; }
    if (pluginName === "eza") { const c = parseEza(content); return <InfoCard title="eza alias" color="#a6e3a1">{([["icons", c.hasIcons ? "on" : "off"], ["git", c.hasGit ? "on" : "off"], ["long", c.hasLong ? "on" : "off"]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}<div className={`text-[9px] ${dimColor}`}>alias: {c.alias}</div></InfoCard>; }
    if (pluginName === "wallust") { const c = parseWallust(content); return <InfoCard title="wallust.toml" color="#cba6f7">{([["backend", c.backend], ["colorspace", c.colorspace], ["threshold", c.threshold+""], ["cache", c.cache_dir]] as [string,string][]).map(([k,v]) => <div key={k} className="flex justify-between"><span className={dimColor}>{k}</span><span>{v}</span></div>)}{renderReloadButton("wallust")}</InfoCard>; }
    return null;
  };

  return (
    <div className="relative flex flex-col border-l overflow-hidden shrink-0" style={{ width: previewWidth }}>
      <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
        onMouseDown={(e) => { e.preventDefault(); const sx = e.clientX; const sw = previewWidth; const mv = (ev: MouseEvent) => setPreviewWidth(Math.max(200, Math.min(600, sw + sx - ev.clientX))); const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up); }} />
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-medium"><Eye className="h-3.5 w-3.5 text-muted-foreground" />{t("preview.title")}</div>
        <div className="flex items-center gap-0.5">
          <Tooltip><TooltipTrigger asChild>
            <Button variant={showDesktop ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={toggleShowDesktop}><Monitor className="h-3 w-3" /></Button>
          </TooltipTrigger><TooltipContent>{t("preview.desktop")}</TooltipContent></Tooltip>
          {pluginName && livePlugins[pluginName] ? (
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                if (pluginName) await stopLivePreview(pluginName);
              }}><Square className="h-3 w-3" style={{ color: "#f38ba8" }} /></Button>
            </TooltipTrigger><TooltipContent>{t("live.stop")}</TooltipContent></Tooltip>
          ) : (
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                if (pluginName && isLinux) {
                  await startLivePreview(pluginName);
                }
              }}>
                <Play className="h-3 w-3" style={{ color: isLinux && pluginName ? "#a6e3a1" : "#585b70" }} />
              </Button>
            </TooltipTrigger><TooltipContent>{!isLinux ? t("live.notAvailable") : t("live.start")}</TooltipContent></Tooltip>
          )}
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={togglePreview}><EyeOff className="h-3 w-3" /></Button>
          </TooltipTrigger><TooltipContent>{t("preview.hide")}</TooltipContent></Tooltip>
        </div>
      </div>
      <div className="flex-1 p-2.5 overflow-auto min-h-0">
        <AnimatePresence mode="wait">
          {showDesktop ? (
            <motion.div key="desktop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-muted-foreground"><Monitor className="h-3 w-3" />{t("preview.hyprland.title")}</div>
              {livePlugins["hyprland"] ? (
                <div className="rounded-xl overflow-hidden border border-green-500/50 font-mono relative bg-[#1e1e2e] flex items-center justify-center" style={{ height: 400 }}>
                  <div className="text-green-400 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />{t("live.running")}: hyprland</div>
                </div>
              ) : hasDesktop ? <DesktopSimulation hCfg={hCfg} wCfg={wCfg} kCfg={kCfg} mCfg={mCfg} rCfg={rCfg} nCfg={nCfg} bCfg={bCfg} /> : <div className="text-[9px] text-muted-foreground text-center py-8">Open hyprland.conf to see the simulation</div>}
            </motion.div>
          ) : pluginName && content ? (
            <motion.div key={pluginName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-muted-foreground"><Zap className="h-3 w-3" />{activeTab?.name}</div>
              {livePlugins[pluginName] ? (
                <div className="rounded-xl overflow-hidden border border-green-500/50 font-mono relative bg-[#1e1e2e] flex items-center justify-center" style={{ height: 400 }}>
                  <div className="text-green-400 text-xs flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />{t("live.running")}: {pluginName}</div>
                </div>
              ) : renderPluginInfo()}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Layout className="h-8 w-8 mb-2 opacity-30" /><p className="text-xs text-center">{t("preview.openHint")}</p><p className="text-[9px] mt-1 text-center opacity-60">{t("preview.openSubhint")}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
