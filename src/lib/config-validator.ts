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
  "waybar": validateWaybar,
  "kitty": validateKitty,
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
  "swaync": validateSwaync,
  "yazi": () => [],  // Yazi uses complex inline tables, skip validation
  "wlogout": validateWlogout,
  "lazygit": validateToml,
  "bat": validateKeyValue,
  "eza": () => [],
  "wallust": validateToml,
};

// ===== HYPRLAND =====
const hyprlandTopLevel = new Set([
  "bind", "bindm", "bindd", "binde", "bindr", "bindld", "bindl",
  "monitor", "workspace", "windowrule", "windowrulev2", "layerrule",
  "exec", "exec-once", "execp", "execr",
  "env", "envd", "source", "submap", "plugin",
  "gesture",
]);

const hyprlandBlockDirectives = new Set([
  "general", "decoration", "animations", "dwindle", "master",
  "misc", "input", "device", "cursor", "debug", "notifications",
  "group", "ecosystem", "xwayland", "gestures",
]);

const hyprlandSubDirectives: Record<string, Set<string>> = {
  "general": new Set([
    "gaps_in", "gaps_out", "border_size", "col.active_border", "col.inactive_border",
    "col.noscreen_border", "col.group_border", "col.group_border_active",
    "resize_on_border", "allow_tearing", "layout", "no_focus_fallback",
    "extend_border_grab_area", "hover_icon", "no_border_on_floating",
  ]),
  "decoration": new Set([
    "rounding", "rounding_power", "active_opacity", "inactive_opacity",
    "fullscreen_opacity", "shadow_range", "shadow_render_power",
    "shadow_color", "col.shadow",
    "dim_active", "dim_strength", "dim_inactive",
    "screen_shader", "force_round_corners",
  ]),
  "animations": new Set([
    "enabled",
  ]),
  "dwindle": new Set([
    "pseudotile", "force_split", "preserve_split", "no_gaps_when_only",
    "no_window_splitting", "split_width_multiplier", "default_split_ratio",
    "single_window_width_multiplier", "smart_split", "smart_resizing",
    "permanent_direction_override",
  ]),
  "master": new Set([
    "new_status", "new_float", "no_gaps_when_only", "default_master_area_size",
    "master_width_factor", "allow_small_split", "orientation",
    "inherit_fullscreen",
  ]),
  "misc": new Set([
    "force_default_wallpaper", "disable_hyprland_logo", "disable_splash_rendering",
    "vfr", "vrr", "mouse_move_enables_dpms", "key_press_enables_dpms",
    "cursor_hide_on_touch", "no_direct_scanout", "no_hardware_cursor",
    "bg_color", "close_on_last_float", "drop_group_interval",
    "render_ahead_of_time", "render_ahead_safezone", "allow_session_lock_restore",
    "lockscreen_enable_gestures", "middle_click_paste",
  ]),
  "input": new Set([
    "kb_layout", "kb_variant", "kb_model", "kb_options", "kb_rules",
    "kb_file", "follow_mouse", "sensitivity", "accel_profile", "force_profile",
    "left_handed", "scroll_method", "scrollpoints", "natural_scroll",
    "touchpad", "tablet", "touchdevice",
  ]),
  "device": new Set([
    "name", "sensitivity", "accel_profile", "left_handed",
    "scroll_method", "scrollpoints", "natural_scroll",
    "touchpad", "output", "transform",
  ]),
  "cursor": new Set([
    "no_hardware_cursors", "no_hardware_cursor", "no_break_fullscreen",
  ]),
  "debug": new Set([
    "overlay", "damage_blink", "damage_tracking",
    "damage_debug", "disable_logging",
  ]),
  "notifications": new Set([
    "enabled", "gtk_notifications", "notification_fire_timeout",
    "notification_window_size", "show_on_gray",
  ]),
  "group": new Set([
    "groupbar", "insert_after_current",
  ]),
  "ecosystem": new Set([
    "no_update", "no_telecharger",
  ]),
  "xwayland": new Set([
    "force_zero_scaling", "use_nearest_neighbor",
  ]),
  "gestures": new Set([
    "workspace_swipe", "workspace_swipe_fingers",
    "workspace_swipe_invert", "workspace_swipe_use_r",
    "workspace_swipe_direction_lock", "workspace_swipe_direction_lock_threshold",
    "workspace_swipe_cancel_ratio", "workspace_swipe_min_speed_to_force",
    "workspace_swipe_px_threshold", "workspace_swipe_touch",
    "workspace_swipe_cancel_touch",
  ]),
  "touchpad": new Set([
    "natural_scroll", "disable_while_typing", "clickfinger_behavior",
    "tap-to-click", "tap_button_map",
    "drag_lock", "tap_and_drag", "middle_emulation",
    "scroll_factor", "horizontal_scroll", "touchscreen",
    "hover_factor", "pressfinger_threshold",
  ]),
  "groupbar": new Set([
    "enabled", "font_family", "font_size", "font_weight",
    "menu_position", "indicator_position", "indicator_gap",
    "indicator_padding", "indicator_width",
    "col.active", "col.inactive", "col.active_border",
    "col.inactive_border", "urgency_critical", "urgency_low",
    "urgency_normal", "render_text", "scrolling",
  ]),
  "submap": new Set([
    "bind", "bindm", "bindd", "binde", "bindr", "bindld", "bindl",
  ]),
};

