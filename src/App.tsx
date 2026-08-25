import React, { useEffect, useState, useCallback, useRef, Component, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { initPlugins } from "@/lib/plugins";
import { useAppStore, type FileNode } from "@/stores/app-store";
import { useThemeStore } from "@/stores/theme-store";
import { useThemeConfigStore, DEFAULT_THEME_TOML } from "@/stores/theme-config-store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { Check, FolderOpen, X, Settings, FileText } from "lucide-react";
import { AnimatedBackground } from "@/components/backgrounds/AnimatedBackground";

function reportError(msg: string) {
  try { localStorage.setItem("riceboard:last-error", msg); } catch {}
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: "" };
  static getDerivedStateFromError(err: Error) {
    const msg = `${err.message}\n\n${err.stack || ""}`;
    reportError(`ErrorBoundary: ${msg}`);
    return { hasError: true, error: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <span className="text-xl font-bold text-violet-400">R</span>
            </div>
            <h1 className="text-lg font-semibold">Algo salio mal</h1>
            <p className="text-sm text-muted-foreground">{this.state.error}</p>
            <Button onClick={() => { this.setState({ hasError: false, error: "" }); window.location.reload(); }}>
              Recargar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const pluginOptions = [
  { id: "hyprland", label: "Hyprland", desc: "Window manager", checked: true },
  { id: "waybar", label: "Waybar", desc: "Status bar", checked: true },
  { id: "kitty", label: "Kitty", desc: "Terminal", checked: true },
  { id: "rofi", label: "Rofi", desc: "App launcher", checked: true },
  { id: "neovim", label: "Neovim", desc: "Text editor", checked: true },
  { id: "zsh", label: "Zsh", desc: "Shell", checked: true },
  { id: "mako", label: "Mako", desc: "Notifications", checked: true },
  { id: "tmux", label: "Tmux", desc: "Multiplexer", checked: false },
  { id: "btop", label: "Btop", desc: "System monitor", checked: false },
  { id: "swww", label: "SWWW", desc: "Wallpaper daemon", checked: false },
];

function VaultSetupDialog() {
  const setupDialogOpen = useAppStore((s) => s.setupDialogOpen);
  const setSetupDialogOpen = useAppStore((s) => s.setSetupDialogOpen);
  const pendingVaultPath = useAppStore((s) => s.pendingVaultPath);
  const setPendingVaultPath = useAppStore((s) => s.setPendingVaultPath);
  const setActiveVaultPath = useAppStore((s) => s.setActiveVaultPath);
  const setFileTree = useAppStore((s) => s.setFileTree);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string[]>([]);
  const [existing, setExisting] = useState<Record<string, string[]>>({});
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (setupDialogOpen && pendingVaultPath) {
      const initial: Record<string, boolean> = {};
      pluginOptions.forEach((p) => { initial[p.id] = p.checked; });
      setSelected(initial);
      setCreated([]);
      setChecking(true);
      invoke<Record<string, string[]>>("check_vault_structure", { vaultPath: pendingVaultPath })
        .then((result) => {
          setExisting(result || {});
          const next: Record<string, boolean> = {};
          pluginOptions.forEach((p) => {
            next[p.id] = p.checked && !result?.[p.id];
          });
          setSelected(next);
        })
        .catch(() => setExisting({}))
        .finally(() => setChecking(false));
    }
  }, [setupDialogOpen, pendingVaultPath]);

  const handleCreate = useCallback(async () => {
    if (!pendingVaultPath) return;
    setCreating(true);
    try {
      const plugins = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      const result = await invoke<string[]>("setup_vault", { vaultPath: pendingVaultPath, plugins });
      setCreated(result);
      setActiveVaultPath(pendingVaultPath);
      const tree = await invoke<FileNode[]>("scan_directory", { path: pendingVaultPath });
      setFileTree(tree);
    } catch (err) {
      console.error("Setup error:", err);
    }
    setCreating(false);
  }, [pendingVaultPath, selected, setActiveVaultPath, setFileTree]);

  const handleSkip = useCallback(async () => {
    if (!pendingVaultPath) return;
    setActiveVaultPath(pendingVaultPath);
    const tree = await invoke<FileNode[]>("scan_directory", { path: pendingVaultPath });
    setFileTree(tree);
    setSetupDialogOpen(false);
    setPendingVaultPath(null);
  }, [pendingVaultPath, setActiveVaultPath, setFileTree, setSetupDialogOpen, setPendingVaultPath]);

  const handleClose = useCallback(() => {
    setSetupDialogOpen(false);
    setPendingVaultPath(null);
    setCreated([]);
  }, [setSetupDialogOpen, setPendingVaultPath]);

  if (!setupDialogOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-background border rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Configurar vault</h2>
                <p className="text-xs text-muted-foreground">
                  {pendingVaultPath?.split(/[/\\]/).pop()}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              {checking ? "Detectando estructura existente..." : "Plugins con existing configs estan marcados en verde. Solo se crean los que falten."}
            </p>

            {created.length > 0 ? (
              <div className="space-y-1.5 mb-4">
                <p className="text-xs font-medium text-green-400 mb-2">Archivos creados:</p>
                {created.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-400" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 mb-4 max-h-60 overflow-auto">
                {pluginOptions.map((plugin) => {
                  const hasExisting = existing[plugin.id]?.length > 0;
                  return (
                    <button
                      key={plugin.id}
                      onClick={() => setSelected((s) => ({ ...s, [plugin.id]: !s[plugin.id] }))}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all duration-150 ${
                        selected[plugin.id]
                          ? "border-violet-500/50 bg-violet-500/10"
                          : hasExisting
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-border hover:bg-accent/50"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                        selected[plugin.id] ? "bg-violet-500 border-violet-500" : hasExisting ? "bg-green-500/20 border-green-500/50" : "border-muted-foreground/30"
                      }`}>
                        {selected[plugin.id] && <Check className="h-3 w-3 text-white" />}
                        {hasExisting && !selected[plugin.id] && <span className="text-[8px] text-green-400">&#10003;</span>}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium">{plugin.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {hasExisting ? (
                            <span className="text-green-400/80">Ya existe ({existing[plugin.id].length} archivos)</span>
                          ) : plugin.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <Button variant="ghost" size="sm" onClick={handleSkip} disabled={creating}>
              {created.length > 0 ? "Cerrar" : "Saltar"}
            </Button>
            {created.length === 0 && (
              <Button size="sm" onClick={handleCreate} disabled={creating}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white">
                {creating ? "Creando..." : "Crear estructura"}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SettingsDialog() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const fontSizeOverrides = useAppStore((s) => s.fontSizeOverrides);
  const setFontSizeOverride = useAppStore((s) => s.setFontSizeOverride);
  const resetFontSizeOverrides = useAppStore((s) => s.resetFontSizeOverrides);
  const enabledPlugins = useAppStore((s) => s.enabledPlugins);
  const togglePlugin = useAppStore((s) => s.togglePlugin);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const backgroundPattern = useAppStore((s) => s.backgroundPattern);
  const setBackgroundPattern = useAppStore((s) => s.setBackgroundPattern);
  const backgroundOpacity = useAppStore((s) => s.backgroundOpacity);
  const setBackgroundOpacity = useAppStore((s) => s.setBackgroundOpacity);
  const themeConfigStore = useThemeConfigStore();
  const [themeToml, setThemeToml] = useState(themeConfigStore.rawToml || DEFAULT_THEME_TOML);
  const [themeSaved, setThemeSaved] = useState(false);

  const simulationPlugins = [
    "hyprland", "waybar", "kitty", "rofi", "neovim", "mako", "btop",
    "alacritty", "ghostty", "dunst", "foot", "fuzzel", "wofi",
    "swaync", "cava", "eww", "starship", "fastfetch", "yazi",
  ];

  if (!settingsOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setSettingsOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-background border rounded-xl shadow-2xl w-[560px] max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                <Settings className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{t("settings.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("settings.subtitle")}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSettingsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-6 overflow-auto max-h-[65vh]">
            {/* Language */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("settings.language")}</h3>
              <div className="flex gap-2">
                {(["en", "es"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-4 py-1.5 rounded-lg border text-xs transition-all ${
                      language === lang
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    {lang === "en" ? "English" : "Espanol"}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("settings.theme")}</h3>
              <div className="flex gap-2">
                {(["dark", "light", "system"] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    className={`px-4 py-1.5 rounded-lg border text-xs transition-all ${
                      theme === th
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    {t(`settings.theme.${th}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size Sliders */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.fontSizes")}</h3>
                {Object.keys(fontSizeOverrides).length > 0 && (
                  <button onClick={resetFontSizeOverrides} className="text-[10px] text-violet-400 hover:text-violet-300">{t("settings.fontSizes.reset")}</button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">{t("settings.fontSizes.desc")}</p>
              <div className="space-y-2.5 max-h-48 overflow-auto pr-1">
                {simulationPlugins.map((plugin) => {
                  const currentSize = fontSizeOverrides[plugin] || 11;
                  return (
                    <div key={plugin} className="flex items-center gap-3">
                      <span className="text-xs w-24 shrink-0 truncate">{plugin}</span>
                      <input
                        type="range"
                        min={6}
                        max={20}
                        value={currentSize}
                        onChange={(e) => setFontSizeOverride(plugin, parseInt(e.target.value))}
                        className="flex-1 h-1 accent-violet-500 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={6}
                        max={20}
                        value={currentSize}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 6 && v <= 20) setFontSizeOverride(plugin, v);
                        }}
                        className="w-12 px-1.5 py-0.5 rounded border bg-background text-xs text-center outline-none focus:border-violet-500/50"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Plugins */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("settings.activePlugins")}</h3>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-auto">
                {Object.entries(enabledPlugins).map(([name, enabled]) => (
                  <button
                    key={name}
                    onClick={() => togglePlugin(name)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all text-left ${
                      enabled
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${enabled ? "bg-green-400" : "bg-red-400"}`} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Background</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["none", "glyph", "hexfloat", "blaze"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setBackgroundPattern(p)}
                    className={`px-3 py-2 rounded-lg border text-xs transition-all capitalize ${
                      backgroundPattern === p
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-400"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Opacity</span>
                  <span className="text-xs text-muted-foreground">{backgroundOpacity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={backgroundOpacity}
                  onChange={(e) => setBackgroundOpacity(parseInt(e.target.value))}
                  className="w-full h-1 accent-violet-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Theme Config */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme Config</h3>
                {themeConfigStore.configPath && (
                  <span className="text-[9px] text-muted-foreground/50 font-mono truncate max-w-[280px]">{themeConfigStore.configPath}</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">
                Customize colors and fonts. No file exists yet — edit and click "Save & Apply" to create one.
                Existing CSS defaults are untouched until you save.
              </p>
              <textarea
                value={themeToml}
                onChange={(e) => { setThemeToml(e.target.value); setThemeSaved(false); }}
                className="w-full h-48 rounded-lg border bg-card p-3 font-mono text-[11px] text-foreground resize-none outline-none focus:border-violet-500/50"
                spellCheck={false}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={async () => {
                    await themeConfigStore.saveConfig(themeToml);
                    setThemeSaved(true);
                    setTimeout(() => setThemeSaved(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-medium hover:bg-violet-500/25 transition-colors"
                >
                  {themeSaved ? "Saved!" : "Save & Apply"}
                </button>
                <button
                  onClick={async () => {
                    await themeConfigStore.loadConfig();
                    setThemeToml(themeConfigStore.rawToml || DEFAULT_THEME_TOML);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-accent/50 transition-colors"
                >
                  Reload from disk
                </button>
                <button
                  onClick={() => setThemeToml(DEFAULT_THEME_TOML)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-accent/50 transition-colors"
                >
                  Reset defaults
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 border-t">
            <Button size="sm" onClick={() => setSettingsOpen(false)}>{t("settings.close")}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const pluginTemplates: Record<string, { label: string; filename: string; content: string }> = {
  hyprland: { label: "Hyprland", filename: "hyprland.conf", content: `# Hyprland configuration\nmonitor=, preferred, auto, 1\n\ngeneral {\n    gaps_in = 5\n    gaps_out = 10\n    border_size = 2\n    col.active_border = rgba(cba6f7ff)\n    col.inactive_border = rgba(454759ff)\n    layout = dwindle\n}\n\ndecoration {\n    rounding = 8\n    blur {\n        enabled = true\n        size = 3\n        passes = 1\n    }\n}\n\nanimations {\n    enabled = true\n}\n\nbind = SUPER, Return, exec, kitty\nbind = SUPER, Q, killactive\nbind = SUPER, M, exit\nbind = SUPER, V, togglefloating\nbind = SUPER, J, togglesplit\n` },
  kitty: { label: "Kitty", filename: "kitty.conf", content: `# Kitty configuration\nfont_family      monospace\nfont_size         12.0\nbackground        #1e1e2e\nforeground        #cdd6f4\ncursor            #f5e0dc\nselection_background #45475a\nbackground_opacity 1.0\nwindow_padding_width 0\n\ncolor0 #45475a\ncolor1 #f38ba8\ncolor2 #a6e3a1\ncolor3 #f9e2af\ncolor4 #89b4fa\ncolor5 #cba6f7\ncolor6 #94e2d5\ncolor7 #bac2de\ncolor8 #585b70\ncolor9 #f38ba8\ncolor10 #a6e3a1\ncolor11 #f9e2af\ncolor12 #89b4fa\ncolor13 #cba6f7\ncolor14 #94e2d5\ncolor15 #a6adc8\n` },
  waybar: { label: "Waybar", filename: "config.jsonc", content: `{\n  "position": "top",\n  "height": 32,\n  "spacing": 4,\n  "modules-left": ["hyprland/workspaces", "hyprland/window"],\n  "modules-center": ["clock"],\n  "modules-right": ["pulseaudio", "network", "battery", "tray"],\n  "clock": {\n    "format": "{:%H:%M}"\n  },\n  "battery": {\n    "format": "{capacity}%"\n  },\n  "network": {\n    "format-wifi": "{essid}"\n  }\n}` },
  rofi: { label: "Rofi", filename: "config.rasi", content: `/* Rofi configuration */\nconfiguration {\n    modi: "drun,run,filebrowser,window"\n    show-icons: true\n    icon-theme: "Papirus"\n    font: "monospace 12"\n}\n\n* {\n    bg: #1e1e2e;\n    fg: #cdd6f4;\n    accent: #cba6f7;\n}\n\nwindow {\n    width: 600px;\n    border-radius: 8px;\n    background-color: @bg;\n    border: 2px solid @accent;\n}` },
  neovim: { label: "Neovim", filename: "init.lua", content: `-- Bootstrap lazy.nvim\nlocal lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"\nif not vim.loop.fs_stat(lazypath) then\n  vim.fn.system({ "git", "clone", "https://github.com/folke/lazy.nvim.git", lazypath })\nend\nvim.opt.rtp:prepend(lazypath)\n\nrequire("lazy").setup({\n  "catppuccin/nvim",\n  "nvim-treesitter/nvim-treesitter",\n  "nvim-telescope/telescope.nvim",\n})\n\nvim.cmd("colorscheme catppuccin")\n` },
  zsh: { label: "Zsh", filename: ".zshrc", content: `# Zsh configuration\nZSH_THEME="robbyrussell"\n\nplugins=(git zsh-autosuggestions zsh-syntax-highlighting)\n\nsource $ZSH/oh-my-zsh.sh\n\nalias ll="ls -la"\nalias gs="git status"\nalias gp="git push"\n` },
  tmux: { label: "Tmux", filename: "tmux.conf", content: `# Tmux configuration\nset -g prefix C-a\nunbind C-b\nset -g mouse on\nset -g mode-keys vi\nset -g base-index 1\nsetw -g pane-base-index 1\n\n# Split panes\nbind | split-window -h\nbind - split-window -v\n\n# TPM\nset -g @plugin 'tmux-plugins/tpm'\nset -g @plugin 'tmux-plugins/tmux-sensible'\nrun '~/.tmux/plugins/tpm/tpm'\n` },
  dunst: { label: "Dunst", filename: "dunstrc", content: `[global]\n    monitor = 0\n    follow = mouse\n    width = 300\n    height = 300\n    origin = top-right\n    notification_limit = 5\n    progress_bar = true\n    indicate_hidden = yes\n    transparency = 0\n    corner_radius = 10\n    padding = 10\n    font = monospace 10\n    frame_width = 2\n    frame_color = "#cba6f7"\n    background = "#1e1e2e"\n    foreground = "#cdd6f4"\n    timeout = 5\n` },
  mako: { label: "Mako", filename: "config", content: `# Mako configuration\nwidth=350\nheight=100\nborder-radius=8\nbackground-color=#1e1e2ee6\ntext-color=#cdd6f4\nborder-color=#cba6f7\ndefault-timeout=5000\nmax-visible=5\nfont=monospace 10\n` },
};

function NewPluginDialog() {
  const newPluginDialogOpen = useAppStore((s) => s.newPluginDialogOpen);
  const setNewPluginDialogOpen = useAppStore((s) => s.setNewPluginDialogOpen);
  const activeVaultPath = useAppStore((s) => s.activeVaultPath);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const openTabs = useAppStore((s) => s.openTabs);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customFilename, setCustomFilename] = useState("");
  const [creating, setCreating] = useState(false);

  if (!newPluginDialogOpen) return null;

  const handleCreate = async () => {
    if (!activeVaultPath) return;
    const name = selectedTemplate || customName.trim();
    const filename = selectedTemplate ? pluginTemplates[selectedTemplate].filename : customFilename.trim();
    const content = selectedTemplate ? pluginTemplates[selectedTemplate].content : "";
    if (!name || !filename) return;
    setCreating(true);
    try {
      const folderPath = `${activeVaultPath}/${name}`;
      await invoke("create_folder", { vaultPath: activeVaultPath, name });
      await invoke("create_file", { vaultPath: folderPath, name: filename });
      if (content) {
        await invoke("write_file", { path: `${folderPath}/${filename}`, content });
      }
      await refreshFileTree();
      setNewPluginDialogOpen(false);
      setSelectedTemplate(null);
      setCustomName("");
      setCustomFilename("");
    } catch (err) {
      console.error("Error creating plugin:", err);
    }
    setCreating(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setNewPluginDialogOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-background border rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Crear nuevo plugin</h2>
                <p className="text-xs text-muted-foreground">Elige una plantilla o crea uno personalizado</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNewPluginDialogOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4 overflow-auto max-h-[60vh]">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Plantillas</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(pluginTemplates).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => { setSelectedTemplate(selectedTemplate === key ? null : key); setCustomName(""); setCustomFilename(""); }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      selectedTemplate === key
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <div className="text-xs font-medium">{tmpl.label}</div>
                    <div className="text-[10px] text-muted-foreground">{tmpl.filename}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personalizado</h3>
              <div className="space-y-2">
                <input
                  value={customName}
                  onChange={(e) => { setCustomName(e.target.value); setSelectedTemplate(null); }}
                  placeholder="Nombre del plugin (ej: my-theme)"
                  className="w-full px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-violet-500/50"
                />
                <input
                  value={customFilename}
                  onChange={(e) => { setCustomFilename(e.target.value); setSelectedTemplate(null); }}
                  placeholder="Nombre del archivo (ej: config.toml)"
                  className="w-full px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <Button variant="ghost" size="sm" onClick={() => setNewPluginDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || (!selectedTemplate && (!customName.trim() || !customFilename.trim()))}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white">
              {creating ? "Creando..." : "Crear plugin"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const restoreSession = useAppStore((s) => s.restoreSession);
  const backgroundPattern = useAppStore((s) => s.backgroundPattern);
  const backgroundOpacity = useAppStore((s) => s.backgroundOpacity);
  const didInit = useRef(false);

  useEffect(() => {
    window.onerror = (msg, src, line, col, err) => {
      const detail = `onerror: ${msg}\n${src}:${line}:${col}\n${err?.stack || ""}`;
      reportError(detail);
    };
    window.onunhandledrejection = (e) => {
      const detail = `unhandledrejection: ${e.reason}\n${e.reason?.stack || ""}`;
      reportError(detail);
    };
    if (didInit.current) return;
    didInit.current = true;
    initPlugins();
    restoreSession();
    useThemeConfigStore.getState().loadConfig().then(() => {
      const cfg = useThemeConfigStore.getState();
      if (cfg.config) cfg.applyTheme();
    });
  }, []);

  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  useEffect(() => {
    const cfg = useThemeConfigStore.getState();
    if (cfg.loaded && cfg.config) cfg.applyTheme();
  }, [resolvedTheme]);

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <div className="h-screen flex flex-col overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
          <TitleBar />
          <div className="flex-1 flex min-h-0">
            <Sidebar />
            <main className="flex-1 flex min-h-0 relative">
              <AnimatedBackground pattern={backgroundPattern} opacity={backgroundOpacity} />
              <CodeEditor />
              <PreviewPanel />
            </main>
          </div>
          <CommandPalette />
          <VaultSetupDialog />
          <SettingsDialog />
          <NewPluginDialog />
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
