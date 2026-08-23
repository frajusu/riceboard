import React from "react";
import { motion } from "framer-motion";
import {
  Minus,
  Square,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useThemeStore } from "@/stores/theme-store";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { invoke } from "@tauri-apps/api/core";

export function TitleBar() {
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const { sidebarOpen, toggleSidebar, toggleCommandPalette } = useAppStore();

  const cycleTheme = () => {
    const themes: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ];
    const idx = themes.indexOf(theme);
    setTheme(themes[(idx + 1) % themes.length]);
  };

  const ThemeIcon =
    theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div
      data-tauri-drag-region
      className="titlebar flex items-center h-10 px-3 border-b select-none"
      style={{ WebkitAppRegion: "drag", backgroundColor: "hsl(var(--titlebar))" } as React.CSSProperties}
    >
      {/* Left: Sidebar toggle */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 transition-all duration-150 hover:bg-accent/80 active:scale-95"
              onClick={toggleSidebar}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Center: Title + Command Palette trigger */}
      <div className="flex-1 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 cursor-default select-none">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-white">R</span>
          </div>
          <span className="text-sm font-semibold titlebar-foreground">
            Riceboard
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 gap-2 text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all duration-150 active:scale-[0.98]"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              onClick={toggleCommandPalette}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Buscar</span>
              <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-60">
                <span className="text-xs">Ctrl</span>
                <span className="text-xs">K</span>
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Command Palette (Ctrl+K)</TooltipContent>
        </Tooltip>
      </div>

      {/* Right: Theme toggle + Window controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 transition-all duration-150 hover:bg-accent/80 active:scale-95"
              onClick={cycleTheme}
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Tema: {theme === "system" ? "Sistema" : theme === "dark" ? "Oscuro" : "Claro"}
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center ml-2 gap-[7px]">
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/80 transition-colors flex items-center justify-center group"
            onClick={() => invoke("minimize_window")}
          >
            <Minus className="h-2 w-2 text-[#9A6700] opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            className="w-3 h-3 rounded-full bg-[#27C93F] hover:bg-[#27C93F]/80 transition-colors flex items-center justify-center group"
            onClick={() => invoke("toggle_maximize")}
          >
            <Square className="h-1.5 w-1.5 text-[#006500] opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/80 transition-colors flex items-center justify-center group"
            onClick={() => invoke("close_window")}
          >
            <X className="h-2 w-2 text-[#990000] opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
