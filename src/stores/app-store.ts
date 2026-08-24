import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getLanguage, setLanguage, type Language } from "@/lib/i18n";

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  plugin?: string;
  content?: string;
  modified?: boolean;
}

export interface OpenTab {
  id: string;
  name: string;
  path: string;
  content: string;
  modified: boolean;
}

export interface Snapshot {
  id: string;
  timestamp: number;
  files: { path: string; content: string }[];
  description?: string;
}

function saveVault(path: string | null) {
  if (path) localStorage.setItem("riceboard:vault", path);
  else localStorage.removeItem("riceboard:vault");
}

function loadVault(): string | null {
  return localStorage.getItem("riceboard:vault");
}

function saveTabs(tabs: OpenTab[]) {
  const minimal = tabs.map((t) => ({ id: t.id, name: t.name, path: t.path }));
  localStorage.setItem("riceboard:tabs", JSON.stringify(minimal));
}

function loadTabs(): { id: string; name: string; path: string }[] {
  try {
    return JSON.parse(localStorage.getItem("riceboard:tabs") || "[]");
  } catch {
    return [];
  }
}

function saveEnabledPlugins(p: Record<string, boolean>) {
  localStorage.setItem("riceboard:plugins", JSON.stringify(p));
}

function loadEnabledPlugins(): Record<string, boolean> | null {
  try {
    return JSON.parse(localStorage.getItem("riceboard:plugins") || "null");
  } catch {
    return null;
  }
}

function saveLayout(sidebarWidth: number, previewWidth: number, previewOpen: boolean) {
  localStorage.setItem("riceboard:layout", JSON.stringify({ sidebarWidth, previewWidth, previewOpen }));
}

function loadLayout(): { sidebarWidth?: number; previewWidth?: number; previewOpen?: boolean } {
  try {
    return JSON.parse(localStorage.getItem("riceboard:layout") || "{}");
  } catch {
    return {};
  }
}

function saveBackground(pattern: string, opacity: number) {
  localStorage.setItem("riceboard:background", JSON.stringify({ pattern, opacity }));
}

function loadBackground(): { pattern?: string; opacity?: number } {
  try {
    return JSON.parse(localStorage.getItem("riceboard:background") || "{}");
  } catch {
    return {};
  }
}

const defaultPlugins: Record<string, boolean> = {
  hyprland: true, waybar: true, kitty: true, rofi: true,
  neovim: true, zsh: true, mako: true, swww: true,
  tmux: true, btop: true, dunst: false, alacritty: false,
  ghostty: false, fish: false, bash: false, wofi: false,
  hyprpaper: false, eww: false, hyprlock: false, cava: false,
  starship: false, foot: false, fuzzel: false, swaync: false,
  yazi: false, wlogout: false, lazygit: false, bat: false,
  eza: false, wallust: false,
};