function validateHyprland(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let braceCount = 0;
  const blockStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    // Process character by character to handle } block { correctly
    let j = 0;
    while (j < line.length) {
      if (line[j] === "#") break; // Comment rest of line

      if (line[j] === "{") {
        braceCount++;
        // Find what block this brace belongs to
        const beforeBrace = line.substring(0, j).trim();
        const blockMatch = beforeBrace.match(/(\w[\w-]*)\s*$/);
        if (blockMatch && hyprlandBlockDirectives.has(blockMatch[1])) {
          blockStack.push(blockMatch[1]);
        } else if (blockMatch && blockMatch[1] !== "source") {
          // Could be a sub-block like "blur {" inside "decoration {"
          blockStack.push(blockMatch[1]);
        }
        j++;
      } else if (line[j] === "}") {
        braceCount--;
        if (blockStack.length > 0) blockStack.pop();
        j++;
      } else {
        j++;
      }
    }

    // Validate the directive
    const directiveMatch = line.match(/^(\w[\w-]*)/);
    if (!directiveMatch) continue;
    const directive = directiveMatch[1];

    // Check if this is a bind line
    const isBind = /^bind[mdde]*\b/.test(line);
    if (isBind) {
      const bindMatch = line.match(/^bind[mdde]*\s*=\s*(.+)$/);
      if (bindMatch) {
        const parts = bindMatch[1].split(",").map(s => s.trim());
        const nonEmptyParts = parts.filter(p => p !== "");
        if (nonEmptyParts.length < 3) {
          errors.push({ line: lineNum, column: raw.indexOf("=") + 2, endColumn: raw.length + 1, message: `bind requires at least 3 args: MOD, KEY, DISPATCHER (got ${nonEmptyParts.length})`, severity: "error" });
        }
      }
      continue;
    }

    // Monitor validation
    if (directive === "monitor") {
      const monMatch = line.match(/^monitor\s*=\s*(.+)$/);
      if (monMatch) {
        const args = monMatch[1].split(",").map(s => s.trim());
        if (args.length < 3) {
          errors.push({ line: lineNum, column: raw.indexOf("=") + 2, endColumn: raw.length + 1, message: `monitor requires at least 3 args: NAME, RESOLUTION, POSITION`, severity: "error" });
        }
      }
      continue;
    }

    // Check if we're inside a block
    const currentBlock = blockStack.length > 0 ? blockStack[blockStack.length - 1] : null;

    if (currentBlock && line.includes("=")) {
      // We're inside a block, validate property
      const key = line.split("=")[0].trim();
      const parentDirectives = hyprlandSubDirectives[currentBlock];

      // Most sub-directive properties are valid even if not in our list
      // Only warn for truly unknown ones
      if (parentDirectives && !parentDirectives.has(key) && !key.startsWith("$")) {
        // Skip common properties that are always valid
        const alwaysValid = ["enabled", "on", "range", "size", "passes", "color",
          "vibrancy", "ignore_opacity", "xray", "popups", "render_power",
          "new_status", "pseudotile", "preserve_split", "force_split",
          "workspace_swipe", "natural_scroll", "sensitivity", "kb_layout",
          "follow_mouse", "accel_profile", "name", "output", "transform",
          "bezier", "animation", "shadow_range", "col.shadow",
          "active_opacity", "inactive_opacity", "fullscreen_opacity",
          "rounding", "rounding_power", "dim_active", "dim_strength",
          "gaps_in", "gaps_out", "border_size", "col.active_border", "col.inactive_border",
          "resize_on_border", "allow_tearing", "layout",
          "kb_variant", "kb_model", "kb_options", "kb_rules", "kb_file",
          "scroll_method", "touchpad", "natural_scroll",
          "lock_cmd", "before_sleep_cmd", "after_sleep_cmd", "ignore_dbus_inhibit",
          "on_delay", "timeout", "on_cmd", "off_cmd", "listener",
          "focus_on_activate", "no_direct_scanout", "render_ahead_of_time",
          "force_default_wallpaper", "disable_hyprland_logo", "disable_splash_rendering",
          "vfr", "vrr", "mouse_move_enables_dpms", "key_press_enables_dpms"];
        if (!alwaysValid.includes(key)) {
          errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Unknown property "${key}" inside "${currentBlock}"`, severity: "warning" });
        }
      }
      continue;
    }

    // Top-level directive check
    // Skip if line contains { — it's a block opening (blur {, shadow {, etc.)
    if (!hyprlandTopLevel.has(directive) && !hyprlandBlockDirectives.has(directive) &&
        directive !== "bezier" && !directive.startsWith("$") && !line.includes("=") && !line.includes("{")) {
      errors.push({ line: lineNum, column: 1, endColumn: directive.length + 1, message: `Unknown directive "${directive}"`, severity: "warning" });
    }
  }

  if (braceCount < 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Unmatched closing brace '}'`, severity: "error" });
  } else if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }

  return errors;
}

