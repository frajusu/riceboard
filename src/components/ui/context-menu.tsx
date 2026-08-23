import React, { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus, FolderPlus, Pencil, Trash2, Copy, ClipboardPaste,
  FolderOpen, Eye, Terminal, FileCode,
} from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (rect.right > vw) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > vh) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="fixed z-[100] min-w-[220px] py-1.5 rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/30"
        style={{ left: x, top: y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item, i) => {
          if (item.divider) {
            return <div key={i} className="my-1 mx-2 border-t border-border/40" />;
          }
          return (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.();
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors duration-75
                ${item.danger
                  ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  : "text-foreground/90 hover:bg-accent/70 hover:text-accent-foreground"
                } ${item.disabled ? "opacity-40 pointer-events-none" : ""}`}
            >
              {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-muted-foreground/50 ml-4">{item.shortcut}</span>
              )}
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

export function useContextMenu() {
  const [menu, setMenu] = React.useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);

  const showMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ items, x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const MenuPortal = menu ? (
    <ContextMenu items={menu.items} x={menu.x} y={menu.y} onClose={closeMenu} />
  ) : null;

  return { showMenu, closeMenu, MenuPortal };
}
