export interface ConfigError {
  line: number;
  column: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
}

type Validator = (content: string) => ConfigError[];

const validators: Record<string, Validator> = {
  "hyprland": validateHyprland,
  "waybar": validateJsonLike,
  "kitty": validateKeyValue,
  "alacritty": validateToml,
  "ghostty": validateKeyValue,
  "rofi": validateRofi,
  "wofi": validateKeyValue,
  "neovim": validateLua,
  "nvim": validateLua,
  "zsh": validateShell,
  "fish": validateFish,
  "bash": validateShell,
  "mako": validateKeyValue,
  "dunst": validateDunst,
  "tmux": validateTmux,
  "btop": validateKeyValue,
  "swww": () => [],
  "hyprpaper": validateKeyValue,
  "hyprlock": validateHyprlock,
  "eww": validateEww,
  "cava": validateKeyValue,
  "starship": validateToml,
  "fastfetch": validateJsonLike,
  "foot": validateIni,
  "fuzzel": validateIni,
  "swaync": validateJsonLike,
  "yazi": validateToml,
  "wlogout": validateWlogout,
  "lazygit": validateToml,
  "bat": validateKeyValue,
  "eza": () => [],
  "wallust": validateToml,
};

const hyprlandDirectives = new Set([
  "bind", "bindm", "bindd", "binde", "bindr", "bindld", "bindl",
  "monitor", "workspace", "windowrule", "windowrulev2", "layerrule",
  "exec", "exec-once", "execp", "execr",
  "env", "envd", "input", "general", "decoration", "animations",
  "dwindle", "master", "misc", "debug", "notifications",
  "group", "plugin", "source", "submap", "cursor",
]);

function validateHyprland(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let inBlock = 0;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    braceCount += openBraces - closeBraces;

    const directiveMatch = line.match(/^(\w[\w-]*)/);
    if (directiveMatch) {
      const directive = directiveMatch[1];
      if (!hyprlandDirectives.has(directive) && !line.includes("=") && directive !== "bezier" && !directive.startsWith("$")) {
        errors.push({ line: lineNum, column: 1, endColumn: directive.length + 1, message: `Unknown directive "${directive}"`, severity: "warning" });
      }
    }

    if (line.startsWith("bind")) {
      const bindMatch = line.match(/^bind[mdde]*\s*=\s*(.+)$/);
      if (bindMatch) {
        const parts = bindMatch[1].split(",").map(s => s.trim());
        if (parts.length < 4) {
          errors.push({ line: lineNum, column: line.indexOf("=") + 2, endColumn: line.length + 1, message: `bind requires at least 4 args: MOD, KEY, DISPATCHER, PARAM`, severity: "error" });
        }
      }
    }

    if (line.startsWith("monitor")) {
      const monMatch = line.match(/^monitor\s*=\s*(.+)$/);
      if (monMatch) {
        const args = monMatch[1].split(",").map(s => s.trim());
        if (args.length < 4) {
          errors.push({ line: lineNum, column: line.indexOf("=") + 2, endColumn: line.length + 1, message: `monitor requires at least 4 args: NAME, RESOLUTION, POSITION, SCALE`, severity: "error" });
        }
      }
    }

    if (line.startsWith("general")) {
      const blockMatch = line.match(/general\s*{([\s\S]*?)}/);
      if (!blockMatch && !line.includes("{")) {
        inBlock++;
      }
    }

    const unmatchedClose = (line.match(/}/g) || []).length;
    for (let j = 0; j < unmatchedClose; j++) {
      if (inBlock > 0) inBlock--;
    }
  }

  if (braceCount < 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Unmatched closing brace '}'`, severity: "error" });
  } else if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }

  return errors;
}

function validateKeyValue(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#") || line.startsWith("//") || line.startsWith("--") || line.startsWith(";")) continue;

    if (line.includes("=") || line.includes(":")) {
      const sep = line.includes("=") ? "=" : ":";
      const idx = line.indexOf(sep);
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();

      if (!key) {
        errors.push({ line: lineNum, column: 1, endColumn: idx + 1, message: `Empty key before "${sep}"`, severity: "error" });
        continue;
      }

      if (/\s/.test(key)) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Key "${key}" contains whitespace`, severity: "error" });
      }

      if (!value && !key.startsWith("#")) {
        errors.push({ line: lineNum, column: idx + 2, endColumn: line.length + 1, message: `Empty value for key "${key}"`, severity: "warning" });
      }
    }
  }

  return errors;
}

