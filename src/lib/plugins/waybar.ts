import { registerPlugin, type Plugin, type ValidationResult, type Suggestion } from "../plugin-api";

const waybarModules = [
  "hyprland/workspaces", "hyprland/window", "hyprland/submap",
  "sway/workspaces", "sway/window", "sway/mode",
  "clock", "battery", "pulseaudio", "network",
  "bluetooth", "backlight", "cpu", "memory",
  "disk", "temperature", "custom/power-menu",
  "custom/spotify", "tray", "mpd", "idle_inhibitor",
  "privacy", "scratchpad", "wlr/taskbar",
];

const cssProperties = [
  "all", "background", "background-color", "color",
  "border", "border-color", "border-radius", "border-width",
  "box-shadow", "font", "font-family", "font-size",
  "font-weight", "margin", "padding", "min-width",
  "min-height", "max-width", "max-height",
  "opacity", "transition", "text-decoration",
];

function validate(content: string): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) return;

    if (trimmed.startsWith("#") && !trimmed.includes("{")) {
      const selector = trimmed.replace("#workspaces", "").trim();
      if (selector && !selector.match(/^[.#\w\[\]:,>+~\s]+$/)) {
        warnings.push({
          line: idx + 1,
          column: 0,
          message: `Selector CSS potencialmente inválido: ${selector}`,
          severity: "warning",
        });
      }
    }

    if (trimmed.includes(":") && trimmed.endsWith(";")) {
      const prop = trimmed.split(":")[0].trim();
      if (!cssProperties.includes(prop) && !prop.startsWith("--")) {
        warnings.push({
          line: idx + 1,
          column: 0,
          message: `Propiedad CSS desconocida: ${prop}`,
          severity: "warning",
        });
      }
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function getSuggestions(_content: string, _cursor: number): Suggestion[] {
  return waybarModules.map((mod) => ({
    label: mod,
    description: "Módulo de Waybar",
    insertText: `#${mod} {\n  \n}`,
    kind: "keyword" as const,
  }));
}

export const waybarPlugin: Plugin = { config: {
  name: "waybar",
  displayName: "Waybar",
  description: "Barra de estado para Wayland, estilizable con CSS",
  icon: "layers",
  filePatterns: ["config", "style.css"],
  configPaths: ["~/.config/waybar/"],
}, validate, getSuggestions };