// ===== WAYBAR (JSON or CSS) =====
function validateWaybar(content: string): ConfigError[] {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return validateJsonLike(content);
  }
  return validateCss(content);
}

// ===== CSS =====
function stripCssComments(content: string): string {
  // Remove multi-line /* */ comments
  let result = "";
  let inComment = false;
  for (let i = 0; i < content.length; i++) {
    if (inComment) {
      if (content[i] === "*" && content[i + 1] === "/") {
        inComment = false;
        i++; // skip /
      }
    } else {
      if (content[i] === "/" && content[i + 1] === "*") {
        inComment = true;
        i++; // skip *
      } else {
        result += content[i];
      }
    }
  }
  return result;
}

function validateCss(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const cleaned = stripCssComments(content);
  const lines = cleaned.split("\n");
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line) continue;

    // Skip pure comment lines (already stripped, but just in case)
    if (line.startsWith("//")) continue;

    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
    }

    if (braceCount < 0) {
      errors.push({ line: lineNum, column: 1, endColumn: 2, message: "Unexpected closing brace '}'", severity: "error" });
      braceCount = 0;
    }

    // Skip CSS at-rules
    if (line.startsWith("@define-color") || line.startsWith("@import") ||
        line.startsWith("@keyframes") || line.startsWith("@media") ||
        line.startsWith("@font-face") || line.startsWith("@supports") ||
        line.startsWith("@")) continue;

    // Check for missing semicolons in property lines
    if (braceCount > 0 && line.includes(":") && !line.endsWith("{") && !line.endsWith(",")) {
      const propMatch = line.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
      if (propMatch) {
        const prop = propMatch[1];
        const val = propMatch[2];
        if (val && !line.endsWith(";") && !line.endsWith("{")) {
          // Only warn if it looks like a real property (not a selector)
          if (!prop.includes(" ") && !prop.startsWith("#") && !prop.startsWith(".") && !prop.startsWith("&")) {
            errors.push({ line: lineNum, column: line.length, endColumn: line.length + 1, message: `Property "${prop}" not terminated with ';'`, severity: "warning" });
          }
        }
      }
    }
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }

  return errors;
}

