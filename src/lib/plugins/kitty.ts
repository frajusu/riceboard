import { registerPlugin, type Plugin, type ValidationResult, type Suggestion } from "../plugin-api";

const kittyOptions = [
  "font_family", "font_size", "bold_font", "italic_font",
  "bold_italic_font", "background", "foreground", "cursor_color",
  "selection_background", "selection_foreground",
  "scrollback_lines", "scrollback_pager_history_size",
  "mouse_hide_wait", "url_style", "open_url_with",
  "copy_on_select", "strip_trailing_spaces",
  "terminal_type", "scrollback_pager",
  "wheel_scroll_multiplier", "touch_scroll_multiplier",
  "allow_remote_control", "listen_on",
  "shell_integration", "enable_audio_bell",
  "visual_bell_duration", "window_padding_width",
  "window_margin_width", "single_window_margin_width",
  "window_padding_width", "draw_minimal_borders",
  "hide_window_decorations", "confirm_os_window_close",
  "initial_window_width", "initial_window_height",
  "remember_window_size", "enabled_layouts",
  "window_logo_path", "active_tab_font_style",
  "inactive_tab_font_style", "tab_bar_edge",
  "tab_bar_style", "tab_powerline_style",
  "active_tab_foreground", "active_tab_background",
  "inactive_tab_foreground", "inactive_tab_background",
  "tab_bar_background", "mark1_foreground", "mark1_background",
  "mark2_foreground", "mark2_background",
  "mark3_foreground", "mark3_background",
  "wayland_titlebar_color", "macos_titlebar_color",
  "macos_option_as_alt",
];

const kittyColors = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "bright_black", "bright_red", "bright_green", "bright_yellow",
  "bright_blue", "bright_magenta", "bright_cyan", "bright_white",
];

function validate(content: string): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const eqIdx = trimmed.indexOf(" ");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      if (!kittyOptions.includes(key) && !key.startsWith("map") && !key.startsWith("action") && !key.startsWith("mouse_map")) {
        warnings.push({
          line: idx + 1,
          column: 0,
          message: `Opción de Kitty no reconocida: ${key}`,
          severity: "warning",
        });
      }
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function getSuggestions(_content: string, _cursor: number): Suggestion[] {
  return [
    ...kittyOptions.map((opt) => ({
      label: opt,
      description: "Opción de Kitty",
      insertText: `${opt} `,
      kind: "property" as const,
    })),
    ...kittyColors.map((c) => ({
      label: c,
      description: "Color de terminal",
      insertText: c,
      kind: "value" as const,
    })),
  ];
}

export const kittyPlugin: Plugin = { config: {
  name: "kitty",
  displayName: "Kitty",
  description: "Terminal GPU-accelerated con soporte de imágenes y configuración profunda",
  icon: "layers",
  filePatterns: ["kitty.conf"],
  configPaths: ["~/.config/kitty/"],
}, validate, getSuggestions };
