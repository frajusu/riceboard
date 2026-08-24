import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  FolderOpen,
  Clock,
  GitBranch,
  Layers,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useThemeStore } from "@/stores/theme-store";
import { open } from "@tauri-apps/plugin-dialog";
import { t } from "@/lib/i18n";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

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
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setNewPluginDialogOpen = useAppStore((s) => s.setNewPluginDialogOpen);
  const showDesktop = useAppStore((s) => s.showDesktop);
  const toggleShowDesktop = useAppStore((s) => s.toggleShowDesktop);
  const setBackgroundPattern = useAppStore((s) => s.setBackgroundPattern);
  const backgroundPattern = useAppStore((s) => s.backgroundPattern);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleOpenVault = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: t("cmd.openVaultDesc") });
      if (selected) {
        setPendingVaultPath(selected as string);
        setSetupDialogOpen(true);
      }
    } catch (err) {
      console.error("Error opening vault:", err);
    }
  };

  const commands: CommandItem[] = [
    {
      id: "open-vault",
      label: t("cmd.openVault"),
      description: t("cmd.openVaultDesc"),
      icon: <FolderOpen className="h-4 w-4" />,
      action: () => { handleOpenVault(); toggleCommandPalette(); },
      category: t("cmd.cat.files"),
    },
    {
      id: "theme-dark",
      label: t("cmd.themeDark"),
      icon: <Moon className="h-4 w-4" />,
      action: () => { setTheme("dark"); toggleCommandPalette(); },
      category: t("cmd.cat.appearance"),
    },
    {
      id: "theme-light",
      label: t("cmd.themeLight"),
      icon: <Sun className="h-4 w-4" />,
      action: () => { setTheme("light"); toggleCommandPalette(); },
      category: t("cmd.cat.appearance"),
    },
    {
      id: "theme-system",
      label: t("cmd.themeSystem"),
      icon: <Monitor className="h-4 w-4" />,
      action: () => { setTheme("system"); toggleCommandPalette(); },
      category: t("cmd.cat.appearance"),
    },
    {
      id: "snapshots",
      label: t("cmd.snapshots"),
      description: t("cmd.snapshotsDesc"),
      icon: <Clock className="h-4 w-4" />,
      action: () => { setActiveSidebarSection("snapshots"); if (!sidebarOpen) toggleSidebar(); toggleCommandPalette(); },
      category: t("cmd.cat.navigation"),
    },
    {
      id: "graph",
      label: t("cmd.graph"),
      description: t("cmd.graphDesc"),
      icon: <GitBranch className="h-4 w-4" />,
      action: () => { setActiveSidebarSection("graph"); if (!sidebarOpen) toggleSidebar(); toggleCommandPalette(); },
      category: t("cmd.cat.navigation"),
    },
    {
      id: "plugins",
      label: t("cmd.plugins"),
      description: t("cmd.pluginsDesc"),
      icon: <Layers className="h-4 w-4" />,
      action: () => { setActiveSidebarSection("plugins"); if (!sidebarOpen) toggleSidebar(); toggleCommandPalette(); },
      category: t("cmd.cat.plugins"),
    },
    {
      id: "toggle-preview",
      label: previewOpen ? t("cmd.togglePreview") + " (off)" : t("cmd.togglePreview") + " (on)",
      icon: previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      action: () => { togglePreview(); toggleCommandPalette(); },
      category: t("cmd.cat.view"),
    },
    {
      id: "toggle-sidebar",
      label: sidebarOpen ? t("cmd.toggleSidebar") + " (off)" : t("cmd.toggleSidebar") + " (on)",
      icon: sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />,
      action: () => { toggleSidebar(); toggleCommandPalette(); },
      category: t("cmd.cat.view"),
    },
    {
      id: "toggle-desktop",
      label: showDesktop ? t("cmd.toggleDesktop") + " (off)" : t("cmd.toggleDesktop") + " (on)",
      icon: <Monitor className="h-4 w-4" />,
      action: () => { toggleShowDesktop(); if (!previewOpen) togglePreview(); toggleCommandPalette(); },
      category: t("cmd.cat.view"),
    },
    {
      id: "bg-hexagons",
      label: "Background: Hexagons",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setBackgroundPattern("hexagons"); toggleCommandPalette(); },
      category: "Background",
    },
    {
      id: "bg-waves",
      label: "Background: Waves",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setBackgroundPattern("waves"); toggleCommandPalette(); },
      category: "Background",
    },
    {
      id: "bg-circuit",
      label: "Background: Circuit",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setBackgroundPattern("circuit"); toggleCommandPalette(); },
      category: "Background",
    },
    {
      id: "bg-gradient",
      label: "Background: Gradient Mesh",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setBackgroundPattern("gradient"); toggleCommandPalette(); },
      category: "Background",
    },
    {
      id: "bg-particles",
      label: "Background: Particles",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setBackgroundPattern("particles"); toggleCommandPalette(); },
      category: "Background",
    },
    {
      id: "bg-none",
      label: "Background: None",
      icon: <Layers className="h-4 w-4" />,
      action: () => { setBackgroundPattern("none"); toggleCommandPalette(); },
      category: "Background",
    },
    {
      id: "settings",
      label: t("cmd.settings"),
      description: t("cmd.settingsDesc"),
      icon: <Settings className="h-4 w-4" />,
      action: () => { setSettingsOpen(!settingsOpen); toggleCommandPalette(); },
      category: t("cmd.cat.system"),
    },
    {
      id: "new-plugin",
      label: t("cmd.newPlugin"),
      description: t("cmd.newPluginDesc"),
      icon: <FileText className="h-4 w-4" />,
      action: () => { setNewPluginDialogOpen(true); toggleCommandPalette(); },
      category: t("cmd.cat.plugins"),
    },
  ];

  const filtered = commands.filter(
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
                  placeholder={t("cmd.searchPlaceholder")}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {t("cmd.noResults")}
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