// ===== KITTY =====
function validateKitty(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");

  // Valid kitty config keys (comprehensive list)
  const validKeys = new Set([
    "font_family", "bold_font", "italic_font", "bold_italic_font",
    "font_size", "modify_font", " bold", " italic", " bold_italic",
    "foreground", "background", "selection_foreground", "selection_background",
    "cursor", "cursor_text_color", "cursor_color",
    "url_color", "mark1_foreground", "mark1_background",
    "mark2_foreground", "mark2_background", "mark3_foreground", "mark3_background",
    "active_border_color", "inactive_border_color",
    "active_tab_foreground", "active_tab_background", "active_tab_font_style",
    "inactive_tab_foreground", "inactive_tab_background", "inactive_tab_font_style",
    "tab_bar_background", "tab_bar_margin_color",
    "wayland_titlebar_color", "macos_titlebar_color",
    "background_opacity", "background_blur", "dynamic_background_opacity",
    "dim_opacity", "active_tab_dimness",
    "confirm_os_window_close", "hide_window_decorations",
    "enabled_layouts", "window_padding_width", "single_window_margin_width",
    "adjust_column_width", "adjust_line_height",
    "placement_strategy", "initial_window_width", "initial_window_height",
    "remember_window_size", "center", "startup_session",
    "shell_integration", "allow_remote_control",
    "listen_on", "env", "exe_search_path",
    "clipboard_control", "clipboard_paste_write_protected", "strip_trailing_spaces",
    "wheel_scroll_multiplier", "touch_scroll_multiplier",
    "mouse_hide_wait", "url_style", "open_url_with",
    "copy_on_select", "select_by_word_characters",
    "bell_path", "enable_audio_bell", "visual_bell_duration",
    "visual_bell_position", "visual_bell_color", "visual_bell_move",
    "window_alert_on_bell", "command_on_bell",
    "scrollback_lines", "scrollback_pager", "scrollback_pager_history_size",
    "scrollback_fill_enlarged_window", "wheel_scroll_min_lines",
    "audio_pitch_medium", "audio_pitch_high",
    "repaint_delay", "input_delay", "sync_to_monitor",
    "watcher", "signal",
    "action_alias",
    "tab_bar_edge", "tab_bar_style", "tab_powerline_style",
    "tab_title_template", "active_tab_title_template",
    "use_system_colors", "force_ltr",
    "text_composition_strategy",
    // Colors
    "color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7",
    "color8", "color9", "color10", "color11", "color12", "color13", "color14", "color15",
    // Theme include
    "include", "glob_include", "active_tab_title_template",
    "background_tint", "symbol_map", "notify_on_cmd_finish",
    "window_margin_width", "single_window_margin_width",
    "tab_bar_edge", "tab_bar_style", "tab_powerline_style",
    "tab_title_template", "active_tab_title_template",
    "use_system_colors", "force_ltr", "text_composition_strategy",
    "wayland_titlebar_color", "macos_titlebar_color",
    "shell_integration", "allow_remote_control",
    "clipboard_control", "clipboard_paste_write_protected",
    "strip_trailing_spaces", "wheel_scroll_multiplier",
    "touch_scroll_multiplier", "mouse_hide_wait",
    "url_style", "open_url_with", "copy_on_select",
    "select_by_word_characters", "bell_path", "enable_audio_bell",
    "visual_bell_duration", "visual_bell_position", "visual_bell_color",
    "window_alert_on_bell", "command_on_bell",
    "scrollback_lines", "scrollback_pager", "scrollback_pager_history_size",
    "repaint_delay", "input_delay", "sync_to_monitor",
    "initial_window_width", "initial_window_height", "remember_window_size",
    "center", "startup_session", "enabled_layouts",
    "modify_font", "bold_font", "italic_font", "bold_italic_font",
    "font_size", "font_family",
    "mark1_foreground", "mark1_background", "mark2_foreground", "mark2_background",
    "mark3_foreground", "mark3_background",
    "active_border_color", "inactive_border_color",
    "url_color", "cursor_color", "selection_foreground", "selection_background",
    "background_blur", "dynamic_background_opacity", "adjust_column_width", "adjust_line_height",
    "placement_strategy", "hide_window_decorations",
    "action_alias",
    "bell_border_color", "cursor_trail_color", "cursor_trail_length",
    "cursor_trail_start_threshold", "cursor_trail_end_threshold",
    "bond_font", "background_tint",
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    if (line.includes(" ")) {
      const idx = line.indexOf(" ");
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();

      if (!key) continue;

      // Check for key with extra whitespace (like "font_family      family")
      if (/\s{2,}/.test(key)) {
        // This is probably "font_family <actual_key>" pattern - skip
        continue;
      }

      if (!validKeys.has(key) && !key.startsWith("map ") && !key.startsWith("mouse_map ") &&
          !key.startsWith("action_alias") && !key.startsWith("receive_shell_integration")) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Unknown kitty option "${key}"`, severity: "warning" });
      }
    }
  }

  return errors;
}

// ===== KEY-VALUE =====
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

      if (/\s/.test(key) && !key.startsWith("#")) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Key "${key}" contains whitespace`, severity: "error" });
      }

      if (!value && !key.startsWith("#")) {
        errors.push({ line: lineNum, column: idx + 2, endColumn: line.length + 1, message: `Empty value for key "${key}"`, severity: "warning" });
      }
    }
  }

  return errors;
}

