export type Language = "en" | "es";

const translations: Record<Language, Record<string, string>> = {
  en: {
    // TitleBar
    "titlebar.hidePanel": "Hide panel",
    "titlebar.showPanel": "Show panel",
    "titlebar.search": "Search",
    "titlebar.theme.dark": "Dark",
    "titlebar.theme.light": "Light",
    "titlebar.theme.system": "System",

    // Sidebar
    "sidebar.files": "Files",
    "sidebar.plugins": "Plugins",
    "sidebar.snapshots": "Snapshots",
    "sidebar.graph": "Graph",
    "sidebar.openVault": "Open vault",
    "sidebar.newFile": "New file",
    "sidebar.newFolder": "New folder",
    "sidebar.noVault": "No vault selected",
    "sidebar.noVaultHint": "Open a folder to get started",

    // Editor
    "editor.empty.title": "Riceboard",
    "editor.empty.hint": "Open a file to start editing",
    "editor.empty.shortcut": "Ctrl+K to open the command palette",
    "editor.contextMenu.undo": "Undo",
    "editor.contextMenu.redo": "Redo",
    "editor.contextMenu.cut": "Cut",
    "editor.contextMenu.copy": "Copy",
    "editor.contextMenu.paste": "Paste",
    "editor.contextMenu.selectAll": "Select all",

    // Preview
    "preview.title": "Preview",
    "preview.desktop": "Desktop simulation",
    "preview.hide": "Hide",
    "preview.openHint": "Open a config file to preview",
    "preview.openSubhint": "Hyprland, Waybar, Kitty, Rofi, Neovim...",
    "preview.rofiToggle": "Rofi",
    "preview.makoToggle": "Mako",
    "preview.clickFocus": "Click windows to focus",
    "preview.hyprland.title": "Desktop Simulation",

    // CommandPalette
    "cmd.searchPlaceholder": "Search commands...",
    "cmd.noResults": "No results",
    "cmd.openVault": "Open vault",
    "cmd.openVaultDesc": "Select dotfiles folder",
    "cmd.themeDark": "Dark theme",
    "cmd.themeLight": "Light theme",
    "cmd.themeSystem": "System theme",
    "cmd.snapshots": "View snapshots",
    "cmd.snapshotsDesc": "Snapshot panel in sidebar",
    "cmd.graph": "View relation graph",
    "cmd.graphDesc": "Plugin dependency graph",
    "cmd.plugins": "Manage plugins",
    "cmd.pluginsDesc": "Plugin panel in sidebar",
    "cmd.togglePreview": "Toggle preview",
    "cmd.toggleSidebar": "Toggle sidebar",
    "cmd.toggleDesktop": "Toggle desktop simulation",
    "cmd.settings": "Settings",
    "cmd.settingsDesc": "Open settings panel",
    "cmd.newPlugin": "Create new plugin",
    "cmd.newPluginDesc": "Create a custom plugin with template",
    "cmd.cat.appearance": "Appearance",
    "cmd.cat.navigation": "Navigation",
    "cmd.cat.plugins": "Plugins",
    "cmd.cat.view": "View",
    "cmd.cat.system": "System",
    "cmd.cat.files": "Files",

    // Settings
    "settings.title": "Settings",
    "settings.subtitle": "Riceboard preferences",
    "settings.close": "Close",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.theme.system": "System",
    "settings.fontSizes": "Simulation Font Sizes",
    "settings.fontSizes.reset": "Reset all",
    "settings.fontSizes.desc": "Adjust font sizes for each plugin simulation",
    "settings.activePlugins": "Active Plugins",

    // NewPlugin
    "newPlugin.title": "Create new plugin",
    "newPlugin.subtitle": "Choose a template or create a custom one",
    "newPlugin.templates": "Templates",
    "newPlugin.custom": "Custom",
    "newPlugin.namePlaceholder": "Plugin name (e.g. my-theme)",
    "newPlugin.filePlaceholder": "Filename (e.g. config.toml)",
    "newPlugin.cancel": "Cancel",
    "newPlugin.create": "Create plugin",
    "newPlugin.creating": "Creating...",

    // VaultSetup
    "vault.title": "Configure vault",
    "vault.detecting": "Detecting existing structure...",
    "vault.hint": "Plugins with existing configs are marked in green. Only missing ones are created.",
    "vault.filesCreated": "Files created:",
    "vault.skip": "Skip",
    "vault.close": "Close",
    "vault.create": "Create structure",
    "vault.creating": "Creating...",
    "vault.exists": "Already exists ({count} files)",

    // Misc
    "misc.binds": "binds",

    // Live Preview
    "live.start": "Start live preview",
    "live.stop": "Stop live preview",
    "live.running": "Running live",
    "live.notAvailable": "Not available on this OS",
    "live.packageNotFound": "Package not installed",
    "live.runningAnother": "Another live preview is running",
  },
  es: {
    // TitleBar
    "titlebar.hidePanel": "Ocultar panel",
    "titlebar.showPanel": "Mostrar panel",
    "titlebar.search": "Buscar",
    "titlebar.theme.dark": "Oscuro",
    "titlebar.theme.light": "Claro",
    "titlebar.theme.system": "Sistema",

    // Sidebar
    "sidebar.files": "Archivos",
    "sidebar.plugins": "Plugins",
    "sidebar.snapshots": "Snapshots",
    "sidebar.graph": "Grafo",
    "sidebar.openVault": "Abrir vault",
    "sidebar.newFile": "Nuevo archivo",
    "sidebar.newFolder": "Nueva carpeta",
    "sidebar.noVault": "Sin vault seleccionado",
    "sidebar.noVaultHint": "Abre una carpeta para empezar",

    // Editor
    "editor.empty.title": "Riceboard",
    "editor.empty.hint": "Abri un archivo para comenzar a editar",
    "editor.empty.shortcut": "Ctrl+K para abrir la palette de comandos",
    "editor.contextMenu.undo": "Deshacer",
    "editor.contextMenu.redo": "Rehacer",
    "editor.contextMenu.cut": "Cortar",
    "editor.contextMenu.copy": "Copiar",
    "editor.contextMenu.paste": "Pegar",
    "editor.contextMenu.selectAll": "Seleccionar todo",

    // Preview
    "preview.title": "Preview",
    "preview.desktop": "Simulacion desktop",
    "preview.hide": "Ocultar",
    "preview.openHint": "Abri un archivo de configuracion para ver la preview",
    "preview.openSubhint": "Hyprland, Waybar, Kitty, Rofi, Neovim...",
    "preview.rofiToggle": "Rofi",
    "preview.makoToggle": "Mako",
    "preview.clickFocus": "Click en las ventanas para enfocar",
    "preview.hyprland.title": "Simulacion Desktop",

    // CommandPalette
    "cmd.searchPlaceholder": "Buscar comandos...",
    "cmd.noResults": "Sin resultados",
    "cmd.openVault": "Abrir vault",
    "cmd.openVaultDesc": "Seleccionar carpeta de dotfiles",
    "cmd.themeDark": "Tema oscuro",
    "cmd.themeLight": "Tema claro",
    "cmd.themeSystem": "Tema del sistema",
    "cmd.snapshots": "Ver snapshots",
    "cmd.snapshotsDesc": "Panel de snapshots en la barra lateral",
    "cmd.graph": "Ver grafo de relaciones",
    "cmd.graphDesc": "Grafo de dependencias entre plugins",
    "cmd.plugins": "Gestionar plugins",
    "cmd.pluginsDesc": "Panel de plugins en la barra lateral",
    "cmd.togglePreview": "Mostrar/ocultar preview",
    "cmd.toggleSidebar": "Mostrar/ocultar barra lateral",
    "cmd.toggleDesktop": "Mostrar/ocultar simulacion desktop",
    "cmd.settings": "Configuracion",
    "cmd.settingsDesc": "Abrir panel de configuracion",
    "cmd.newPlugin": "Crear nuevo plugin",
    "cmd.newPluginDesc": "Crear un plugin personalizado con plantilla",
    "cmd.cat.appearance": "Apariencia",
    "cmd.cat.navigation": "Navegacion",
    "cmd.cat.plugins": "Plugins",
    "cmd.cat.view": "Vista",
    "cmd.cat.system": "Sistema",
    "cmd.cat.files": "Archivos",

    // Settings
    "settings.title": "Configuracion",
    "settings.subtitle": "Preferencias de Riceboard",
    "settings.close": "Cerrar",
    "settings.language": "Idioma",
    "settings.theme": "Tema",
    "settings.theme.dark": "Oscuro",
    "settings.theme.light": "Claro",
    "settings.theme.system": "Sistema",
    "settings.fontSizes": "Font Sizes de Simulacion",
    "settings.fontSizes.reset": "Resetear todo",
    "settings.fontSizes.desc": "Ajustar tamanos de fuente para cada simulacion de plugin",
    "settings.activePlugins": "Plugins activos",

    // NewPlugin
    "newPlugin.title": "Crear nuevo plugin",
    "newPlugin.subtitle": "Elegi una plantilla o crea uno personalizado",
    "newPlugin.templates": "Plantillas",
    "newPlugin.custom": "Personalizado",
    "newPlugin.namePlaceholder": "Nombre del plugin (ej: mi-tema)",
    "newPlugin.filePlaceholder": "Nombre del archivo (ej: config.toml)",
    "newPlugin.cancel": "Cancelar",
    "newPlugin.create": "Crear plugin",
    "newPlugin.creating": "Creando...",

    // VaultSetup
    "vault.title": "Configurar vault",
    "vault.detecting": "Detectando estructura existente...",
    "vault.hint": "Plugins con configs existentes estan marcados en verde. Solo se crean los que falten.",
    "vault.filesCreated": "Archivos creados:",
    "vault.skip": "Saltar",
    "vault.close": "Cerrar",
    "vault.create": "Crear estructura",
    "vault.creating": "Creando...",
    "vault.exists": "Ya existe ({count} archivos)",

    // Misc
    "misc.binds": "binds",

    // Live Preview
    "live.start": "Iniciar preview en vivo",
    "live.stop": "Detener preview en vivo",
    "live.running": "Ejecutando en vivo",
    "live.notAvailable": "No disponible en este SO",
    "live.packageNotFound": "Paquete no instalado",
    "live.runningAnother": "Otro preview en vivo esta corriendo",
  },
};

let currentLanguage: Language = "en";

try {
  const saved = localStorage.getItem("riceboard:language");
  if (saved === "en" || saved === "es") currentLanguage = saved;
} catch {}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  try { localStorage.setItem("riceboard:language", lang); } catch {}
}

export function t(key: string): string {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}
