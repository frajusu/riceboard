import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, Circle, Scissors, Copy, ClipboardPaste, Undo2, Redo2, CheckSquare, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, Layers, FileText } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { useContextMenu } from "@/components/ui/context-menu";
import { t } from "@/lib/i18n";
import { validateConfig, type ConfigError } from "@/lib/config-validator";

const editorFontFamily = "'JetBrainsMono Nerd Font', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
const editorFontSize = 13;
const editorLineHeight = 1.6;
const editorPadding = 16;

export function detectLanguage(filename: string, fullPath?: string, content?: string): string {
  const lower = filename.toLowerCase();
  const path = (fullPath || "").toLowerCase();
  const ext = lower.split(".").pop() || "";

  // Plugin-specific detection from path
  const pluginMap: [RegExp, string][] = [
    [/hyprland/, "hyprland"],
    [/\/waybar\b|\\waybar\b|waybar\//, "waybar"],
    [/kitty/, "kitty"],
    [/rofi/, "rofi"],
    [/\/nvim\b|\\nvim\b|nvim\//, "neovim"],
    [/neovim/, "neovim"],
    [/mako/, "mako"],
    [/dunst/, "dunst"],
    [/tmux/, "tmux"],
    [/btop/, "btop"],
    [/eww/, "eww"],
    [/cava/, "cava"],
    [/starship/, "starship"],
    [/fastfetch/, "fastfetch"],
    [/\/foot\b|\\foot\b|foot\//, "foot"],
    [/fuzzel/, "fuzzel"],
    [/swaync/, "swaync"],
    [/wlogout/, "wlogout"],
    [/hyprlock/, "hyprlock"],
    [/hyprpaper/, "hyprpaper"],
    [/lazygit/, "lazygit"],
    [/\/bat\b|\\bat\b|bat\//, "bat"],
    [/eza/, "eza"],
    [/wallust/, "wallust"],
    [/swww/, "swww"],
    [/wofi/, "wofi"],
    [/ghostty/, "ghostty"],
    [/alacritty/, "alacritty"],
  ];

  for (const [re, lang] of pluginMap) {
    if (re.test(path) || re.test(lower)) return lang;
  }

  // Extension-based fallback
  const extMap: Record<string, string> = {
    json: "json",
    jsonc: "jsonc",
    toml: "toml",
    css: "css",
    lua: "lua",
    sh: "shell",
    zsh: "shell",
    bash: "shell",
    fish: "fish",
    ini: "ini",
    yuck: "eww",
    rasi: "rofi",
    conf: "hyprland",
  };

  if (ext === "conf") {
    if (lower.includes("hypr")) return "hyprland";
    return "hyprland";
  }
  if (ext === "css") {
    if (lower.includes("waybar") || path.includes("waybar")) return "waybar";
    return "css";
  }
  if (extMap[ext]) return extMap[ext];

  // Fallback by content heuristics or plugin name
  if (lower.startsWith("keybind") || lower.startsWith("binds")) return "hyprland";
  if (lower.startsWith("settings") || lower.startsWith("config")) {
    if (path.includes("kitty")) return "kitty";
    if (path.includes("alacritty")) return "alacritty";
    if (path.includes("ghostty")) return "ghostty";
    if (path.includes("tmux")) return "tmux";
    if (path.includes("btop")) return "btop";
  }
  if (lower.endsWith(".conf")) return "hyprland";
  if (lower.endsWith(".css")) return "css";

  // Content-based heuristic fallback
  if (content && content.trim().length > 0) {
    // Analyze first 20 lines to detect patterns
    const sampleLines = content.split("\n").slice(0, 20);
    const sample = sampleLines.join("\n");

    // Hyprland: lines starting with directives like "bind =", "monitor =", "general {"
    if (/^(bind|monitor|workspace|general|decoration|animations|input|misc)\s*[={]/m.test(sample)) return "hyprland";

    // JSON: starts with { or [
    if (/^\s*[\[{]/.test(sample)) {
      if (/\/\//.test(sample) || /\/\*/.test(sample)) return "jsonc";
      return "json";
    }

    // TOML: has [section] headers and key = value
    if (/^\[[\w.]+\]/m.test(sample) && /^[\w.-]+\s*=/m.test(sample)) return "toml";

    // CSS: has selectors with {} and properties with :
    if (/\{[\s\S]*?[\w-]+\s*:/m.test(sample) && /\}/.test(sample)) return "css";

    // Lua: has "local", "function", "end", "require"
    if (/\b(local|function|end|require)\b/.test(sample) && /\bend\b/.test(sample)) return "lua";

    // Shell: has #!/bin/bash, alias, export, function keywords
    if (/^#!/m.test(sample) || /\b(alias|export|source)\b/.test(sample)) return "shell";

    // Fish: has "set", "function ... end"
    if (/^\s*set\s+/m.test(sample) || /\bfunction\b.*\bend\b/s.test(sample)) return "fish";

    // INI: has [section] and key=value
    if (/^\[[\w]+\]/m.test(sample) && /^[\w]+\s*=/m.test(sample)) return "ini";

    // Eww (.yuck): has (defwindow, (defwidget, (box, (label
    if (/\(def(window|widget|var|listen)\b/.test(sample) || /\((box|label|button|eventbox)\b/.test(sample)) return "eww";

    // Rofi (.rasi): has configuration { and window { and property: value;
    if (/configuration\s*\{/m.test(sample) || /window\s*\{/m.test(sample)) return "rofi";

    // Key-value: has key = value or key: value patterns
    if (/^[\w.-]+\s*[=:]\s*\S/m.test(sample)) return "keyvalue";
  }

  return "text";
}

// Catppuccin Mocha palette
const C = {
  comment:    "#6c7086",
  keyword:    "#cba6f7",
  string:     "#a6e3a1",
  number:     "#fab387",
  color:      "#89b4fa",
  text:       "#cdd6f4",
  operator:   "#89dceb",
  section:    "#f9e2af",
  boolean:    "#f38ba8",
  property:   "#89b4fa",
  function:   "#89b4fa",
  variable:   "#f38ba8",
  default:    "#cdd6f4",
} as const;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type TokenType = "comment" | "keyword" | "string" | "number" | "color" | "section" | "boolean" | "property" | "variable" | "operator" | "function" | "default";

function span(token: string, type: TokenType): React.ReactNode {
  if (type === "default") return esc(token);
  const styles: Record<TokenType, React.CSSProperties> = {
    comment:  { color: C.comment, fontStyle: "italic" },
    keyword:  { color: C.keyword },
    string:   { color: C.string },
    number:   { color: C.number },
    color:    { color: C.color },
    section:  { color: C.section, fontWeight: 600 },
    boolean:  { color: C.boolean },
    property: { color: C.property },
    variable: { color: C.variable },
    operator: { color: C.operator },
    function: { color: C.function },
    default:  { color: C.default },
  };
  return <span key={`t${++span._i}`} style={styles[type]}>{esc(token)}</span>;
}
span._i = 0;

function spanHTML(token: string, type: TokenType): string {
  if (type === "default") return esc(token);
  const styles: Record<TokenType, string> = {
    comment: `color:${C.comment};font-style:italic`,
    keyword: `color:${C.keyword}`,
    string: `color:${C.string}`,
    number: `color:${C.number}`,
    color: `color:${C.color}`,
    section: `color:${C.section};font-weight:600`,
    boolean: `color:${C.boolean}`,
    property: `color:${C.property}`,
    variable: `color:${C.variable}`,
    operator: `color:${C.operator}`,
    function: `color:${C.function}`,
    default: `color:${C.default}`,
  };
  return `<span style="${styles[type]}">${esc(token)}</span>`;
}

function highlightSyntax(code: string, language: string): string {
  span._i = 0;

  const lines = code.split("\n");

  let inBlockComment = false;
  let inLuaLongString = false;

  const lineMinHeight = `${editorFontSize * editorLineHeight}px`;
  const lineLH = `${editorLineHeight}`;

  const divs = lines.map((line, lineIdx) => {
    let parts = "";

    switch (language) {
      case "hyprland":
        parts = highlightHyprland(line);
        break;
      case "json":
      case "jsonc":
        parts = highlightJSON(line, language === "jsonc");
        break;
      case "toml":
        parts = highlightTOML(line);
        break;
      case "css":
        parts = highlightCSS(line);
        break;
      case "waybar":
        parts = highlightCSS(line);
        break;
      case "lua":
        { const r = highlightLua(line, inBlockComment, inLuaLongString); parts = r.parts; inBlockComment = r.inBlock; inLuaLongString = r.inLong; break; }
      case "shell":
        parts = highlightShell(line);
        break;
      case "fish":
        parts = highlightFish(line);
        break;
      case "ini":
        parts = highlightINI(line);
        break;
      case "mako":
      case "btop":
      case "cava":
      case "wofi":
      case "hyprpaper":
      case "bat":
      case "kitty":
      case "alacritty":
      case "ghostty":
      case "eza":
        parts = highlightKeyValue(line);
        break;
      case "eww":
        parts = highlightEww(line);
        break;
      case "rofi":
        parts = highlightRofi(line);
        break;
      case "tmux":
        parts = highlightTmux(line);
        break;
      case "dunst":
        parts = highlightDunst(line);
        break;
      case "fastfetch":
      case "starship":
      case "lazygit":
      case "wallust":
      case "swww":
      case "swaync":
      case "wlogout":
      case "hyprlock":
      case "fuzzel":
      case "foot":
        parts = highlightKeyValue(line);
        break;
      default:
        parts = esc(line);
    }

    const content = parts.length > 0 ? parts : "\u00A0";
    return `<div style="min-height:${lineMinHeight};line-height:${lineLH}">${content}</div>`;
  });

  return divs.join("");
}

function highlightHyprland(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Full-line comment
  if (trimmed.startsWith("#")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Section headers like $ENV = value
  if (trimmed.startsWith("$")) {
    const m = trimmed.match(/^(\$[A-Za-z0-9_]+)\s*(=)(.*)/);
    if (m) {
      parts.push(spanHTML(m[1], "variable"));
      parts.push(spanHTML(m[2], "operator"));
      if (m[3].trim().startsWith("#") || m[3].trim().startsWith('"')) {
        parts.push(spanHTML(m[3], "string"));
      } else {
        parts.push(highlightMixedValues(m[3]));
      }
      return parts.join("");
    }
  }

  // Directive: first word
  const dirMatch = trimmed.match(/^([a-zA-Z_][\w-]*)/);
  if (dirMatch) {
    parts.push(spanHTML(dirMatch[1], "keyword"));
    let rest = trimmed.substring(dirMatch[1].length);

    // Inline comment
    const hashIdx = rest.indexOf("#");
    let codePart = rest;
    let commentPart = "";
    if (hashIdx >= 0) {
      const beforeHash = rest.substring(0, hashIdx);
      if (hashIdx === 0 || beforeHash.endsWith(" ")) {
        codePart = rest.substring(0, hashIdx);
        commentPart = rest.substring(hashIdx);
      }
    }

    // Highlight the value portion
    if (codePart.length > 0) {
      parts.push(highlightMixedValues(codePart));
    }
    if (commentPart) {
      parts.push(spanHTML(commentPart, "comment"));
    }
  } else {
    parts.push(esc(trimmed));
  }

  return parts.join("");
}

function highlightMixedValues(text: string): string {
  const parts: string[] = [];
  let rem = text;

  while (rem.length > 0) {
    let matched = false;

    // Strings
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(spanHTML(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      matched = true;
      continue;
    }

    // Colors
    const colM = rem.match(/^#[0-9a-fA-F]{3,8}\b/);
    if (colM && colM.index === 0) {
      parts.push(spanHTML(colM[0], "color"));
      rem = rem.substring(colM[0].length);
      matched = true;
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      matched = true;
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false|yes|no|on|off)\b/i);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      matched = true;
      continue;
    }

    // Variables
    const varM = rem.match(/^(\$[A-Za-z0-9_]+)/);
    if (varM && varM.index === 0) {
      parts.push(spanHTML(varM[0], "variable"));
      rem = rem.substring(varM[0].length);
      matched = true;
      continue;
    }

    if (!matched) {
      parts.push(esc(rem[0]));
      rem = rem.substring(1);
    }
  }

  return parts.join("");
}

function highlightJSON(line: string, isJsonc: boolean): string {
  const parts: string[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Line comment (JSONC only)
    if (isJsonc && rem.startsWith("//")) {
      parts.push(spanHTML(rem, "comment"));
      break;
    }

    // Block comment start (JSONC only)
    if (isJsonc && rem.startsWith("/*")) {
      const endIdx = rem.indexOf("*/", 2);
      if (endIdx >= 0) {
        parts.push(spanHTML(rem.substring(0, endIdx + 2), "comment"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(spanHTML(rem, "comment"));
        break;
      }
      continue;
    }

    // Strings
    const strM = rem.match(/^("(?:[^"\\]|\\.)*")/);
    if (strM && strM.index === 0) {
      const fullStr = strM[0];
      const afterStr = rem.substring(fullStr.length).trimStart();
      if (afterStr.startsWith(":")) {
        parts.push(spanHTML(fullStr, "property"));
      } else {
        parts.push(spanHTML(fullStr, "string"));
      }
      rem = rem.substring(fullStr.length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Booleans / null
    const boolM = rem.match(/^(true|false|null)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators/separators
    const opM = rem.match(/^([{}[\]:,])/);
    if (opM && opM.index === 0) {
      parts.push(spanHTML(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Plain text
    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightTOML(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith("#")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Table header [section]
  const tblM = trimmed.match(/^(\[[\w.-]+\])/);
  if (tblM && tblM.index === 0) {
    parts.push(spanHTML(tblM[0], "section"));
    const after = trimmed.substring(tblM[0].length);
    if (after.trimStart().startsWith("#")) {
      const space = after.substring(0, after.indexOf("#"));
      parts.push(esc(space));
      parts.push(spanHTML(after.substring(after.indexOf("#")), "comment"));
    } else if (after.trim().length > 0) {
      parts.push(esc(after));
    }
    return parts.join("");
  }

  // Array of tables [[section]]
  const arrTblM = trimmed.match(/^(\[\[[\w.-]+\]\])/);
  if (arrTblM && arrTblM.index === 0) {
    parts.push(spanHTML(arrTblM[0], "section"));
    return parts.join("");
  }

  // Key = value
  const kvM = trimmed.match(/^([\w.-]+)\s*(=)/);
  if (kvM && kvM.index === 0) {
    parts.push(spanHTML(kvM[1], "property"));
    parts.push(spanHTML(kvM[2], "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Check for comment
    const commentIdx = val.indexOf("#");
    let valPart = val;
    let commentPart = "";
    if (commentIdx >= 0 && !val.trimStart().startsWith('"') && !val.trimStart().startsWith("'")) {
      valPart = val.substring(0, commentIdx);
      commentPart = val.substring(commentIdx);
    }

    parts.push(highlightTomlValue(valPart));
    if (commentPart) parts.push(spanHTML(commentPart, "comment"));
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function highlightTomlValue(text: string): string {
  const parts: string[] = [];
  let rem = text;

  while (rem.length > 0) {
    // Strings
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(spanHTML(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    // Dates (YYYY-MM-DD or datetime)
    const dateM = rem.match(/^(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?)/);
    if (dateM && dateM.index === 0) {
      parts.push(spanHTML(dateM[0], "number"));
      rem = rem.substring(dateM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightCSS(line: string): string {
  const parts: string[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Block comment
    if (rem.startsWith("/*")) {
      const endIdx = rem.indexOf("*/", 2);
      if (endIdx >= 0) {
        parts.push(spanHTML(rem.substring(0, endIdx + 2), "comment"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(spanHTML(rem, "comment"));
        break;
      }
      continue;
    }

    // Line comment
    if (rem.startsWith("//")) {
      parts.push(spanHTML(rem, "comment"));
      break;
    }

    // Strings
    const strM = rem.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
    if (strM && strM.index === 0) {
      parts.push(spanHTML(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    // Hex colors
    const colM = rem.match(/^#[0-9a-fA-F]{3,8}\b/);
    if (colM && colM.index === 0) {
      parts.push(spanHTML(colM[0], "color"));
      rem = rem.substring(colM[0].length);
      continue;
    }

    // Numbers with units
    const numM = rem.match(/^(-?\d+\.?\d*)(px|em|rem|%|vh|vw|vmin|vmax|deg|rad|turn|s|ms|fr|ch|ex)?\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // At-rules
    const atM = rem.match(/^(@\w+)/);
    if (atM && atM.index === 0) {
      parts.push(spanHTML(atM[0], "keyword"));
      rem = rem.substring(atM[0].length);
      continue;
    }

    // Known CSS property names (before colon)
    const propM = rem.match(/^([\w-]+)\s*(?=:)/);
    if (propM && propM.index === 0) {
      parts.push(spanHTML(propM[0], "property"));
      rem = rem.substring(propM[0].length);
      continue;
    }

    // Keywords / pseudo-classes
    const kwM = rem.match(/^(important|inherit|initial|unset|none|auto|flex|grid|block|inline|absolute|relative|fixed|sticky)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(spanHTML(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators / punctuation
    const opM = rem.match(/^([{}:;,>+~[\]()])/);
    if (opM && opM.index === 0) {
      parts.push(spanHTML(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Identifiers (selectors, class names, etc.)
    const idM = rem.match(/^(.[\w-]*)/);
    if (idM && idM.index === 0) {
      parts.push(`<span style="color:${C.text}">${esc(idM[0])}</span>`);
      rem = rem.substring(idM[0].length);
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightLua(
  line: string,
  inBlockComment: boolean,
  inLongString: boolean
): { parts: string; inBlock: boolean; inLong: boolean } {
  const parts: string[] = [];
  let rem = line;

  if (inBlockComment) {
    const endIdx = rem.indexOf("]]");
    if (endIdx >= 0) {
      parts.push(spanHTML(rem.substring(0, endIdx + 2), "comment"));
      rem = rem.substring(endIdx + 2);
      inBlockComment = false;
    } else {
      parts.push(spanHTML(line, "comment"));
      return { parts: parts.join(""), inBlock: true, inLong: false };
    }
  }

  if (inLongString) {
    const endIdx = rem.indexOf("]]");
    if (endIdx >= 0) {
      parts.push(spanHTML(rem.substring(0, endIdx + 2), "string"));
      rem = rem.substring(endIdx + 2);
      inLongString = false;
    } else {
      parts.push(spanHTML(line, "string"));
      return { parts: parts.join(""), inBlock: false, inLong: true };
    }
  }

  while (rem.length > 0) {
    // Block comment
    if (rem.startsWith("--[[")) {
      const endIdx = rem.indexOf("]]", 4);
      if (endIdx >= 0) {
        parts.push(spanHTML(rem.substring(0, endIdx + 2), "comment"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(spanHTML(rem, "comment"));
        rem = "";
        inBlockComment = true;
      }
      continue;
    }

    // Line comment
    if (rem.startsWith("--")) {
      parts.push(spanHTML(rem, "comment"));
      break;
    }

    // Long string [[ ]]
    if (rem.startsWith("[[")) {
      const endIdx = rem.indexOf("]]", 2);
      if (endIdx >= 0) {
        parts.push(spanHTML(rem.substring(0, endIdx + 2), "string"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(spanHTML(rem, "string"));
        rem = "";
        inLongString = true;
      }
      continue;
    }

    // Strings
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(spanHTML(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Booleans / nil
    const boolM = rem.match(/^(true|false|nil)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Keywords
    const kwM = rem.match(/^(local|function|end|if|then|else|elseif|for|while|do|return|require|and|or|not|repeat|until|goto)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(spanHTML(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Function call: name(
    const fnM = rem.match(/^([\w.]+)\s*(\()/);
    if (fnM && fnM.index === 0) {
      parts.push(spanHTML(fnM[1], "function"));
      parts.push(spanHTML(fnM[2], "operator"));
      rem = rem.substring(fnM[0].length);
      continue;
    }

    // Variables
    const varM = rem.match(/^([\w]+)/);
    if (varM && varM.index === 0) {
      parts.push(`<span style="color:${C.text}">${esc(varM[0])}</span>`);
      rem = rem.substring(varM[0].length);
      continue;
    }

    // Operators
    const opM = rem.match(/^([{}[\]();,.<>=+\-*/%^#])/);
    if (opM && opM.index === 0) {
      parts.push(spanHTML(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return { parts: parts.join(""), inBlock: inBlockComment, inLong: inLongString };
}

function highlightShell(line: string): string {
  const parts: string[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Comment
    if (rem.startsWith("#")) {
      parts.push(spanHTML(rem, "comment"));
      break;
    }

    // Double-quoted string with variable expansion
    const dqM = rem.match(/^"((?:[^"\\$]|\\.)*)"/);
    if (dqM && dqM.index === 0) {
      parts.push(spanHTML(`"${dqM[1]}"`, "string"));
      rem = rem.substring(dqM[0].length);
      continue;
    }

    // Single-quoted string
    const sqM = rem.match(/^'([^']*)'/);
    if (sqM && sqM.index === 0) {
      parts.push(spanHTML(sqM[0], "string"));
      rem = rem.substring(sqM[0].length);
      continue;
    }

    // Variables
    const varM = rem.match(/^(\$[\w@?${}!]|(\$\{[^}]+\})|(\$[A-Za-z_][A-Za-z0-9_]*))/);
    if (varM && varM.index === 0) {
      parts.push(spanHTML(varM[0], "variable"));
      rem = rem.substring(varM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Keywords
    const kwM = rem.match(/^(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|export|source|local|readonly|declare|select|until|in|shift|trap|eval|exec)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(spanHTML(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators
    const opM = rem.match(/^([|&;><]+|[\[\](){}$`])/);
    if (opM && opM.index === 0) {
      parts.push(spanHTML(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Commands (first word on a line or after pipe/semicolon)
    const cmdM = rem.match(/^([a-zA-Z_][\w-]*)/);
    if (cmdM && cmdM.index === 0) {
      parts.push(spanHTML(cmdM[0], "function"));
      rem = rem.substring(cmdM[0].length);
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightFish(line: string): string {
  const parts: string[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Comment
    if (rem.startsWith("#")) {
      parts.push(spanHTML(rem, "comment"));
      break;
    }

    // Double-quoted string
    const dqM = rem.match(/^"((?:[^"\\]|\\.)*)"/);
    if (dqM && dqM.index === 0) {
      parts.push(spanHTML(`"${dqM[1]}"`, "string"));
      rem = rem.substring(dqM[0].length);
      continue;
    }

    // Single-quoted string
    const sqM = rem.match(/^'([^']*)'/);
    if (sqM && sqM.index === 0) {
      parts.push(spanHTML(sqM[0], "string"));
      rem = rem.substring(sqM[0].length);
      continue;
    }

    // Variables
    const varM = rem.match(/^(\$(?:\{[^}]+\}|[A-Za-z0-9_]+))/);
    if (varM && varM.index === 0) {
      parts.push(spanHTML(varM[0], "variable"));
      rem = rem.substring(varM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Keywords
    const kwM = rem.match(/^(if|else|end|for|while|function|return|set|export|source|alias|in|break|continue|switch|case|begin|and|or|not|do|done)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(spanHTML(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false|yes|no|0|1)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators
    const opM = rem.match(/^([|&;><\[\](){}])/);
    if (opM && opM.index === 0) {
      parts.push(spanHTML(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Commands
    const cmdM = rem.match(/^([a-zA-Z_][\w-]*)/);
    if (cmdM && cmdM.index === 0) {
      parts.push(spanHTML(cmdM[0], "function"));
      rem = rem.substring(cmdM[0].length);
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightINI(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Section header
  const secM = trimmed.match(/^(\[[\w.-]+\])/);
  if (secM && secM.index === 0) {
    parts.push(spanHTML(secM[0], "section"));
    const rest = trimmed.substring(secM[0].length);
    if (rest.trimStart().startsWith("#") || rest.trimStart().startsWith(";")) {
      const spaceIdx = rest.search(/[#;]/);
      parts.push(esc(rest.substring(0, spaceIdx)));
      parts.push(spanHTML(rest.substring(spaceIdx), "comment"));
    } else if (rest.trim().length > 0) {
      parts.push(esc(rest));
    }
    return parts.join("");
  }

  // Key = value
  const kvM = trimmed.match(/^([\w.-]+)\s*([=:\s])/);
  if (kvM && kvM.index === 0) {
    parts.push(spanHTML(kvM[1], "property"));
    parts.push(spanHTML(kvM[2], "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Comment
    const commentIdx = findIniComment(val);
    if (commentIdx >= 0) {
      const valPart = val.substring(0, commentIdx);
      const commentPart = val.substring(commentIdx);
      if (valPart.trim().length > 0) parts.push(highlightIniValue(valPart));
      parts.push(spanHTML(commentPart, "comment"));
    } else {
      parts.push(highlightIniValue(val));
    }
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function findIniComment(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "#" || text[i] === ";") return i;
  }
  return -1;
}

function highlightIniValue(text: string): string {
  const parts: string[] = [];
  let rem = text;

  while (rem.length > 0) {
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(spanHTML(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    const colM = rem.match(/^#[0-9a-fA-F]{3,8}\b/);
    if (colM && colM.index === 0) {
      parts.push(spanHTML(colM[0], "color"));
      rem = rem.substring(colM[0].length);
      continue;
    }

    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(spanHTML(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    const boolM = rem.match(/^(true|false|yes|no|on|off)\b/i);
    if (boolM && boolM.index === 0) {
      parts.push(spanHTML(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightKeyValue(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith("#")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Key = value or Key: value
  const kvM = trimmed.match(/^([\w./-]+)\s*([=:])\s*/);
  if (kvM && kvM.index === 0) {
    parts.push(spanHTML(kvM[1], "property"));
    parts.push(spanHTML(kvM[2], "operator"));
    const val = trimmed.substring(kvM[0].length);
    parts.push(highlightIniValue(val));
    return parts.join("");
  }

  // Section-like headers
  const secM = trimmed.match(/^(\[[\w.-]+\])/);
  if (secM && secM.index === 0) {
    parts.push(spanHTML(secM[0], "section"));
    const rest = trimmed.substring(secM[0].length);
    if (rest.trim().length > 0) parts.push(esc(rest));
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function highlightEww(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith(";")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Keywords
  const kwM = trimmed.match(/^(defwindow|defwidget|defvar|deflisten|include)\b/);
  if (kwM && kwM.index === 0) {
    parts.push(spanHTML(kwM[0], "keyword"));
    const rest = trimmed.substring(kwM[0].length);
    parts.push(esc(rest.substring(0, Math.min(rest.length, 1))));

    // Widget name
    const nameM = rest.trimStart().match(/^([\w-]+)/);
    if (nameM) {
      parts.push(spanHTML(nameM[1], "function"));
      const after = rest.substring(rest.indexOf(nameM[1]) + nameM[1].length);
      parts.push(highlightEwwRest(after));
      return parts.join("");
    }
    return parts.join("");
  }

  // Built-in widgets
  const bldM = trimmed.match(/^(box|label|button|input|image|scale|eventbox|overlay|scroll|centerbox|expander|tooltip|window|fixed)\b/);
  if (bldM && bldM.index === 0) {
    parts.push(spanHTML(bldM[0], "section"));
    const rest = trimmed.substring(bldM[0].length);
    parts.push(highlightEwwRest(rest));
    return parts.join("");
  }

  // Properties
  const propM = trimmed.match(/^([\w-]+)\s*(:)/);
  if (propM && propM.index === 0) {
    parts.push(spanHTML(propM[1], "property"));
    parts.push(spanHTML(propM[2], "operator"));
    const val = trimmed.substring(propM[0].length);
    parts.push(highlightIniValue(val));
    return parts.join("");
  }

  // Keywords: true/false
  const boolM = trimmed.match(/^(true|false)\b/);
  if (boolM && boolM.index === 0) {
    parts.push(spanHTML(boolM[0], "boolean"));
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function highlightEwwRest(text: string): string {
  const parts: string[] = [];
  let rem = text;

  while (rem.length > 0) {
    if (rem.startsWith(";")) {
      parts.push(spanHTML(rem, "comment"));
      break;
    }

    const propM = rem.match(/^([\w-]+)\s*(:)/);
    if (propM && propM.index === 0) {
      parts.push(spanHTML(propM[1], "property"));
      parts.push(spanHTML(propM[2], "operator"));
      const rest = rem.substring(propM[0].length);
      const nextProp = rest.search(/[\s]+[\w-]+\s*:/);
      if (nextProp >= 0) {
        parts.push(highlightIniValue(rest.substring(0, nextProp)));
        rem = rest.substring(nextProp);
      } else {
        parts.push(highlightIniValue(rest));
        break;
      }
      continue;
    }

    parts.push(esc(rem[0]));
    rem = rem.substring(1);
  }

  return parts.join("");
}

function highlightRofi(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith("//")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Section header: * { ... } or window { }
  const secM = trimmed.match(/^([\w.*]+)\s*\{/);
  if (secM && secM.index === 0) {
    parts.push(spanHTML(secM[1], "section"));
    parts.push(spanHTML(" {", "operator"));
    return parts.join("");
  }

  // Closing brace
  if (trimmed.startsWith("}")) {
    parts.push(spanHTML("}", "operator"));
    return parts.join("");
  }

  // Property: value
  const kvM = trimmed.match(/^([\w-]+)\s*:\s*/);
  if (kvM && kvM.index === 0) {
    parts.push(spanHTML(kvM[1], "property"));
    parts.push(spanHTML(":", "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Colors
    const colM = val.match(/^(#[0-9a-fA-F]{3,8})/);
    if (colM) {
      parts.push(spanHTML(colM[0], "color"));
      const rest = val.substring(colM[0].length);
      if (rest.trim().length > 0) parts.push(esc(rest));
      return parts.join("");
    }

    parts.push(highlightIniValue(val));
    return parts.join("");
  }

  // Keywords
  const kwM = trimmed.match(/^(configuration|theme|import|window)\b/);
  if (kwM && kwM.index === 0) {
    parts.push(spanHTML(kwM[0], "keyword"));
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function highlightTmux(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith("#")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // set-option / set / unbind / bind
  const kwM = trimmed.match(/^(set|set-option|set-window-option|unbind|bind|bind-key|unbind-key|source|run|if|new-session|new-window|split-window|select-window|set-hook|display-message)\b/);
  if (kwM && kwM.index === 0) {
    parts.push(spanHTML(kwM[0], "keyword"));
    const rest = trimmed.substring(kwM[0].length);
    parts.push(highlightIniValue(rest));
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function highlightDunst(line: string): string {
  const parts: string[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(esc(line.substring(0, indent)));

  // Comment
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
    parts.push(spanHTML(line.substring(indent), "comment"));
    return parts.join("");
  }

  // Section header
  const secM = trimmed.match(/^(\[[\w.]+\])/);
  if (secM && secM.index === 0) {
    parts.push(spanHTML(secM[0], "section"));
    const rest = trimmed.substring(secM[0].length);
    if (rest.trim().length > 0) parts.push(esc(rest));
    return parts.join("");
  }

  // Key = value
  const kvM = trimmed.match(/^([\w_]+)\s*=\s*/);
  if (kvM && kvM.index === 0) {
    parts.push(spanHTML(kvM[1], "property"));
    parts.push(spanHTML("=", "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Colors
    const colM = val.match(/^(#[0-9a-fA-F]{3,8})/);
    if (colM) {
      parts.push(spanHTML(colM[0], "color"));
      const rest = val.substring(colM[0].length);
      if (rest.trim().length > 0) parts.push(esc(rest));
      return parts.join("");
    }

    parts.push(highlightIniValue(val));
    return parts.join("");
  }

  parts.push(esc(trimmed));
  return parts.join("");
}

function getTabIcon(plugin: string): React.ReactNode {
  const colorMap: Record<string, string> = {
    hyprland: "text-blue-400", waybar: "text-green-400", kitty: "text-purple-400",
    alacritty: "text-red-400", ghostty: "text-pink-400", foot: "text-teal-400",
    neovim: "text-emerald-400", nvim: "text-emerald-400", zsh: "text-yellow-400", fish: "text-cyan-400",
    bash: "text-orange-400", rofi: "text-orange-400", wofi: "text-pink-400",
    fuzzel: "text-amber-400", swww: "text-indigo-400", hyprpaper: "text-indigo-400",
    eww: "text-teal-400", mako: "text-rose-400", dunst: "text-amber-400", swaync: "text-violet-400",
    tmux: "text-lime-400", btop: "text-sky-400", hyprlock: "text-slate-400", cava: "text-fuchsia-400",
    starship: "text-cyan-400", yazi: "text-emerald-400", wlogout: "text-red-300", lazygit: "text-yellow-200",
    bat: "text-green-300", eza: "text-blue-300", wallust: "text-purple-300",
    json: "text-yellow-300", jsonc: "text-yellow-300", toml: "text-sky-300",
    css: "text-blue-300", lua: "text-blue-400", shell: "text-green-300",
    ini: "text-slate-300", text: "text-muted-foreground",
  };
  const color = colorMap[plugin];
  if (color) {
    return <Layers className={`h-3.5 w-3.5 ${color}`} />;
  }
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function CodeEditor() {
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const closeTab = useAppStore((s) => s.closeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const reorderOpenTabs = useAppStore((s) => s.reorderOpenTabs);
  const saveCurrentFile = useAppStore((s) => s.saveCurrentFile);
  const containerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const { showMenu, MenuPortal } = useContextMenu();
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [errors, setErrors] = useState<ConfigError[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const handleScroll = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = el.scrollTop;
    }
  }, []);

  // Reset scroll on tab change
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = 0;
    if (lineNumRef.current) lineNumRef.current.scrollTop = 0;
    setErrors([]);
    setProblemsOpen(false);
    setHoveredLine(null);
  }, [activeTabId]);

  const language = activeTab ? detectLanguage(activeTab.name, activeTab.path, activeTab.content) : "text";
  const highlightedHTML = activeTab ? highlightSyntax(activeTab.content, language) : "";

  // Sync content from store to pre element when content changes externally
  useEffect(() => {
    const el = preRef.current;
    if (!el || !activeTab || syncingRef.current) return;
    const currentText = el.textContent || "";
    if (currentText !== activeTab.content) {
      syncingRef.current = true;
      el.innerHTML = highlightedHTML;
      syncingRef.current = false;
    }
  }, [activeTab?.content, highlightedHTML]);

  // Debounced validation
  useEffect(() => {
    if (!activeTab) return;
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      const result = validateConfig(activeTab.name, activeTab.content, activeTab.path);
      setErrors(result);
    }, 300);
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, [activeTab?.content, activeTab?.name]);

  const errorLines = useMemo(() => {
    const map = new Map<number, ConfigError[]>();
    for (const err of errors) {
      const existing = map.get(err.line) || [];
      existing.push(err);
      map.set(err.line, existing);
    }
    return map;
  }, [errors]);

  const getTextFromPre = useCallback((el: HTMLElement): string => {
    let text = "";
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName;
        if (tag === "BR") {
          text += "\n";
        } else {
          for (const child of Array.from(node.childNodes)) walk(child);
          if (tag === "DIV" || tag === "P") {
            if (text[text.length - 1] !== "\n") text += "\n";
          }
        }
      }
    };
    for (const child of Array.from(el.childNodes)) walk(child);
    return text;
  }, []);

  const handleInput = useCallback(() => {
    const el = preRef.current;
    if (!el || !activeTab) return;
    if (syncingRef.current) return;
    const text = getTextFromPre(el);
    syncingRef.current = true;
    updateTabContent(activeTab.id, text);
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [activeTab?.id, updateTabContent, getTextFromPre]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveCurrentFile();
      return;
    }
    const el = preRef.current;
    if (!el) return;

    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const selRange = sel.getRangeAt(0);
      selRange.deleteContents();
      const preRange = document.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(selRange.startContainer, selRange.startOffset);
      const pos = preRange.toString().length;
      const text = el.textContent || "";
      const beforeLines = text.substring(0, pos).split("\n");
      const currentLine = beforeLines[beforeLines.length - 1] || "";
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : "";
      document.execCommand("insertText", false, "\n" + indent);
      return;
    }
  }, [saveCurrentFile]);

  const setCursorPosition = useCallback((line: number, col: number) => {
    const el = preRef.current;
    if (!el) return;
    const text = el.textContent || "";
    let pos = 0;
    const lines = text.split("\n");
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }
    pos += col;

    const range = document.createRange();
    const sel = window.getSelection();
    let currentPos = 0;
    const walk = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent?.length || 0;
        if (currentPos + len >= pos) {
          range.setStart(node, pos - currentPos);
          range.collapse(true);
          return true;
        }
        currentPos += len;
      } else {
        for (const child of Array.from(node.childNodes)) {
          if (walk(child)) return true;
        }
      }
      return false;
    };
    walk(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = preRef.current;
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed;
    const items = [
      { label: t("editor.contextMenu.undo"), icon: <Undo2 className="h-4 w-4" />, shortcut: "Ctrl+Z", onClick: () => { el?.focus(); document.execCommand("undo"); } },
      { label: t("editor.contextMenu.redo"), icon: <Redo2 className="h-4 w-4" />, shortcut: "Ctrl+Y", onClick: () => { el?.focus(); document.execCommand("redo"); } },
      { divider: true, label: "" },
      { label: t("editor.contextMenu.cut"), icon: <Scissors className="h-4 w-4" />, shortcut: "Ctrl+X", disabled: !hasSelection, onClick: () => { el?.focus(); document.execCommand("cut"); } },
      { label: t("editor.contextMenu.copy"), icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl+C", disabled: !hasSelection, onClick: () => { el?.focus(); document.execCommand("copy"); } },
      { label: t("editor.contextMenu.paste"), icon: <ClipboardPaste className="h-4 w-4" />, shortcut: "Ctrl+V", onClick: () => { el?.focus(); document.execCommand("paste"); } },
      { divider: true, label: "" },
      { label: t("editor.contextMenu.selectAll"), icon: <CheckSquare className="h-4 w-4" />, shortcut: "Ctrl+A", onClick: () => { el?.focus(); document.execCommand("selectAll"); } },
    ];
    showMenu(e, items);
  }, [showMenu]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <span className="text-2xl font-bold bg-gradient-to-br from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">R</span>
          </div>
          <h2 className="text-lg font-semibold mb-1">{t("editor.empty.title")}</h2>
          <p className="text-sm">{t("editor.empty.hint")}</p>
          <p className="text-xs mt-2 text-muted-foreground/60">{t("editor.empty.shortcut")}</p>
        </div>
      </div>
    );
  }

  const lines = activeTab.content.split("\n");
  const lineCount = lines.length;
  const lineNumWidth = Math.max(40, String(lineCount).length * 9 + 24);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-stretch border-b bg-card/50 overflow-x-auto shrink-0" style={{ minHeight: 40 }}>
        {openTabs.map((tab, idx) => {
          const tabLang = detectLanguage(tab.name, tab.path);
          const isActive = tab.id === activeTabId;
          const isDragOver = dragOverIdx === idx;
          return (
            <div key={tab.id}
              draggable="true"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(idx));
                dragIndexRef.current = idx;
                // Create a small drag image
                const ghost = document.createElement("div");
                ghost.textContent = tab.name;
                ghost.style.cssText = "position:absolute;top:-1000px;left:-1000px;padding:4px 8px;background:#1e1e2e;color:#cdd6f4;border-radius:6px;font-size:12px;pointer-events:none;";
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 0, 0);
                requestAnimationFrame(() => ghost.remove());
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                dragOverIndexRef.current = idx;
                setDragOverIdx(idx);
              }}
              onDragLeave={() => {
                dragOverIndexRef.current = null;
                setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndexRef.current;
                const to = dragOverIndexRef.current;
                if (from !== null && to !== null && from !== to) {
                  reorderOpenTabs(from, to);
                }
                dragIndexRef.current = null;
                dragOverIndexRef.current = null;
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                dragIndexRef.current = null;
                dragOverIndexRef.current = null;
                setDragOverIdx(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 border-r cursor-pointer text-sm whitespace-nowrap group transition-colors select-none
                ${isActive
                  ? "bg-background text-foreground border-b-2 border-b-primary"
                  : "text-muted-foreground/70 bg-card/30 hover:bg-accent/40 hover:text-foreground/80"
                } ${isDragOver && !isActive ? "border-l-2 border-l-primary" : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.modified ? <Circle className="h-2 w-2 fill-orange-400 text-orange-400 shrink-0" /> : null}
              {getTabIcon(tabLang)}
              <span>{tab.name}</span>
              <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Editor: single scrollable container */}
      <div ref={containerRef} className="flex-1 min-h-0 relative font-mono" style={{ fontSize: editorFontSize }}>
        {/* Single editable pre with syntax highlighting */}
        <pre
          ref={preRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onContextMenu={handleContextMenu}
          className="absolute inset-0 w-full h-full overflow-auto outline-none"
          style={{
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            padding: `${editorPadding}px ${editorPadding}px ${editorPadding}px ${lineNumWidth + editorPadding}px`,
            whiteSpace: "pre",
            overflowWrap: "normal",
            tabSize: 4,
            color: "hsl(var(--foreground))",
            backgroundColor: "transparent",
            caretColor: "hsl(var(--caret))",
          }}
          spellCheck={false}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />

        {/* Line numbers (scrolls vertically with pre via JS) */}
        <div
          ref={lineNumRef}
          className="absolute top-0 bottom-0 left-0 text-right select-none border-r bg-card text-muted-foreground/50 overflow-hidden pointer-events-none"
          style={{
            width: lineNumWidth,
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            paddingTop: editorPadding,
            paddingBottom: editorPadding,
            paddingRight: 8,
            zIndex: 4,
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => {
            const errs = errorLines.get(i + 1);
            const hasError = errs?.some(e => e.severity === "error");
            const hasWarning = errs?.some(e => e.severity === "warning");
            return (
              <div
                key={i}
                className="relative"
                style={{ minHeight: `${editorFontSize * editorLineHeight}px` }}
                onMouseEnter={() => setHoveredLine(i + 1)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                <span className={hasError ? "text-red-400" : hasWarning ? "text-yellow-400" : ""}>
                  {hasError ? <AlertCircle className="inline h-3 w-3 mr-0.5 -mt-0.5" /> : hasWarning ? <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5 text-yellow-400" /> : null}
                  {i + 1}
                </span>
                {hoveredLine === i + 1 && errs && errs.length > 0 && (
                  <div className="absolute left-full ml-2 top-0 z-50 bg-popover border rounded-md shadow-lg p-2 min-w-[200px] max-w-[350px] pointer-events-auto">
                    {errs.map((err, j) => (
                      <div key={j} className={`text-[11px] flex items-start gap-1.5 ${err.severity === "error" ? "text-red-400" : "text-yellow-400"}`}>
                        {err.severity === "error" ? <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t text-[11px] text-muted-foreground bg-card/30 shrink-0">
        <div className="flex items-center gap-4">
          <span>{activeTab.name}</span>
          <span>{lineCount} lineas</span>
          {errors.length > 0 && (
            <button
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent/50 transition-colors ${errors.some(e => e.severity === "error") ? "text-red-400" : "text-yellow-400"}`}
              onClick={() => setProblemsOpen(!problemsOpen)}
            >
              {errors.some(e => e.severity === "error") ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              <span>{errors.filter(e => e.severity === "error").length} errores, {errors.filter(e => e.severity === "warning").length} warnings</span>
              {problemsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>{activeTab.modified ? "Modificado" : "Guardado"}</span>
        </div>
      </div>

      {/* Problems panel */}
      {problemsOpen && errors.length > 0 && (
        <div className="border-t bg-card/50 max-h-[180px] overflow-auto shrink-0">
          <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground border-b flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />Problems ({errors.length})
          </div>
          <div className="divide-y">
            {errors.map((err, i) => (
              <div
                key={i}
                className="px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-accent/30 cursor-pointer"
                onClick={() => {
                  setCursorPosition(err.line, 0);
                  const el = preRef.current;
                  if (el) {
                    const lineHeight = editorFontSize * editorLineHeight;
                    el.scrollTop = Math.max(0, (err.line - 5) * lineHeight);
                    handleScroll();
                  }
                }}
              >
                {err.severity === "error" ? <AlertCircle className="h-3 w-3 text-red-400 shrink-0" /> : <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />}
                <span className="text-muted-foreground w-12 shrink-0">Ln {err.line}</span>
                <span className={err.severity === "error" ? "text-red-400" : "text-yellow-400"}>{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {MenuPortal}
    </div>
  );
}