const savedLayout = loadLayout();

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;

  previewWidth: number;
  setPreviewWidth: (w: number) => void;
  previewOpen: boolean;
  togglePreview: () => void;

  activeVaultPath: string | null;
  setActiveVaultPath: (path: string | null) => void;

  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;

  openTabs: OpenTab[];
  activeTabId: string | null;
  openFile: (file: FileNode) => Promise<void>;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  saveCurrentFile: () => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<string>;
  createFolder: (name: string) => Promise<string>;
  refreshFileTree: () => Promise<void>;
  isLinux: boolean;
  checkIsLinux: () => Promise<void>;
  reloadService: (plugin: string) => Promise<string>;

  snapshots: Snapshot[];
  addSnapshot: (snapshot: Snapshot) => void;

  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;

  enabledPlugins: Record<string, boolean>;
  togglePlugin: (name: string) => void;

  activeSidebarSection: string;
  setActiveSidebarSection: (section: string) => void;

  showDesktop: boolean;
  toggleShowDesktop: () => void;

  fontSizeOverrides: Record<string, number>;
  setFontSizeOverride: (plugin: string, size: number) => void;
  resetFontSizeOverrides: () => void;

  setupDialogOpen: boolean;
  setSetupDialogOpen: (open: boolean) => void;
  pendingVaultPath: string | null;
  setPendingVaultPath: (path: string | null) => void;

  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  language: Language;
  setLanguage: (lang: Language) => void;

  newPluginDialogOpen: boolean;
  setNewPluginDialogOpen: (open: boolean) => void;

  livePlugins: Record<string, boolean>;
  setLiveRunning: (plugin: string, running: boolean) => void;
  checkPackage: (name: string) => Promise<boolean>;
  startLivePreview: (plugin: string) => Promise<string>;
  stopLivePreview: (plugin: string) => Promise<string>;

  restoreSession: () => Promise<void>;

  backgroundPattern: string;
  backgroundOpacity: number;
  setBackgroundPattern: (pattern: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  sidebarWidth: savedLayout.sidebarWidth ?? 250,
  setSidebarWidth: (w) => {
    set({ sidebarWidth: w });
    const s = get();
    saveLayout(w, s.previewWidth, s.previewOpen);
  },

  previewWidth: savedLayout.previewWidth ?? 300,
  setPreviewWidth: (w) => {
    set({ previewWidth: w });
    const s = get();
    saveLayout(s.sidebarWidth, w, s.previewOpen);
  },
  previewOpen: savedLayout.previewOpen ?? true,
  togglePreview: () => {
    const s = get();
    const next = !s.previewOpen;
    set({ previewOpen: next });
    saveLayout(s.sidebarWidth, s.previewWidth, next);
  },

  activeVaultPath: null,
  setActiveVaultPath: (path) => {
    set({ activeVaultPath: path });
    saveVault(path);
  },

  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),

  openTabs: [],
  activeTabId: null,
  openFile: async (file) => {
    const s = get();
    const exists = s.openTabs.find((t) => t.path === file.path);
    if (exists) {
      set({ activeTabId: exists.id });
      return;
    }
    let content = "";
    try {
      content = await invoke<string>("read_file", { path: file.path });
    } catch (e) {
      content = `// Error loading ${file.name}: ${e}`;
    }
    const tab: OpenTab = {
      id: file.id,
      name: file.name,
      path: file.path,
      content,
      modified: false,
    };
    const nextTabs = [...s.openTabs, tab];
    set({ openTabs: nextTabs, activeTabId: tab.id });
    saveTabs(nextTabs);
  },
  closeTab: (id) =>
    set((s) => {
      const tabs = s.openTabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id
          ? tabs.length > 0 ? tabs[tabs.length - 1].id : null
          : s.activeTabId;
      saveTabs(tabs);
      return { openTabs: tabs, activeTabId };
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  updateTabContent: (id, content) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.id === id ? { ...t, content, modified: true } : t
      ),
    })),
  saveCurrentFile: async () => {
    const s = get();
    const tab = s.openTabs.find((t) => t.id === s.activeTabId);
    if (!tab) return;
    try {
      await invoke("write_file", { path: tab.path, content: tab.content });
      set({
        openTabs: s.openTabs.map((t) =>
          t.id === tab.id ? { ...t, modified: false } : t
        ),
      });
    } catch (e) {
      console.error("Save failed:", e);
    }
  },

  deleteFile: async (path: string) => {
    try {
      await invoke("delete_path", { path });
      const s = get();
      const closedTabs = s.openTabs.filter((t) => t.path === path);
      const remaining = s.openTabs.filter((t) => t.path !== path);
      let newActive = s.activeTabId;
      if (closedTabs.some((t) => t.id === s.activeTabId)) {
        newActive = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      set({ openTabs: remaining, activeTabId: newActive });
      saveTabs(remaining);
      if (s.activeVaultPath) {
        const tree = await invoke<FileNode[]>("scan_directory", { path: s.activeVaultPath });
        set({ fileTree: tree });
      }
    } catch (e) {
      console.error("Delete failed:", e);
    }
  },

  renameFile: async (oldPath: string, newName: string) => {
    try {
      const newPath = await invoke<string>("rename_path", { oldPath, newName });
      const s = get();
      const tab = s.openTabs.find((t) => t.path === oldPath);
      if (tab) {
        const updatedTabs = s.openTabs.map((t) =>
          t.path === oldPath ? { ...t, path: newPath, name: newName, id: newPath } : t
        );
        set({
          openTabs: updatedTabs,
          activeTabId: s.activeTabId === oldPath ? newPath : s.activeTabId,
        });
        saveTabs(updatedTabs);
      }
      if (s.activeVaultPath) {
        const tree = await invoke<FileNode[]>("scan_directory", { path: s.activeVaultPath });
        set({ fileTree: tree });
      }
      return newPath;
    } catch (e) {
      console.error("Rename failed:", e);
      return oldPath;
    }
  },

  createFolder: async (name: string) => {
    const s = get();
    if (!s.activeVaultPath) return "";
    try {
      const newPath = await invoke<string>("create_folder", { vaultPath: s.activeVaultPath, name });
      const tree = await invoke<FileNode[]>("scan_directory", { path: s.activeVaultPath });
      set({ fileTree: tree });
      return newPath;
    } catch (e) {
      console.error("Create folder failed:", e);
      return "";
    }
  },

  refreshFileTree: async () => {
    const s = get();
    if (!s.activeVaultPath) return;
    try {
      const tree = await invoke<FileNode[]>("scan_directory", { path: s.activeVaultPath });
      set({ fileTree: tree });
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  },

  isLinux: false,
  checkIsLinux: async () => {
    try {
      const result = await invoke<boolean>("is_linux");
      set({ isLinux: result });
    } catch {
      set({ isLinux: false });
    }
  },
  reloadService: async (plugin: string) => {
    try {
      const result = await invoke<string>("reload_service", { plugin });
      return result;
    } catch (e) {
      return String(e);
    }
  },

  snapshots: [],
  addSnapshot: (snapshot) =>
    set((s) => ({ snapshots: [...s.snapshots, snapshot] })),

  commandPaletteOpen: false,
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  enabledPlugins: loadEnabledPlugins() ?? defaultPlugins,
  togglePlugin: (name) =>
    set((s) => {
      const next = {
        ...s.enabledPlugins,
        [name]: !s.enabledPlugins[name],
      };
      saveEnabledPlugins(next);
      return { enabledPlugins: next };
    }),

  setupDialogOpen: false,
  setSetupDialogOpen: (open) => set({ setupDialogOpen: open }),
  pendingVaultPath: null,
  setPendingVaultPath: (path) => set({ pendingVaultPath: path }),

  activeSidebarSection: "files",
  setActiveSidebarSection: (section) => set({ activeSidebarSection: section }),

  showDesktop: false,
  toggleShowDesktop: () => set((s) => ({ showDesktop: !s.showDesktop })),

  fontSizeOverrides: {},
  setFontSizeOverride: (plugin, size) =>
    set((s) => ({ fontSizeOverrides: { ...s.fontSizeOverrides, [plugin]: size } })),
  resetFontSizeOverrides: () => set({ fontSizeOverrides: {} }),

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  language: getLanguage(),
  setLanguage: (lang) => {
    setLanguage(lang);
    set({ language: lang });
  },

  newPluginDialogOpen: false,
  setNewPluginDialogOpen: (open) => set({ newPluginDialogOpen: open }),

  livePlugins: {},
  setLiveRunning: (plugin, running) =>
    set((s) => ({ livePlugins: { ...s.livePlugins, [plugin]: running } })),
  checkPackage: async (name: string) => {
    try {
      return await invoke<boolean>("check_package", { name });
    } catch {
      return false;
    }
  },
  startLivePreview: async (plugin: string) => {
    const s = get();
    if (!s.activeVaultPath) return "No vault open";
    try {
      const result = await invoke<string>("start_live_preview", {
        plugin,
        vaultPath: s.activeVaultPath,
      });
      set((st) => ({ livePlugins: { ...st.livePlugins, [plugin]: true } }));
      return result;
    } catch (e) {
      return String(e);
    }
  },
  stopLivePreview: async (plugin: string) => {
    try {
      const result = await invoke<string>("stop_live_preview", { plugin });
      set((st) => ({ livePlugins: { ...st.livePlugins, [plugin]: false } }));
      return result;
    } catch (e) {
      return String(e);
    }
  },

  restoreSession: async () => {
    const vault = loadVault();
    if (vault) {
      try {
        set({ activeVaultPath: vault });
        const tree = await invoke<FileNode[]>("scan_directory", { path: vault });
        set({ fileTree: tree });

        const savedTabs = loadTabs();
        if (savedTabs.length > 0) {
          const restoredTabs: OpenTab[] = [];
          for (const st of savedTabs) {
            try {
              const content = await invoke<string>("read_file", { path: st.path });
              restoredTabs.push({ ...st, content, modified: false });
            } catch {
              // file gone, skip
            }
          }
          if (restoredTabs.length > 0) {
            set({
              openTabs: restoredTabs,
              activeTabId: restoredTabs[restoredTabs.length - 1].id,
            });
          }
        }
      } catch {
        localStorage.removeItem("riceboard:vault");
      }
    }
    // Check OS
    try {
      const result = await invoke<boolean>("is_linux");
      set({ isLinux: result });
    } catch {
      set({ isLinux: false });
    }
  },

  backgroundPattern: loadBackground().pattern ?? "none",
  backgroundOpacity: loadBackground().opacity ?? 50,
  setBackgroundPattern: (pattern) => {
    set({ backgroundPattern: pattern });
    const s = get();
    saveBackground(pattern, s.backgroundOpacity);
  },
  setBackgroundOpacity: (opacity) => {
    set({ backgroundOpacity: opacity });
    const s = get();
    saveBackground(s.backgroundPattern, opacity);
  },
}));
