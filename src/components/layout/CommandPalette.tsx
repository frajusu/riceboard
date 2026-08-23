import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Settings,
  Sun,
  Moon,
  FolderOpen,
  Clock,
  GitBranch,
  Layers,
  Terminal,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useThemeStore } from "@/stores/theme-store";

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
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: "open-vault",
      label: "Abrir vault",
      description: "Seleccionar carpeta de dotfiles",
      icon: <FolderOpen className="h-4 w-4" />,
      action: () => {
        /* TODO */
        toggleCommandPalette();
      },
      category: "Archivo",
    },
    {
      id: "theme-dark",
      label: "Tema oscuro",
      icon: <Moon className="h-4 w-4" />,
      action: () => {
        setTheme("dark");
        toggleCommandPalette();
      },
      category: "Apariencia",
    },
    {
      id: "theme-light",
      label: "Tema claro",
      icon: <Sun className="h-4 w-4" />,
      action: () => {
        setTheme("light");
        toggleCommandPalette();
      },
      category: "Apariencia",
    },
    {
      id: "snapshots",
      label: "Ver snapshots",
      icon: <Clock className="h-4 w-4" />,
      action: toggleCommandPalette,
      category: "Navegación",
    },
    {
      id: "graph",
      label: "Ver grafo de relaciones",
      icon: <GitBranch className="h-4 w-4" />,
      action: toggleCommandPalette,
      category: "Navegación",
    },
    {
      id: "plugins",
      label: "Gestionar plugins",
      icon: <Layers className="h-4 w-4" />,
      action: toggleCommandPalette,
      category: "Plugins",
    },
    {
      id: "settings",
      label: "Configuración",
      icon: <Settings className="h-4 w-4" />,
      action: toggleCommandPalette,
      category: "Sistema",
    },
    {
      id: "terminal",
      label: "Abrir terminal",
      description: "Terminal integrada",
      icon: <Terminal className="h-4 w-4" />,
      action: toggleCommandPalette,
      category: "Herramientas",
    },
  ];

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
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
              {/* Search input */}
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

              {/* Results */}
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