function validateToml(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      inTable = true;
      const tableName = tableMatch[1].trim();
      if (!tableName) {
        errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "Empty table name", severity: "error" });
      }
      continue;
    }

    const arrayTableMatch = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayTableMatch) continue;

    if (line.includes("=")) {
      const idx = line.indexOf("=");
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();

      if (!key) {
        errors.push({ line: lineNum, column: 1, endColumn: idx + 1, message: "Empty key", severity: "error" });
        continue;
      }

      if (key.includes(" ")) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Key "${key}" contains spaces (use quotes or underscores)`, severity: "error" });
      }

      if (!value) {
        errors.push({ line: lineNum, column: idx + 2, endColumn: line.length + 1, message: `No value for key "${key}"`, severity: "warning" });
      }

      if (value === "true" || value === "false" || value === "null") continue;
      if (/^["']/.test(value)) {
        const quote = value[0];
        const endQuote = value.lastIndexOf(quote);
        if (endQuote <= 0 || endQuote !== value.length - 1) {
          errors.push({ line: lineNum, column: idx + 2, endColumn: line.length + 1, message: `Unclosed string literal`, severity: "error" });
        }
      } else if (/^\[/.test(value)) {
        const bracketCount = (value.match(/\[/g) || []).length - (value.match(/\]/g) || []).length;
        if (bracketCount !== 0) {
          errors.push({ line: lineNum, column: idx + 2, endColumn: line.length + 1, message: `Unclosed bracket in array`, severity: "error" });
        }
      }
    }
  }

  return errors;
}

function validateJsonLike(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let braceCount = 0;
  let bracketCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    const lineNum = i + 1;

    const commentIdx = line.indexOf("//");
    if (commentIdx >= 0) {
      line = line.substring(0, commentIdx).trim();
    }

    if (!line) continue;

    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
      if (ch === "[") bracketCount++;
      if (ch === "]") bracketCount--;
    }

    if (braceCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing brace '}'", severity: "error" });
      braceCount = 0;
    }
    if (bracketCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing bracket ']'", severity: "error" });
      bracketCount = 0;
    }

    const trailingComma = line.match(/,\s*[}\]]/);
    if (trailingComma) {
      errors.push({ line: lineNum, column: line.indexOf(",") + 1, endColumn: line.indexOf(",") + 2, message: "Trailing comma", severity: "warning" });
    }

    if (line.includes(":")) {
      const kvMatch = line.match(/"([^"]+)"\s*:\s*(.*)/);
      if (kvMatch) {
        const val = kvMatch[2].trim().replace(/,$/, "");
        if (val === "") {
          errors.push({ line: lineNum, column: line.indexOf(":") + 1, endColumn: line.length + 1, message: `Empty value for key "${kvMatch[1]}"`, severity: "warning" });
        }
      }
    }
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }
  if (bracketCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${bracketCount} closing bracket(s) ']'`, severity: "error" });
  }

  return errors;
}

