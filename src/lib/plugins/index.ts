import { registerPlugin } from "../plugin-api";
import { hyprlandPlugin } from "./hyprland";
import { waybarPlugin } from "./waybar";
import { kittyPlugin } from "./kitty";

export function initPlugins() {
  registerPlugin(hyprlandPlugin.config, { validate: hyprlandPlugin.validate, getSuggestions: hyprlandPlugin.getSuggestions });
  registerPlugin(waybarPlugin.config, { validate: waybarPlugin.validate, getSuggestions: waybarPlugin.getSuggestions });
  registerPlugin(kittyPlugin.config, { validate: kittyPlugin.validate, getSuggestions: kittyPlugin.getSuggestions });
}

export { hyprlandPlugin, waybarPlugin, kittyPlugin };
