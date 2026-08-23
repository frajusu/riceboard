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
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { Check, FolderOpen, X } from "lucide-react";

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

export default function App() {
  const restoreSession = useAppStore((s) => s.restoreSession);
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
  }, []);

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <div className="h-screen flex flex-col overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
          <TitleBar />
          <div className="flex-1 flex min-h-0">
            <Sidebar />
            <main className="flex-1 flex min-h-0 relative">
              <CodeEditor />
              <PreviewPanel />
            </main>
          </div>
          <CommandPalette />
          <VaultSetupDialog />
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