function validateRofi(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let braceCount = 0;
  let parenCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;

    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
      if (ch === "(") parenCount++;
      if (ch === ")") parenCount--;
    }

    if (braceCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing brace '}'", severity: "error" });
      braceCount = 0;
    }
    if (parenCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing parenthesis ')'", severity: "error" });
      parenCount = 0;
    }

    if (line.match(/^\w[\w-]*\s*:/) && !line.includes("{") && !line.endsWith(";") && !line.endsWith(",")) {
      errors.push({ line: lineNum, column: line.indexOf(":") + 1, endColumn: line.length + 1, message: "Property not terminated with ';'", severity: "warning" });
    }

    if (line.includes(":")) {
      const propMatch = line.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
      if (propMatch) {
        const prop = propMatch[1];
        const val = propMatch[2];
        if (!val && !prop.startsWith("@")) {
          errors.push({ line: lineNum, column: line.indexOf(":") + 1, endColumn: line.length + 1, message: `Empty value for property "${prop}"`, severity: "warning" });
        }
      }
    }
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }
  if (parenCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${parenCount} closing parenthesis(es)`, severity: "error" });
  }

  return errors;
}

function validateLua(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let blockCount = 0;

  const blockKeywords = ["function", "if", "for", "while", "do", "repeat"];
  const endKeywords = ["end"];
  const singleLineIfs: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("--")) continue;

    for (const kw of blockKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`);
      if (regex.test(line)) {
        if (kw === "if") {
          if (line.includes("then")) blockCount++;
          else singleLineIfs.push(lineNum);
        } else if (kw === "for" || kw === "while") {
          if (line.includes("do")) blockCount++;
        } else {
          blockCount++;
        }
      }
    }

    for (const kw of endKeywords) {
      if (line === kw || line.startsWith("end") && (line.length === 3 || line[3] === " " || line[3] === "," || line[3] === ")")) {
        if (blockCount > 0) blockCount--;
      }
    }

    if (line.includes("require") || line.includes("vim.cmd") || line.includes("vim.keymap.set")) {
      const unclosedParen = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      if (unclosedParen > 0) {
        errors.push({ line: lineNum, column: line.length - 1, endColumn: line.length + 1, message: "Unclosed parenthesis", severity: "error" });
      }
    }

    if (line.match(/^[^-]*=/) && !line.includes("local") && !line.includes("function") && !line.includes("--")) {
      const eqIdx = line.indexOf("=");
      const beforeEq = line.substring(0, eqIdx).trim();
      if (beforeEq && !beforeEq.match(/^[~<>!=]/) && !beforeEq.match(/[\[\{(]$/) && !beforeEq.match(/\.\./)) {
        if (!beforeEq.match(/^(local\s+)?\w+(\.\w+)*(\[\w+\])?$/) && !beforeEq.match(/^(local\s+)?\w+\s*$/)) {
          errors.push({ line: lineNum, column: 1, endColumn: eqIdx + 1, message: `Suspicious assignment: "${beforeEq}"`, severity: "warning" });
        }
      }
    }
  }

  if (blockCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${blockCount} 'end' keyword(s)`, severity: "error" });
  }

  return errors;
}

function validateShell(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let ifCount = 0;
  let forCount = 0;
  let whileCount = 0;
  let caseCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    const stripped = line.replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");

    if (/\bif\b/.test(stripped) && !/\bfi\b/.test(stripped) && !/\belif\b/.test(stripped)) ifCount++;
    if (/\bfi\b/.test(stripped) && ifCount > 0) ifCount--;

    if (/\bfor\b/.test(stripped) && /\bdo\b/.test(stripped)) forCount++;
    if (/\bdone\b/.test(stripped) && forCount > 0) forCount--;

    if (/\bwhile\b/.test(stripped)) whileCount++;
    if (/\bdone\b/.test(stripped) && whileCount > 0) whileCount--;

    if (/\bcase\b/.test(stripped)) caseCount++;
    if (/\besac\b/.test(stripped) && caseCount > 0) caseCount--;

    const openQuote = (stripped.match(/"/g) || []).length % 2;
    if (openQuote) {
      errors.push({ line: lineNum, column: line.length - 1, endColumn: line.length + 1, message: "Unclosed double quote", severity: "error" });
    }

    const openSingleQuote = (stripped.match(/'/g) || []).length % 2;
    if (openSingleQuote) {
      errors.push({ line: lineNum, column: line.length - 1, endColumn: line.length + 1, message: "Unclosed single quote", severity: "error" });
    }

    if (line.match(/\[\s+[^\]]*$/)) {
      errors.push({ line: lineNum, column: line.indexOf("[") + 1, endColumn: line.length + 1, message: "Unclosed test bracket '['", severity: "error" });
    }
  }

  if (ifCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${ifCount} 'fi' keyword(s)`, severity: "error" });
  if (forCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${forCount} 'done' keyword(s)`, severity: "error" });
  if (whileCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${whileCount} 'done' keyword(s)`, severity: "error" });
  if (caseCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${caseCount} 'esac' keyword(s)`, severity: "error" });

  return errors;
}

function validateFish(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let blockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    if (/\bif\b/.test(line) || /\bfor\b/.test(line) || /\bwhile\b/.test(line) || /\bfunction\b/.test(line)) {
      blockCount++;
    }
    if (/\bend\b/.test(line) && blockCount > 0) blockCount--;

    const openParen = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    if (openParen < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing parenthesis ')'", severity: "error" });
    }

    if (line.includes("set -gx") || line.includes("set -g")) {
      const parts = line.split(/\s+/);
      if (parts.length < 3) {
        errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "set requires a variable name and value", severity: "warning" });
      }
    }
  }

  if (blockCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${blockCount} 'end' keyword(s)`, severity: "error" });
  }

  return errors;
}