// ===== TOML =====
function validateToml(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#")) continue;

    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
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

      if (key.includes(" ") && !key.startsWith('"') && !key.startsWith("'")) {
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
      // Skip inline tables { ... } - they're valid TOML
    }
  }

  return errors;
}

// ===== JSON/JSONC =====
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
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }
  if (bracketCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${bracketCount} closing bracket(s) ']'`, severity: "error" });
  }

  return errors;
}

// ===== SWAYNC (JSON with CSS-style comments) =====
function validateSwaync(content: string): ConfigError[] {
  // Swaync config is JSON but may have trailing commas
  return validateJsonLike(content);
}

// ===== ROFI (.rasi) =====
function validateRofi(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let braceCount = 0;
  let parenCount = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    const lineNum = i + 1;

    // Handle block comments
    if (inBlockComment) {
      if (line.includes("*/")) {
        inBlockComment = false;
        line = line.substring(line.indexOf("*/") + 2).trim();
      } else {
        continue;
      }
    }
    if (line.startsWith("/*")) {
      if (line.includes("*/")) {
        line = line.substring(line.indexOf("*/") + 2).trim();
      } else {
        inBlockComment = true;
        continue;
      }
    }

    if (!line || line.startsWith("//")) continue;

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
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }
  if (parenCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${parenCount} closing parenthesis(es)`, severity: "error" });
  }

  return errors;
}

// ===== LUA =====
function validateLua(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");
  let blockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("--")) continue;

    // Skip lines inside strings
    if (line.startsWith('"') && line.endsWith('"')) continue;
    if (line.startsWith("'") && line.endsWith("'")) continue;
    if (line.startsWith("[[") || line.startsWith("[")) continue;

    // Count block openers
    if (/\bfunction\b/.test(line)) blockCount++;
    if (/\bif\b/.test(line) && /\bthen\b/.test(line)) blockCount++;
    if (/\bfor\b/.test(line) && /\bdo\b/.test(line)) blockCount++;
    if (/\bwhile\b/.test(line) && /\bdo\b/.test(line)) blockCount++;
    if (/\brepeat\b/.test(line)) blockCount++;

    // Count block closers
    if (/\bend\b/.test(line)) {
      // Make sure "end" is actually a block end, not part of a word like "send" or "rend"
      if (/\bend\b/.test(line) && !/\b(friend|send|rend|blend|append|depend|suspend|defend|amend)\b/.test(line)) {
        if (blockCount > 0) blockCount--;
      }
    }
    if (/\buntil\b/.test(line) && blockCount > 0) blockCount--;

    // Check unclosed parens in function calls (only single-line)
    // Multi-line function calls are common in Lua and not errors
    if (line.includes("require(") || line.includes("vim.cmd(") || line.includes("vim.keymap.set(") ||
        line.includes("vim.api.") || line.includes("vim.lsp.")) {
      const unclosedParen = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      // Only flag if the line ends with a closing paren or semicolon (single-line call)
      if (unclosedParen > 0 && (line.endsWith(")") || line.endsWith(");") || line.endsWith(","))) {
        // This is fine — multi-line call
      } else if (unclosedParen > 0 && !line.endsWith(",") && !line.endsWith("{") && !line.endsWith("(")) {
        errors.push({ line: lineNum, column: line.length - 1, endColumn: line.length + 1, message: "Unclosed parenthesis", severity: "error" });
      }
    }
  }

  if (blockCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${blockCount} 'end' keyword(s)`, severity: "error" });
  }

  return errors;
}

// ===== SHELL (bash/zsh) =====
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
  }

  if (ifCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${ifCount} 'fi' keyword(s)`, severity: "error" });
  if (forCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${forCount} 'done' keyword(s)`, severity: "error" });
  if (whileCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${whileCount} 'done' keyword(s)`, severity: "error" });
  if (caseCount > 0) errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${caseCount} 'esac' keyword(s)`, severity: "error" });

  return errors;
}

// ===== FISH =====
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
  }

  if (blockCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${blockCount} 'end' keyword(s)`, severity: "error" });
  }

  return errors;
}

