import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Folder, FolderOpen, ChevronRight, Layers,
  Clock, GitBranch, Sparkles, Plus, FolderSearch,
  FilePlus, FolderPlus, Pencil, Trash2, Copy, Eye,
} from "lucide-react";
import { useAppStore, type FileNode } from "@/stores/app-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { SnapshotTimeline } from "@/components/timeline/SnapshotTimeline";
import { RelationGraph } from "@/components/graph/RelationGraph";
import { t } from "@/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useContextMenu } from "@/components/ui/context-menu";

const pluginIcons: Record<string, React.ReactNode> = {
  hyprland: <Layers className="h-4 w-4 text-blue-400" />,
  waybar: <Layers className="h-4 w-4 text-green-400" />,
  kitty: <Layers className="h-4 w-4 text-purple-400" />,
  alacritty: <Layers className="h-4 w-4 text-red-400" />,
  ghostty: <Layers className="h-4 w-4 text-pink-400" />,
  foot: <Layers className="h-4 w-4 text-teal-400" />,
  neovim: <Layers className="h-4 w-4 text-emerald-400" />,
  nvim: <Layers className="h-4 w-4 text-emerald-400" />,
  zsh: <Layers className="h-4 w-4 text-yellow-400" />,
  fish: <Layers className="h-4 w-4 text-cyan-400" />,
  bash: <Layers className="h-4 w-4 text-orange-400" />,
  rofi: <Layers className="h-4 w-4 text-orange-400" />,
  wofi: <Layers className="h-4 w-4 text-pink-400" />,
  fuzzel: <Layers className="h-4 w-4 text-amber-400" />,
  swww: <Layers className="h-4 w-4 text-indigo-400" />,
  hyprpaper: <Layers className="h-4 w-4 text-indigo-400" />,
  eww: <Layers className="h-4 w-4 text-teal-400" />,
  mako: <Layers className="h-4 w-4 text-rose-400" />,
  dunst: <Layers className="h-4 w-4 text-amber-400" />,
  swaync: <Layers className="h-4 w-4 text-violet-400" />,
  tmux: <Layers className="h-4 w-4 text-lime-400" />,
  btop: <Layers className="h-4 w-4 text-sky-400" />,
  hyprlock: <Layers className="h-4 w-4 text-slate-400" />,
  cava: <Layers className="h-4 w-4 text-fuchsia-400" />,
  starship: <Layers className="h-4 w-4 text-cyan-300" />,
  yazi: <Layers className="h-4 w-4 text-emerald-300" />,
  wlogout: <Layers className="h-4 w-4 text-red-300" />,
  lazygit: <Layers className="h-4 w-4 text-yellow-300" />,
  bat: <Layers className="h-4 w-4 text-green-300" />,
  eza: <Layers className="h-4 w-4 text-blue-300" />,
  wallust: <Layers className="h-4 w-4 text-purple-300" />,
};

