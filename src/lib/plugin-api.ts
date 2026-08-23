export interface PluginConfig {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  filePatterns: string[];
  configPaths: string[];
  previewComponent?: string;
  validator?: (content: string) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

export interface Plugin {
  config: PluginConfig;
  validate: (content: string) => ValidationResult;
  getSuggestions: (content: string, cursor: number) => Suggestion[];
}

export interface Suggestion {
  label: string;
  description: string;
  insertText: string;
  kind: "keyword" | "property" | "value" | "comment";
}

const plugins: Map<string, Plugin> = new Map();

export function registerPlugin(config: PluginConfig, impl: Omit<Plugin, "config">) {
  plugins.set(config.name, { config, ...impl });
}

export function getPlugin(name: string): Plugin | undefined {
  return plugins.get(name);
}

export function getAllPlugins(): Plugin[] {
  return Array.from(plugins.values());
}

export function detectPlugin(filename: string): Plugin | undefined {
  const lower = filename.toLowerCase();
  for (const plugin of plugins.values()) {
    if (
      plugin.config.filePatterns.some(
        (p) => lower === p || lower.endsWith(`/${p}`) || lower.includes(p)
      )
    ) {
      return plugin;
    }
  }
  return undefined;
}