function validateDunst(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith(";") || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      inSection = true;
      const name = sectionMatch[1].trim();
      if (!name) {
        errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "Empty section name", severity: "error" });
      }
      continue;
    }

    if (line.includes("=")) {
      const idx = line.indexOf("=");
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();

      if (!key) {
        errors.push({ line: lineNum, column: 1, endColumn: idx + 1, message: "Empty key", severity: "error" });
        continue;
      }

      if (key.includes(" ")) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Key "${key}" contains whitespace`, severity: "error" });
      }

      if (!value) {
        errors.push({ line: lineNum, column: idx + 2, endColumn: line.length + 1, message: `Empty value for key "${key}"`, severity: "warning" });
      }
    }
  }

  return errors;
}

function validateTmux(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("set") || line.startsWith("setw")) {
      if (!line.includes(" ")) {
        errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: `"${line.split(" ")[0]}" requires arguments`, severity: "error" });
      }
    }

    if (line.startsWith("bind")) {
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "bind requires a key argument", severity: "error" });
      }
    }

    const unclosedQuote = (line.match(/"/g) || []).length % 2;
    if (unclosedQuote) {
      errors.push({ line: lineNum, column: line.length - 1, endColumn: line.length + 1, message: "Unclosed double quote", severity: "error" });
    }
  }

  return errors;
}

function validateIni(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      inSection = true;
      continue;
    }

    if (line.includes("=")) {
      const idx = line.indexOf("=");
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();

      if (!key) {
        errors.push({ line: lineNum, column: 1, endColumn: idx + 1, message: "Empty key", severity: "error" });
      }

      if (key.includes(" ")) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Key "${key}" contains spaces`, severity: "error" });
      }
    } else if (!line.startsWith("[")) {
      errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "Line is not a section header or key=value pair", severity: "warning" });
    }
  }

  return errors;
}

function validateHyprlock(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
    }

    if (braceCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing brace '}'", severity: "error" });
      braceCount = 0;
    }

    if (line.includes("=") && !line.startsWith("monitor") && !line.startsWith("path")) {
      const eqIdx = line.indexOf("=");
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (!key) {
        errors.push({ line: lineNum, column: 1, endColumn: eqIdx + 1, message: "Empty key", severity: "error" });
      }
      if (!value) {
        errors.push({ line: lineNum, column: eqIdx + 2, endColumn: line.length + 1, message: `Empty value for "${key}"`, severity: "warning" });
      }
    }
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }

  return errors;
}

function validateEww(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let parenCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith(";") || line.startsWith(";;")) continue;

    for (const ch of line) {
      if (ch === "(") parenCount++;
      if (ch === ")") parenCount--;
    }

    if (parenCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing parenthesis ')'", severity: "error" });
      parenCount = 0;
    }

    if (line.startsWith("(def") && !line.includes(")")) {
      errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "Unclosed parenthesis in definition", severity: "warning" });
    }
  }

  if (parenCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${parenCount} closing parenthesis(es)`, severity: "error" });
  }

  return errors;
}

function validateWlogout(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("//")) continue;

    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
    }

    if (braceCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing brace '}'", severity: "error" });
      braceCount = 0;
    }

    if (line.match(/^\w+\s*\{/) && !line.endsWith("{")) {
      const propMatch = line.match(/(\w+)\s*\{([^}]*?)$/);
      if (!propMatch) {
        errors.push({ line: lineNum, column: 1, endColumn: line.length + 1, message: "Malformed block definition", severity: "warning" });
      }
    }
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }

  return errors;
}

export function validateConfig(filename: string, content: string): ConfigError[] {
  const lower = filename.toLowerCase();

  let pluginName: string | null = null;
  for (const key of Object.keys(validators)) {
    if (lower.includes(key)) {
      pluginName = key;
      break;
    }
  }

  if (!pluginName) {
    if (lower.endsWith(".lua")) pluginName = "neovim";
    else if (lower.endsWith(".toml")) pluginName = "starship";
    else if (lower.endsWith(".json") || lower.endsWith(".jsonc")) pluginName = "waybar";
    else if (lower.endsWith(".css")) pluginName = "waybar";
    else if (lower.endsWith(".ini")) pluginName = "foot";
    else if (lower.endsWith(".rasi")) pluginName = "rofi";
    else if (lower.endsWith(".yuck")) pluginName = "eww";
    else if (lower.endsWith(".scss")) pluginName = "eww";
    else if (lower.endsWith(".conf")) pluginName = "hyprland";
    else if (lower.endsWith(".rc") || lower.endsWith(".zshrc") || lower.endsWith(".bashrc")) pluginName = "bash";
    else if (lower.endsWith(".fish")) pluginName = "fish";
  }

  if (!pluginName || !validators[pluginName]) return [];

  return validators[pluginName](content);
}