function FileTreeItem({ node, depth = 0, onContextMenu }: { node: FileNode; depth?: number; onContextMenu: (e: React.MouseEvent, node: FileNode) => void }) {
  const [expanded, setExpanded] = useState(false);
  const openFile = useAppStore((s) => s.openFile);
  const isDir = node.type === "directory";

  return (
    <div>
      <button
        className="w-full flex items-center gap-2 py-1 px-2 rounded-md text-sm hover:bg-accent/60 hover:text-accent-foreground transition-all duration-100 group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => { if (isDir) setExpanded(!expanded); else openFile(node); }}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {isDir ? (
          <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.span>
        ) : <span className="w-3.5" />}
        {isDir ? (
          expanded ? <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
          : <Folder className="h-4 w-4 text-blue-400/70 shrink-0" />
        ) : node.plugin ? (
          pluginIcons[node.plugin] || <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="truncate">{node.name}</span>
        {node.modified && <span className="ml-auto h-2 w-2 rounded-full bg-orange-400 shrink-0" />}
      </button>
      <AnimatePresence>
        {isDir && expanded && node.children && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
            {node.children.map((child) => (<FileTreeItem key={child.id} node={child} depth={depth + 1} onContextMenu={onContextMenu} />))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const sidebarSections = [
  { id: "files", labelKey: "sidebar.files", icon: FileText },
  { id: "plugins", labelKey: "sidebar.plugins", icon: Sparkles },
  { id: "snapshots", labelKey: "sidebar.snapshots", icon: Clock },
  { id: "graph", labelKey: "sidebar.graph", icon: GitBranch },
];

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const fileTree = useAppStore((s) => s.fileTree);
  const activeVaultPath = useAppStore((s) => s.activeVaultPath);
  const setActiveVaultPath = useAppStore((s) => s.setActiveVaultPath);
  const setFileTree = useAppStore((s) => s.setFileTree);
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const sidebarWidth = useAppStore((s) => s.sidebarWidth);
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
  const enabledPlugins = useAppStore((s) => s.enabledPlugins);
  const togglePlugin = useAppStore((s) => s.togglePlugin);
  const setSetupDialogOpen = useAppStore((s) => s.setSetupDialogOpen);
  const setPendingVaultPath = useAppStore((s) => s.setPendingVaultPath);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const renameFile = useAppStore((s) => s.renameFile);
  const createFolder = useAppStore((s) => s.createFolder);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const activeSidebarSection = useAppStore((s) => s.activeSidebarSection);
  const setActiveSidebarSection = useAppStore((s) => s.setActiveSidebarSection);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const { showMenu, MenuPortal } = useContextMenu();
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleOpenVault = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Seleccionar vault de dotfiles" });
      if (selected) {
        const path = selected as string;
        setPendingVaultPath(path);
        setSetupDialogOpen(true);
      }
    } catch (err) { console.error("Error opening vault:", err); }
  }, [setPendingVaultPath, setSetupDialogOpen]);

  const handleCreateFile = useCallback(async () => {
    if (!activeVaultPath || !newFileName.trim()) return;
    try {
      await invoke("create_file", { vaultPath: activeVaultPath, name: newFileName.trim() });
      const tree = await invoke<FileNode[]>("scan_directory", { path: activeVaultPath });
      setFileTree(tree);
      setNewFileName("");
      setShowNewFileInput(false);
    } catch (err) { console.error("Error creating file:", err); }
  }, [activeVaultPath, newFileName, setFileTree]);

  const handleCreateFolder = useCallback(async () => {
    if (!activeVaultPath || !newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolderInput(false);
    } catch (err) { console.error("Error creating folder:", err); }
  }, [activeVaultPath, newFolderName, createFolder]);

  const handleFileContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    const items = node.type === "file" ? [
      { label: "Abrir", icon: <Eye className="h-4 w-4" />, shortcut: "Enter", onClick: () => useAppStore.getState().openFile(node) },
      { divider: true, label: "" },
      { label: "Copiar ruta", icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl+Shift+C", onClick: () => navigator.clipboard.writeText(node.path) },
      { divider: true, label: "" },
      { label: "Renombrar", icon: <Pencil className="h-4 w-4" />, shortcut: "F2", onClick: () => { setRenamingPath(node.path); setRenamingValue(node.name); } },
      { label: "Eliminar", icon: <Trash2 className="h-4 w-4 text-red-400" />, shortcut: "Del", danger: true, onClick: () => { if (confirm(`Eliminar "${node.name}"?`)) deleteFile(node.path); } },
    ] : [
      { label: "Nuevo archivo", icon: <FilePlus className="h-4 w-4" />, onClick: () => { setNewFileName(""); setShowNewFileInput(true); } },
      { label: "Nueva carpeta", icon: <FolderPlus className="h-4 w-4" />, onClick: () => { setNewFolderName(""); setShowNewFolderInput(true); } },
      { divider: true, label: "" },
      { label: "Copiar ruta", icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl+Shift+C", onClick: () => navigator.clipboard.writeText(node.path) },
      { divider: true, label: "" },
      { label: "Renombrar", icon: <Pencil className="h-4 w-4" />, shortcut: "F2", onClick: () => { setRenamingPath(node.path); setRenamingValue(node.name); } },
      { label: "Eliminar", icon: <Trash2 className="h-4 w-4 text-red-400" />, shortcut: "Del", danger: true, onClick: () => { if (confirm(`Eliminar carpeta "${node.name}"?`)) deleteFile(node.path); } },
    ];
    showMenu(e, items);
  }, [showMenu, deleteFile]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingPath || !renamingValue.trim()) { setRenamingPath(null); return; }
    await renameFile(renamingPath, renamingValue.trim());
    setRenamingPath(null);
  }, [renamingPath, renamingValue, renameFile]);

  if (!sidebarOpen) return null;

  return (
    <div className="relative flex h-full">
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: sidebarWidth, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="sidebar h-full border-r overflow-hidden flex flex-col"
      >
        <div className="flex items-center gap-0.5 px-2 py-2 border-b" style={{ minHeight: 40 }}>
          {sidebarSections.map((section) => {
            const Icon = section.icon;
            return (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <Button variant={activeSidebarSection === section.id ? "secondary" : "ghost"} size="icon" className="h-7 w-7 transition-all duration-100 hover:bg-accent/80 active:scale-95" onClick={() => setActiveSidebarSection(section.id)}>
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t(section.labelKey)}</TooltipContent>
              </Tooltip>
            );
          })}
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 transition-all duration-100 hover:bg-accent/80 active:scale-95" onClick={handleOpenVault}>
                  <FolderSearch className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("sidebar.openVault")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 transition-all duration-100 hover:bg-accent/80 active:scale-95" onClick={() => { if (activeVaultPath) setShowNewFileInput(!showNewFileInput); }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("sidebar.newFile")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <AnimatePresence>
          {showNewFileInput && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="border-b overflow-hidden">
              <div className="flex items-center gap-2 p-2">
                <input autoFocus value={newFileName} onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateFile(); if (e.key === "Escape") setShowNewFileInput(false); }}
                  placeholder="nombre-archivo.conf" className="flex-1 h-7 px-2 text-sm rounded border bg-background outline-none focus:ring-1 focus:ring-ring" />
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCreateFile}>Crear</Button>
              </div>
            </motion.div>
          )}
          {showNewFolderInput && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="border-b overflow-hidden">
              <div className="flex items-center gap-2 p-2">
                <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolderInput(false); }}
                  placeholder="nombre-carpeta" className="flex-1 h-7 px-2 text-sm rounded border bg-background outline-none focus:ring-1 focus:ring-ring" />
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCreateFolder}>Crear</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ScrollArea className="flex-1">
          {activeSidebarSection === "files" && (
            <div className="p-1">
              {activeVaultPath ? (
                <>
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                    <FolderOpen className="h-3 w-3" />
                    <span className="truncate">{activeVaultPath.split(/[/\\]/).pop()}</span>
                  </div>
                  {fileTree.length > 0 ? fileTree.map((node) => <FileTreeItem key={node.id} node={node} onContextMenu={handleFileContextMenu} />) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Folder className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">Vault vacio</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Folder className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">{t("sidebar.noVault")}</p>
                  <p className="text-xs mt-1">{t("sidebar.noVaultHint")}</p>
                  <Button variant="outline" size="sm" className="mt-3 transition-all duration-150 hover:bg-accent active:scale-[0.98]" onClick={handleOpenVault}>
                    <FolderSearch className="h-4 w-4 mr-2" />{t("sidebar.openVault")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeSidebarSection === "plugins" && (
            <div className="p-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider px-1">Plugins</p>
              {Object.keys(pluginIcons).map((name) => {
                const enabled = enabledPlugins[name] !== false;
                return (
                  <div key={name} className="flex items-center gap-2 py-1.5 px-2 rounded-md text-sm hover:bg-accent/60 transition-all duration-100">
                    {pluginIcons[name]}
                    <span className="capitalize flex-1">{name}</span>
                    <button onClick={() => togglePlugin(name)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${enabled ? "bg-green-500/20 hover:bg-green-500/30" : "bg-red-500/20 hover:bg-red-500/30"}`}
                      title={enabled ? "Desactivar" : "Activar"}>
                      <div className={`w-2 h-2 rounded-full ${enabled ? "bg-green-400" : "bg-red-400"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeSidebarSection === "snapshots" && <SnapshotTimeline />}
          {activeSidebarSection === "graph" && <RelationGraph />}
        </ScrollArea>
      </motion.aside>
      {MenuPortal}
    </div>
  );
}