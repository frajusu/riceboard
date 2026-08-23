import { registerPlugin, type Plugin, type ValidationResult, type Suggestion } from "../plugin-api";

const hyprlandKeywords = [
  "bind", "bindm", "bindr", "binde", "bindrl",
  "monitor", "workspace", "windowrule", "windowrulev2",
  "layerrule", "input", "general", "decoration",
  "animations", "misc", "plugin", "exec", "exec-once",
  "env", "source", "submap", "$mainMod", "$modifier",
  "bezier", "animation", "general:layout",
];

const hyprlandOptions = [
  "gaps_in", "gaps_out", "border_size", "col.active_border",
  "col.inactive_border", "layout", "no_border_floating",
  "no_focus_fallback", "resize_on_border", "allow_tearing",
  "inactive_opacity", "active_opacity", "fullscreen_opacity",
  "rounding", "blur", "shadow", "dim_inactive",
  "snap_threshold", "col.shadow", "shadow_offset",
  "shadow_range", "shadow_render_power",
  "fps", "vfr", "vrr", "force_intel_render",
];

function validate(content: string): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const colonIdx = trimmed.indexOf("=");
    if (colonIdx > 0) {
      const key = trimmed.substring(0, colonIdx).trim();
      if (!hyprlandOptions.includes(key) && !key.startsWith("plugin:")) {
        warnings.push({
          line: idx + 1,
          column: 0,
          message: `Opción desconocida: ${key}`,
          severity: "warning",
        });
      }
    }

    if (trimmed.startsWith("bind") || trimmed.startsWith("bindm")) {
      const parts = trimmed.split(",").map((s) => s.trim());
      if (parts.length < 3) {
        errors.push({
          line: idx + 1,
          column: 0,
          message: "bind necesita al menos: modos, tecla, comando",
          severity: "error",
        });
      }
    }

    if (trimmed.startsWith("monitor") && !trimmed.startsWith("monitor=")) {
      const parts = trimmed.split(",").map((s) => s.trim());
      if (parts.length < 2) {
        errors.push({
          line: idx + 1,
          column: 0,
          message: "monitor necesita al menos: nombre, configuración",
          severity: "error",
        });
      }
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function getSuggestions(content: string, cursor: number): Suggestion[] {
  const lines = content.substring(0, cursor).split("\n");
  const currentLine = lines[lines.length - 1] || "";

  if (currentLine.includes("=")) {
    return [];
  }

  return [
    ...hyprlandKeywords.map((kw) => ({
      label: kw,
      description: `Keyword de Hyprland`,
      insertText: kw,
      kind: "keyword" as const,
    })),
    ...hyprlandOptions.map((opt) => ({
      label: opt,
      description: `Opción de configuración`,
      insertText: `${opt} = `,
      kind: "property" as const,
    })),
  ];
}

export const hyprlandPlugin: Plugin = { config: {
  name: "hyprland",
  displayName: "Hyprland",
  description: "Window manager para Wayland con animaciones y tiling dinámico",
  icon: "layers",
  filePatterns: ["hyprland.conf", "hypr.conf"],
  configPaths: ["~/.config/hypr/"],
}, validate, getSuggestions };
