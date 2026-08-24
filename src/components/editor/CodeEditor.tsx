import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, Save, Circle, Scissors, Copy, ClipboardPaste, Undo2, Redo2, CheckSquare, AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useContextMenu } from "@/components/ui/context-menu";
import { t } from "@/lib/i18n";
import { validateConfig, type ConfigError } from "@/lib/config-validator";

const editorFontFamily = "'JetBrainsMono Nerd Font', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
const editorFontSize = 13;
const editorLineHeight = 1.6;
const editorPadding = 16;

export function detectLanguage(filename: string, fullPath?: string): string {
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

function highlightSyntax(code: string, language: string): React.ReactNode[] {
  // Reset span counter per call
  span._i = 0;

  const lines = code.split("\n");

  // For languages needing block-state tracking across lines
  let inBlockComment = false;
  let inLuaLongString = false;

  return lines.map((line, lineIdx) => {
    let parts: React.ReactNode[] = [];

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
        parts = [<span key="plain">{esc(line)}</span>];
    }

    return (
      <div key={lineIdx} style={{ minHeight: `${editorFontSize * editorLineHeight}px`, lineHeight: `${editorLineHeight}` }}>
        {parts.length > 0 ? parts : "\u00A0"}
      </div>
    );
  });
}

function highlightHyprland(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Full-line comment
  if (trimmed.startsWith("#")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Section headers like $ENV = value
  if (trimmed.startsWith("$")) {
    const m = trimmed.match(/^(\$[A-Za-z0-9_]+)\s*(=)(.*)/);
    if (m) {
      parts.push(span(m[1], "variable"));
      parts.push(span(m[2], "operator"));
      if (m[3].trim().startsWith("#") || m[3].trim().startsWith('"')) {
        parts.push(span(m[3], "string"));
      } else {
        parts.push(...highlightMixedValues(m[3]));
      }
      return parts;
    }
  }

  // Directive: first word
  const dirMatch = trimmed.match(/^([a-zA-Z_][\w-]*)/);
  if (dirMatch) {
    parts.push(span(dirMatch[1], "keyword"));
    let rest = trimmed.substring(dirMatch[1].length);

    // Inline comment
    const hashIdx = rest.indexOf("#");
    let codePart = rest;
    let commentPart = "";
    if (hashIdx >= 0) {
      // Only treat as comment if preceded by space or at start
      const beforeHash = rest.substring(0, hashIdx);
      if (hashIdx === 0 || beforeHash.endsWith(" ")) {
        codePart = rest.substring(0, hashIdx);
        commentPart = rest.substring(hashIdx);
      }
    }

    // Highlight the value portion
    if (codePart.length > 0) {
      parts.push(...highlightMixedValues(codePart));
    }
    if (commentPart) {
      parts.push(span(commentPart, "comment"));
    }
  } else {
    parts.push(<span key="rest">{esc(trimmed)}</span>);
  }

  return parts;
}

function highlightMixedValues(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = text;

  while (rem.length > 0) {
    let matched = false;

    // Strings
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(span(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      matched = true;
      continue;
    }

    // Colors
    const colM = rem.match(/^#[0-9a-fA-F]{3,8}\b/);
    if (colM && colM.index === 0) {
      parts.push(span(colM[0], "color"));
      rem = rem.substring(colM[0].length);
      matched = true;
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      matched = true;
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false|yes|no|on|off)\b/i);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      matched = true;
      continue;
    }

    // Variables
    const varM = rem.match(/^(\$[A-Za-z0-9_]+)/);
    if (varM && varM.index === 0) {
      parts.push(span(varM[0], "variable"));
      rem = rem.substring(varM[0].length);
      matched = true;
      continue;
    }

    if (!matched) {
      // Advance one character to avoid infinite loop
      parts.push(<span key={`x${parts.length}`}>{esc(rem[0])}</span>);
      rem = rem.substring(1);
    }
  }

  return parts;
}

function highlightJSON(line: string, isJsonc: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Line comment (JSONC only)
    if (isJsonc && rem.startsWith("//")) {
      parts.push(span(rem, "comment"));
      break;
    }

    // Block comment start (JSONC only)
    if (isJsonc && rem.startsWith("/*")) {
      const endIdx = rem.indexOf("*/", 2);
      if (endIdx >= 0) {
        parts.push(span(rem.substring(0, endIdx + 2), "comment"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(span(rem, "comment"));
        break;
      }
      continue;
    }

    // Strings
    const strM = rem.match(/^("(?:[^"\\]|\\.)*")/);
    if (strM && strM.index === 0) {
      const fullStr = strM[0];
      // Check if this key is followed by :
      const afterStr = rem.substring(fullStr.length).trimStart();
      if (afterStr.startsWith(":")) {
        // This is a key
        parts.push(span(fullStr, "property"));
      } else {
        parts.push(span(fullStr, "string"));
      }
      rem = rem.substring(fullStr.length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Booleans / null
    const boolM = rem.match(/^(true|false|null)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators/separators
    const opM = rem.match(/^([{}[\]:,])/);
    if (opM && opM.index === 0) {
      parts.push(span(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Plain text
    parts.push(<span key={`p${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightTOML(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith("#")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Table header [section]
  const tblM = trimmed.match(/^(\[[\w.-]+\])/);
  if (tblM && tblM.index === 0) {
    parts.push(span(tblM[0], "section"));
    const after = trimmed.substring(tblM[0].length);
    if (after.trimStart().startsWith("#")) {
      const space = after.substring(0, after.indexOf("#"));
      parts.push(<span key="sp">{esc(space)}</span>);
      parts.push(span(after.substring(after.indexOf("#")), "comment"));
    } else if (after.trim().length > 0) {
      parts.push(<span key="trailing">{esc(after)}</span>);
    }
    return parts;
  }

  // Array of tables [[section]]
  const arrTblM = trimmed.match(/^(\[\[[\w.-]+\]\])/);
  if (arrTblM && arrTblM.index === 0) {
    parts.push(span(arrTblM[0], "section"));
    return parts;
  }

  // Key = value
  const kvM = trimmed.match(/^([\w.-]+)\s*(=)/);
  if (kvM && kvM.index === 0) {
    parts.push(span(kvM[1], "property"));
    parts.push(span(kvM[2], "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Check for comment
    const commentIdx = val.indexOf("#");
    let valPart = val;
    let commentPart = "";
    if (commentIdx >= 0 && !val.trimStart().startsWith('"') && !val.trimStart().startsWith("'")) {
      valPart = val.substring(0, commentIdx);
      commentPart = val.substring(commentIdx);
    }

    parts.push(...highlightTomlValue(valPart));
    if (commentPart) parts.push(span(commentPart, "comment"));
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

function highlightTomlValue(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = text;

  while (rem.length > 0) {
    // Strings
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(span(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    // Dates (YYYY-MM-DD or datetime)
    const dateM = rem.match(/^(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?)/);
    if (dateM && dateM.index === 0) {
      parts.push(span(dateM[0], "number"));
      rem = rem.substring(dateM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    parts.push(<span key={`tv${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightCSS(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Block comment
    if (rem.startsWith("/*")) {
      const endIdx = rem.indexOf("*/", 2);
      if (endIdx >= 0) {
        parts.push(span(rem.substring(0, endIdx + 2), "comment"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(span(rem, "comment"));
        break;
      }
      continue;
    }

    // Line comment
    if (rem.startsWith("//")) {
      parts.push(span(rem, "comment"));
      break;
    }

    // Selectors and properties use text color for identifiers
    // Strings
    const strM = rem.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
    if (strM && strM.index === 0) {
      parts.push(span(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    // Hex colors
    const colM = rem.match(/^#[0-9a-fA-F]{3,8}\b/);
    if (colM && colM.index === 0) {
      parts.push(span(colM[0], "color"));
      rem = rem.substring(colM[0].length);
      continue;
    }

    // Numbers with units
    const numM = rem.match(/^(-?\d+\.?\d*)(px|em|rem|%|vh|vw|vmin|vmax|deg|rad|turn|s|ms|fr|ch|ex)?\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // At-rules
    const atM = rem.match(/^(@\w+)/);
    if (atM && atM.index === 0) {
      parts.push(span(atM[0], "keyword"));
      rem = rem.substring(atM[0].length);
      continue;
    }

    // Known CSS property names (before colon)
    const propM = rem.match(/^([\w-]+)\s*(?=:)/);
    if (propM && propM.index === 0) {
      parts.push(span(propM[0], "property"));
      rem = rem.substring(propM[0].length);
      continue;
    }

    // Keywords / pseudo-classes
    const kwM = rem.match(/^(important|inherit|initial|unset|none|auto|flex|grid|block|inline|absolute|relative|fixed|sticky)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(span(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators / punctuation
    const opM = rem.match(/^([{}:;,>+~[\]()])/);
    if (opM && opM.index === 0) {
      parts.push(span(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Identifiers (selectors, class names, etc.)
    const idM = rem.match(/^(.[\w-]*)/);
    if (idM && idM.index === 0) {
      parts.push(<span key={`id${parts.length}`} style={{ color: C.text }}>{esc(idM[0])}</span>);
      rem = rem.substring(idM[0].length);
      continue;
    }

    parts.push(<span key={`css${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightLua(
  line: string,
  inBlockComment: boolean,
  inLongString: boolean
): { parts: React.ReactNode[]; inBlock: boolean; inLong: boolean } {
  const parts: React.ReactNode[] = [];
  let rem = line;

  if (inBlockComment) {
    const endIdx = rem.indexOf("]]");
    if (endIdx >= 0) {
      parts.push(span(rem.substring(0, endIdx + 2), "comment"));
      rem = rem.substring(endIdx + 2);
      inBlockComment = false;
    } else {
      parts.push(span(line, "comment"));
      return { parts, inBlock: true, inLong: false };
    }
  }

  if (inLongString) {
    const endIdx = rem.indexOf("]]");
    if (endIdx >= 0) {
      parts.push(span(rem.substring(0, endIdx + 2), "string"));
      rem = rem.substring(endIdx + 2);
      inLongString = false;
    } else {
      parts.push(span(line, "string"));
      return { parts, inBlock: false, inLong: true };
    }
  }

  while (rem.length > 0) {
    // Block comment
    if (rem.startsWith("--[[")) {
      const endIdx = rem.indexOf("]]", 4);
      if (endIdx >= 0) {
        parts.push(span(rem.substring(0, endIdx + 2), "comment"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(span(rem, "comment"));
        rem = "";
        inBlockComment = true;
      }
      continue;
    }

    // Line comment
    if (rem.startsWith("--")) {
      parts.push(span(rem, "comment"));
      break;
    }

    // Long string [[ ]]
    if (rem.startsWith("[[")) {
      const endIdx = rem.indexOf("]]", 2);
      if (endIdx >= 0) {
        parts.push(span(rem.substring(0, endIdx + 2), "string"));
        rem = rem.substring(endIdx + 2);
      } else {
        parts.push(span(rem, "string"));
        rem = "";
        inLongString = true;
      }
      continue;
    }

    // Strings
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(span(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Booleans / nil
    const boolM = rem.match(/^(true|false|nil)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Keywords
    const kwM = rem.match(/^(local|function|end|if|then|else|elseif|for|while|do|return|require|and|or|not|repeat|until|goto)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(span(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Function call: name(
    const fnM = rem.match(/^([\w.]+)\s*(\()/);
    if (fnM && fnM.index === 0) {
      parts.push(span(fnM[1], "function"));
      parts.push(span(fnM[2], "operator"));
      rem = rem.substring(fnM[0].length);
      continue;
    }

    // Variables
    const varM = rem.match(/^([\w]+)/);
    if (varM && varM.index === 0) {
      parts.push(<span key={`lv${parts.length}`} style={{ color: C.text }}>{esc(varM[0])}</span>);
      rem = rem.substring(varM[0].length);
      continue;
    }

    // Operators
    const opM = rem.match(/^([{}[\]();,.<>=+\-*/%^#])/);
    if (opM && opM.index === 0) {
      parts.push(span(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    parts.push(<span key={`lua${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return { parts, inBlock: inBlockComment, inLong: inLongString };
}

function highlightShell(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Comment
    if (rem.startsWith("#")) {
      parts.push(span(rem, "comment"));
      break;
    }

    // Double-quoted string with variable expansion
    const dqM = rem.match(/^"((?:[^"\\$]|\\.)*)"/);
    if (dqM && dqM.index === 0) {
      parts.push(span(`"${dqM[1]}"`, "string"));
      rem = rem.substring(dqM[0].length);
      continue;
    }

    // Single-quoted string
    const sqM = rem.match(/^'([^']*)'/);
    if (sqM && sqM.index === 0) {
      parts.push(span(sqM[0], "string"));
      rem = rem.substring(sqM[0].length);
      continue;
    }

    // Variables
    const varM = rem.match(/^(\$[\w@?${}!]|(\$\{[^}]+\})|(\$[A-Za-z_][A-Za-z0-9_]*))/);
    if (varM && varM.index === 0) {
      parts.push(span(varM[0], "variable"));
      rem = rem.substring(varM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Keywords
    const kwM = rem.match(/^(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|export|source|local|readonly|declare|select|until|in|shift|trap|eval|exec)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(span(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators
    const opM = rem.match(/^([|&;><]+|[\[\](){}$`])/);
    if (opM && opM.index === 0) {
      parts.push(span(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Commands (first word on a line or after pipe/semicolon)
    const cmdM = rem.match(/^([a-zA-Z_][\w-]*)/);
    if (cmdM && cmdM.index === 0) {
      parts.push(span(cmdM[0], "function"));
      rem = rem.substring(cmdM[0].length);
      continue;
    }

    parts.push(<span key={`sh${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightFish(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = line;

  while (rem.length > 0) {
    // Comment
    if (rem.startsWith("#")) {
      parts.push(span(rem, "comment"));
      break;
    }

    // Double-quoted string
    const dqM = rem.match(/^"((?:[^"\\]|\\.)*)"/);
    if (dqM && dqM.index === 0) {
      parts.push(span(`"${dqM[1]}"`, "string"));
      rem = rem.substring(dqM[0].length);
      continue;
    }

    // Single-quoted string
    const sqM = rem.match(/^'([^']*)'/);
    if (sqM && sqM.index === 0) {
      parts.push(span(sqM[0], "string"));
      rem = rem.substring(sqM[0].length);
      continue;
    }

    // Variables
    const varM = rem.match(/^(\$(?:\{[^}]+\}|[A-Za-z0-9_]+))/);
    if (varM && varM.index === 0) {
      parts.push(span(varM[0], "variable"));
      rem = rem.substring(varM[0].length);
      continue;
    }

    // Numbers
    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    // Keywords
    const kwM = rem.match(/^(if|else|end|for|while|function|return|set|export|source|alias|in|break|continue|switch|case|begin|and|or|not|do|done)\b/);
    if (kwM && kwM.index === 0) {
      parts.push(span(kwM[0], "keyword"));
      rem = rem.substring(kwM[0].length);
      continue;
    }

    // Booleans
    const boolM = rem.match(/^(true|false|yes|no|0|1)\b/);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    // Operators
    const opM = rem.match(/^([|&;><\[\](){}])/);
    if (opM && opM.index === 0) {
      parts.push(span(opM[0], "operator"));
      rem = rem.substring(opM[0].length);
      continue;
    }

    // Commands
    const cmdM = rem.match(/^([a-zA-Z_][\w-]*)/);
    if (cmdM && cmdM.index === 0) {
      parts.push(span(cmdM[0], "function"));
      rem = rem.substring(cmdM[0].length);
      continue;
    }

    parts.push(<span key={`fish${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightINI(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Section header
  const secM = trimmed.match(/^(\[[\w.-]+\])/);
  if (secM && secM.index === 0) {
    parts.push(span(secM[0], "section"));
    const rest = trimmed.substring(secM[0].length);
    if (rest.trimStart().startsWith("#") || rest.trimStart().startsWith(";")) {
      const spaceIdx = rest.search(/[#;]/);
      parts.push(<span key="sp">{esc(rest.substring(0, spaceIdx))}</span>);
      parts.push(span(rest.substring(spaceIdx), "comment"));
    } else if (rest.trim().length > 0) {
      parts.push(<span key="trailing">{esc(rest)}</span>);
    }
    return parts;
  }

  // Key = value
  const kvM = trimmed.match(/^([\w.-]+)\s*([=:\s])/);
  if (kvM && kvM.index === 0) {
    parts.push(span(kvM[1], "property"));
    parts.push(span(kvM[2], "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Comment
    const commentIdx = findIniComment(val);
    if (commentIdx >= 0) {
      const valPart = val.substring(0, commentIdx);
      const commentPart = val.substring(commentIdx);
      if (valPart.trim().length > 0) parts.push(...highlightIniValue(valPart));
      parts.push(span(commentPart, "comment"));
    } else {
      parts.push(...highlightIniValue(val));
    }
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

function findIniComment(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "#" || text[i] === ";") return i;
  }
  return -1;
}

function highlightIniValue(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = text;

  while (rem.length > 0) {
    const strM = rem.match(/^(["'])(.*?)(\1)/);
    if (strM && strM.index === 0) {
      parts.push(span(strM[0], "string"));
      rem = rem.substring(strM[0].length);
      continue;
    }

    const colM = rem.match(/^#[0-9a-fA-F]{3,8}\b/);
    if (colM && colM.index === 0) {
      parts.push(span(colM[0], "color"));
      rem = rem.substring(colM[0].length);
      continue;
    }

    const numM = rem.match(/^(-?\d+\.?\d*)\b/);
    if (numM && numM.index === 0) {
      parts.push(span(numM[0], "number"));
      rem = rem.substring(numM[0].length);
      continue;
    }

    const boolM = rem.match(/^(true|false|yes|no|on|off)\b/i);
    if (boolM && boolM.index === 0) {
      parts.push(span(boolM[0], "boolean"));
      rem = rem.substring(boolM[0].length);
      continue;
    }

    parts.push(<span key={`iv${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightKeyValue(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith("#")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Key = value or Key: value
  const kvM = trimmed.match(/^([\w./-]+)\s*([=:])\s*/);
  if (kvM && kvM.index === 0) {
    parts.push(span(kvM[1], "property"));
    parts.push(span(kvM[2], "operator"));
    const val = trimmed.substring(kvM[0].length);
    parts.push(...highlightIniValue(val));
    return parts;
  }

  // Section-like headers
  const secM = trimmed.match(/^(\[[\w.-]+\])/);
  if (secM && secM.index === 0) {
    parts.push(span(secM[0], "section"));
    const rest = trimmed.substring(secM[0].length);
    if (rest.trim().length > 0) parts.push(<span key="tr">{esc(rest)}</span>);
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

function highlightEww(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith(";")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Keywords
  const kwM = trimmed.match(/^(defwindow|defwidget|defvar|deflisten|include)\b/);
  if (kwM && kwM.index === 0) {
    parts.push(span(kwM[0], "keyword"));
    const rest = trimmed.substring(kwM[0].length);
    parts.push(<span key="sp">{esc(rest.substring(0, Math.min(rest.length, 1)))}</span>);

    // Widget name
    const nameM = rest.trimStart().match(/^([\w-]+)/);
    if (nameM) {
      parts.push(span(nameM[1], "function"));
      const after = rest.substring(rest.indexOf(nameM[1]) + nameM[1].length);
      parts.push(...highlightEwwRest(after));
      return parts;
    }
    return parts;
  }

  // Built-in widgets
  const bldM = trimmed.match(/^(box|label|button|input|image|scale|eventbox|overlay|scroll|centerbox|expander|tooltip|window|fixed)\b/);
  if (bldM && bldM.index === 0) {
    parts.push(span(bldM[0], "section"));
    const rest = trimmed.substring(bldM[0].length);
    parts.push(...highlightEwwRest(rest));
    return parts;
  }

  // Properties
  const propM = trimmed.match(/^([\w-]+)\s*(:)/);
  if (propM && propM.index === 0) {
    parts.push(span(propM[1], "property"));
    parts.push(span(propM[2], "operator"));
    const val = trimmed.substring(propM[0].length);
    parts.push(...highlightIniValue(val));
    return parts;
  }

  // Keywords: true/false
  const boolM = trimmed.match(/^(true|false)\b/);
  if (boolM && boolM.index === 0) {
    parts.push(span(boolM[0], "boolean"));
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

function highlightEwwRest(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rem = text;

  while (rem.length > 0) {
    if (rem.startsWith(";")) {
      parts.push(span(rem, "comment"));
      break;
    }

    const propM = rem.match(/^([\w-]+)\s*(:)/);
    if (propM && propM.index === 0) {
      parts.push(span(propM[1], "property"));
      parts.push(span(propM[2], "operator"));
      const rest = rem.substring(propM[0].length);
      const nextProp = rest.search(/[\s]+[\w-]+\s*:/);
      if (nextProp >= 0) {
        parts.push(...highlightIniValue(rest.substring(0, nextProp)));
        rem = rest.substring(nextProp);
      } else {
        parts.push(...highlightIniValue(rest));
        break;
      }
      continue;
    }

    parts.push(<span key={`ew${parts.length}`}>{esc(rem[0])}</span>);
    rem = rem.substring(1);
  }

  return parts;
}

function highlightRofi(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith("//")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Section header: * { ... } or window { }
  const secM = trimmed.match(/^([\w.*]+)\s*\{/);
  if (secM && secM.index === 0) {
    parts.push(span(secM[1], "section"));
    parts.push(span(" {", "operator"));
    return parts;
  }

  // Closing brace
  if (trimmed.startsWith("}")) {
    parts.push(span("}", "operator"));
    return parts;
  }

  // Property: value
  const kvM = trimmed.match(/^([\w-]+)\s*:\s*/);
  if (kvM && kvM.index === 0) {
    parts.push(span(kvM[1], "property"));
    parts.push(span(":", "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Colors
    const colM = val.match(/^(#[0-9a-fA-F]{3,8})/);
    if (colM) {
      parts.push(span(colM[0], "color"));
      const rest = val.substring(colM[0].length);
      if (rest.trim().length > 0) parts.push(<span key="rv">{esc(rest)}</span>);
      return parts;
    }

    parts.push(...highlightIniValue(val));
    return parts;
  }

  // Keywords
  const kwM = trimmed.match(/^(configuration|theme|import|window)\b/);
  if (kwM && kwM.index === 0) {
    parts.push(span(kwM[0], "keyword"));
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

function highlightTmux(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith("#")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // set-option / set / unbind / bind
  const kwM = trimmed.match(/^(set|set-option|set-window-option|unbind|bind|bind-key|unbind-key|source|run|if|new-session|new-window|split-window|select-window|set-hook|display-message)\b/);
  if (kwM && kwM.index === 0) {
    parts.push(span(kwM[0], "keyword"));
    const rest = trimmed.substring(kwM[0].length);
    parts.push(...highlightIniValue(rest));
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

function highlightDunst(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const trimmed = line.trimStart();
  const indent = line.length - trimmed.length;

  if (indent > 0) parts.push(<span key="ind">{esc(line.substring(0, indent))}</span>);

  // Comment
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
    parts.push(span(line.substring(indent), "comment"));
    return parts;
  }

  // Section header
  const secM = trimmed.match(/^(\[[\w.]+\])/);
  if (secM && secM.index === 0) {
    parts.push(span(secM[0], "section"));
    const rest = trimmed.substring(secM[0].length);
    if (rest.trim().length > 0) parts.push(<span key="tr">{esc(rest)}</span>);
    return parts;
  }

  // Key = value
  const kvM = trimmed.match(/^([\w_]+)\s*=\s*/);
  if (kvM && kvM.index === 0) {
    parts.push(span(kvM[1], "property"));
    parts.push(span("=", "operator"));
    const val = trimmed.substring(kvM[0].length);

    // Colors
    const colM = val.match(/^(#[0-9a-fA-F]{3,8})/);
    if (colM) {
      parts.push(span(colM[0], "color"));
      const rest = val.substring(colM[0].length);
      if (rest.trim().length > 0) parts.push(<span key="dr">{esc(rest)}</span>);
      return parts;
    }

    parts.push(...highlightIniValue(val));
    return parts;
  }

  parts.push(<span key="raw">{esc(trimmed)}</span>);
  return parts;
}

export function CodeEditor() {
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const closeTab = useAppStore((s) => s.closeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const saveCurrentFile = useAppStore((s) => s.saveCurrentFile);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const { showMenu, MenuPortal } = useContextMenu();
  const [errors, setErrors] = useState<ConfigError[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveCurrentFile]);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.addEventListener("scroll", handleScroll, { passive: true });
      return () => ta.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, activeTabId]);

  // Reset scroll on tab change
  useEffect(() => {
    if (textareaRef.current) textareaRef.current.scrollTop = 0;
    if (highlightRef.current) highlightRef.current.scrollTop = 0;
    if (lineNumRef.current) lineNumRef.current.scrollTop = 0;
    setErrors([]);
    setProblemsOpen(false);
    setHoveredLine(null);
  }, [activeTabId]);

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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ta = textareaRef.current;
    const hasSelection = ta && ta.selectionStart !== ta.selectionEnd;
    const items = [
      { label: t("editor.contextMenu.undo"), icon: <Undo2 className="h-4 w-4" />, shortcut: "Ctrl+Z", onClick: () => document.execCommand("undo") },
      { label: t("editor.contextMenu.redo"), icon: <Redo2 className="h-4 w-4" />, shortcut: "Ctrl+Y", onClick: () => document.execCommand("redo") },
      { divider: true, label: "" },
      { label: t("editor.contextMenu.cut"), icon: <Scissors className="h-4 w-4" />, shortcut: "Ctrl+X", disabled: !hasSelection, onClick: () => { ta?.focus(); document.execCommand("cut"); } },
      { label: t("editor.contextMenu.copy"), icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl+C", disabled: !hasSelection, onClick: () => { ta?.focus(); document.execCommand("copy"); } },
      { label: t("editor.contextMenu.paste"), icon: <ClipboardPaste className="h-4 w-4" />, shortcut: "Ctrl+V", onClick: () => { ta?.focus(); document.execCommand("paste"); } },
      { divider: true, label: "" },
      { label: t("editor.contextMenu.selectAll"), icon: <CheckSquare className="h-4 w-4" />, shortcut: "Ctrl+A", onClick: () => { ta?.focus(); ta?.select(); } },
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
  const language = detectLanguage(activeTab.name, activeTab.path);
  const highlighted = highlightSyntax(activeTab.content, language);
  const lineNumWidth = Math.max(40, String(lineCount).length * 9 + 24);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center border-b bg-card/50 overflow-x-auto shrink-0">
        {openTabs.map((tab) => (
          <div key={tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 border-r cursor-pointer text-sm whitespace-nowrap group transition-colors ${tab.id === activeTabId ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.modified ? <Circle className="h-2 w-2 fill-orange-400 text-orange-400 shrink-0" /> : <span className="w-2 h-2" />}
            <span>{tab.name}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Editor: single scrollable container */}
      <div ref={containerRef} className="flex-1 min-h-0 relative font-mono" style={{ fontSize: editorFontSize }}>
        {/* Textarea: handles input, selection, and scrolling */}
        <textarea
          ref={textareaRef}
          value={activeTab.content}
          onChange={(e) => updateTabContent(activeTab.id, e.target.value)}
          onContextMenu={handleContextMenu}
          className="absolute inset-0 w-full h-full resize-none outline-none"
          style={{
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            padding: `${editorPadding}px ${editorPadding}px ${editorPadding}px ${lineNumWidth + editorPadding}px`,
            color: "transparent",
            caretColor: "hsl(var(--caret))",
            backgroundColor: "transparent",
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto",
            overflowY: "auto",
            tabSize: 4,
            zIndex: 3,
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />

        {/* Highlighted code (scrolls with textarea via JS) */}
        <div
          ref={highlightRef}
          className="absolute inset-0 pointer-events-none whitespace-pre overflow-hidden"
          style={{
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            padding: `${editorPadding}px ${editorPadding}px ${editorPadding}px ${lineNumWidth + editorPadding}px`,
            tabSize: 4,
            zIndex: 1,
          }}
          aria-hidden="true"
        >
          {highlighted}
        </div>

        {/* Line numbers (scrolls vertically with textarea via JS) */}
        <div
          ref={lineNumRef}
          className="absolute top-0 bottom-0 left-0 text-right select-none border-r bg-card/30 text-muted-foreground/50 overflow-hidden pointer-events-none"
          style={{
            width: lineNumWidth,
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            paddingTop: editorPadding,
            paddingBottom: editorPadding,
            paddingRight: 8,
            zIndex: 2,
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
                  if (textareaRef.current) {
                    const ta = textareaRef.current;
                    const contentLines = ta.value.split("\n");
                    let pos = 0;
                    for (let l = 0; l < err.line - 1 && l < contentLines.length; l++) {
                      pos += contentLines[l].length + 1;
                    }
                    ta.focus();
                    ta.setSelectionRange(pos, pos + 10);
                    const lineHeight = editorFontSize * editorLineHeight;
                    ta.scrollTop = Math.max(0, (err.line - 5) * lineHeight);
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
