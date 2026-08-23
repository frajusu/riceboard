import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Settings,
  Sun,
  Moon,
  Monitor,
  FolderOpen,
  Clock,
  GitBranch,
  Layers,
  Terminal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useThemeStore } from "@/stores/theme-store";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { FileNode } from "@/stores/app-store";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

const pluginList = [
  "hyprland", "waybar", "kitty", "rofi", "neovim", "zsh", "mako", "tmux",
  "btop", "alacritty", "ghostty", "dunst", "foot", "fuzzel", "wofi",
  "swaync", "cava", "eww", "starship", "fastfetch", "yazi", "wlogout",
  "lazygit", "bat", "eza", "wallust", "hyprpaper", "hyprlock", "swww", "bash", "fish",
];

export function CommandPalette() {
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette);
  const setTheme = useThemeStore((s) => s.setTheme);
  const togglePreview = useAppStore((s) => s.togglePreview);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const previewOpen = useAppStore((s) => s.previewOpen);
  const setActiveSidebarSection = useAppStore((s) => s.setActiveSidebarSection);
  const setPendingVaultPath = useAppStore((s) => s.setPendingVaultPath);
  const setSetupDialogOpen = useAppStore((s) => s.setSetupDialogOpen);
  const setActiveVaultPath = useAppStore((s) => s.setActiveVaultPath);
  const setFileTree = useAppStore((s) => s.setFileTree);
  const fontSizeOverrides = useAppStore((s) => s.fontSizeOverrides);
  const setFontSizeOverride = useAppStore((s) => s.setFontSizeOverride);
  const resetFontSizeOverrides = useAppStore((s) => s.resetFontSizeOverrides);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setNewPluginDialogOpen = useAppStore((s) => s.setNewPluginDialogOpen);
  const showDesktop = useAppStore((s) => s.showDesktop);
  const toggleShowDesktop = useAppStore((s) => s.toggleShowDesktop);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleOpenVault = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Seleccionar vault de dotfiles" });
      if (selected) {
        const path = selected as string;
        setPendingVaultPath(path);
        setSetupDialogOpen(true);
      }
    } catch (err) {
      console.error("Error opening vault:", err);
    }
  };

  const buildFontSizeCommands = (): CommandItem[] => {
    const cmds: CommandItem[] = [];
    for (const plugin of pluginList) {
      const currentSize = fontSizeOverrides[plugin] || 12;
      cmds.push({
        id: `font-${plugin}-inc`,
        label: `${plugin}: aumentar font size`,
        description: `${currentSize} -> ${currentSize + 1}`,
        icon: <ZoomIn className="h-4 w-4" />,
        action: () => { setFontSizeOverride(plugin, currentSize + 1); toggleCommandPalette(); },
        category: "Font Size",
      });
      cmds.push({
        id: `font-${plugin}-dec`,
        label: `${plugin}: reducir font size`,
        description: `${currentSize} -> ${currentSize - 1}`,
        icon: <ZoomOut className="h-4 w-4" />,
        action: () => { setFontSizeOverride(plugin, Math.max(6, currentSize - 1)); toggleCommandPalette(); },
        category: "Font Size",
      });
    }
    cmds.push({
      id: "font-reset",
      label: "Reset all font sizes",
      icon: <RotateCcw className="h-4 w-4" />,
      action: () => { resetFontSizeOverrides(); toggleCommandPalette(); },
      category: "Font Size",
    });
    return cmds;
  };

  const commands: CommandItem[] = [
    {
      id: "open-vault",
      label: "Abrir vault",
      description: "Seleccionar carpeta de dotfiles",
      icon: <FolderOpen className="h-4 w-4" />,
      action: () => { handleOpenVault(); toggleCommandPalette(); },
      category: "Archivo",
    },
    {
      id: "theme-dark",
      label: "Tema oscuro",
      icon: <Moon className="h-4 w-4" />,
      action: () => { setTheme("dark"); toggleCommandPalette(); },
      category: "Apariencia",
    },
    {
      id: "theme-light",
      label: "Tema claro",
      icon: <Sun className="h-4 w-4" />,
      action: () => { setTheme("light"); toggleCommandPalette(); },
      category: "Apariencia",
    },
    {
      id: "theme-system",
      label: "Tema del sistema",
      icon: <Monitor className="h-4 w-4" />,
      action: () => { setTheme("system"); toggleCommandPalette(); },
      category: "Apariencia",
    },
    {
      id: "snapshots",
      label: "Ver snapshots",
      description: "Panel de snapshots en la barra lateral",
      icon: <Clock className="h-4 w-4" />,
      action: () => { setActiveSidebarSection("snapshots"); if (!sidebarOpen) toggleSidebar(); toggleCommandPalette(); },
      category: "Navegacion",
    },
    {
      id: "graph",
      label: "Ver grafo de relaciones",
      description: "Grafo de dependencias entre plugins",
      icon: <GitBranch className="h-4 w-4" />,
      action: () => { setActiveSidebarSection("graph"); if (!sidebarOpen) toggleSidebar(); toggleCommandPalette(); },
      category: "Navegacion",
    },
    {
      id: "plugins",
      label: "Gestionar plugins",
      description: "Panel de plugins en la barra lateral",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setActiveSidebarSection("plugins"); if (!sidebarOpen) toggleSidebar(); toggleCommandPalette(); },
      category: "Plugins",
    },
    {
      id: "toggle-preview",
      label: previewOpen ? "Ocultar preview" : "Mostrar preview",
      icon: previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      action: () => { togglePreview(); toggleCommandPalette(); },
      category: "Vista",
    },
    {
      id: "toggle-sidebar",
      label: sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral",
      icon: sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />,
      action: () => { toggleSidebar(); toggleCommandPalette(); },
      category: "Vista",
    },
    {
      id: "toggle-desktop",
      label: showDesktop ? "Ocultar simulacion" : "Mostrar simulacion desktop",
      icon: <Monitor className="h-4 w-4" />,
      action: () => { toggleShowDesktop(); if (!previewOpen) togglePreview(); toggleCommandPalette(); },
      category: "Vista",
    },
    {
      id: "settings",
      label: "Configuracion",
      description: "Abrir panel de configuracion",
      icon: <Settings className="h-4 w-4" />,
      action: () => { setSettingsOpen(!settingsOpen); toggleCommandPalette(); },
      category: "Sistema",
    },
    {
      id: "new-plugin",
      label: "Crear nuevo plugin",
      description: "Crear un plugin personalizado con plantilla",
      icon: <FileText className="h-4 w-4" />,
      action: () => { setNewPluginDialogOpen(true); toggleCommandPalette(); },
      category: "Plugins",
    },
  ];

  const allCommands = [...commands, ...buildFontSizeCommands()];

  const filtered = allCommands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase()) ||
      (cmd.description && cmd.description.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        toggleCommandPalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, toggleCommandPalette]);

  useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={toggleCommandPalette}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-popover border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar comandos..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Sin resultados
                  </div>
                ) : (
                  filtered.map((cmd, idx) => (
                    <motion.button
                      key={cmd.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="text-muted-foreground">{cmd.icon}</span>
                      <div className="flex-1 text-left">
                        <div>{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-muted-foreground">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {cmd.category}
                      </span>
                    </motion.button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