// ===== DUNST =====
function validateDunst(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith(";") || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
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

// ===== TMUX =====
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

// ===== INI =====
function validateIni(content: string): ConfigError[] {
  const errors: ConfigError[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) continue;

    if (line.includes("=")) {
      const idx = line.indexOf("=");
      const key = line.substring(0, idx).trim();

      if (!key) {
        errors.push({ line: lineNum, column: 1, endColumn: idx + 1, message: "Empty key", severity: "error" });
      }

      if (key.includes(" ")) {
        errors.push({ line: lineNum, column: 1, endColumn: key.length + 1, message: `Key "${key}" contains spaces`, severity: "error" });
      }
    }
  }

  return errors;
}

// ===== HYPRLOCK =====
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

// ===== EWW =====
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

// ===== WLOGOUT =====
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
  }

  if (braceCount > 0) {
    errors.push({ line: lines.length, column: 1, endColumn: 2, message: `Missing ${braceCount} closing brace(s) '}'`, severity: "error" });
  }

  return errors;
}

// ===== ENTRY POINT =====
export function validateConfig(filename: string, content: string, fullPath?: string): ConfigError[] {
  const lower = filename.toLowerCase();
  const pathLower = (fullPath || filename).toLowerCase();

  // Skip binary files
  const binaryExts = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp", ".mp3", ".mp4", ".wav", ".ogg", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar", ".exe", ".dll", ".so", ".dylib", ".frag", ".vert", ".glsl", ".md", ".txt", ".sample", ".js", ".ts", ".scss", ".less"];
  if (binaryExts.some(ext => lower.endsWith(ext))) return [];

  let pluginName: string | null = null;

  // First try matching by plugin name in filename
  for (const key of Object.keys(validators)) {
    if (lower.includes(key)) {
      pluginName = key;
      break;
    }
  }

  // If no match, try matching by plugin name in path segments (not repo name)
  // Only check the config directory part (e.g., ".config/hypr", ".config/kitty")
  if (!pluginName) {
    // Extract config directory segments from path
    const pathParts = pathLower.split(/[/\\]/);
    for (const key of Object.keys(validators)) {
      // Check if any path segment matches the plugin name
      if (pathParts.some(part => part === key || part.startsWith(key + "/") || part.startsWith(key + "\\"))) {
        pluginName = key;
        break;
      }
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
    else if (lower.endsWith(".conf") && (lower.includes("hypr") || lower.includes("kitty"))) {
      // Only match .conf to specific known tools
      pluginName = lower.includes("kitty") ? "kitty" : "hyprland";
    }
    else if (lower.endsWith(".conf")) {
      // Other .conf files: check if they look like hyprland config
      if (content.includes("bind") && content.includes("=") && (content.includes("monitor") || content.includes("decoration") || content.includes("general"))) {
        pluginName = "hyprland";
      }
      // Otherwise skip validation for unknown .conf files
    }
    else if (lower.endsWith(".rc") || lower.endsWith(".zshrc") || lower.endsWith(".bashrc")) pluginName = "bash";
    else if (lower.endsWith(".fish")) pluginName = "fish";
  }

  if (!pluginName || !validators[pluginName]) return [];

  return validators[pluginName](content);
}
