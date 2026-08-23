<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" alt="Riceboard Icon"/>
</p>

<h1 align="center">Riceboard</h1>

<p align="center">
  A visual dotfile manager for Linux ricing configs — built with Tauri v2, React, and Rust.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Rust-1.78-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
</p>

---

## What is Riceboard?

Riceboard is a **Mac-style visual dotfile manager** designed for Linux ricing. It lets you browse, edit, and preview your Hyprland, Waybar, Kitty, Neovim, and 20+ other configs with a beautiful, reactive simulation that updates as you type.

### Why Riceboard?

- **No more blind editing** — See your rice changes in real-time before saving
- **Mac-inspired UI** — Smooth animations, dark/light mode, traffic light buttons
- **Per-app simulations** — Each config tool gets its own realistic preview
- **Plugin system** — Extensible with custom validators and autocomplete
- **Vault management** — Organize all your dotfiles in one place with snapshots

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| **File Explorer** | Browse your dotfiles with an expandable tree view |
| **Code Editor** | Syntax-highlighted editor with real-time preview |
| **Live Simulation** | See changes reflected instantly as you type |
| **Snapshot System** | Create and restore backup snapshots of your configs |
| **Command Palette** | `Ctrl+K` to quickly navigate and execute commands |
| **Dark / Light Mode** | Full theme support with system preference detection |
| **Resizable Panels** | Drag sidebar and preview panel borders to resize |
| **Persistent State** | Remembers vault path, open tabs, layout, and plugin settings |

### Supported Plugins

| Plugin | Config Files | Preview |
|--------|-------------|---------|
| **Hyprland** | `hyprland.conf` | Window manager layout with animations |
| **Waybar** | `config`, `style.css` | Status bar with workspaces, clock, modules |
| **Kitty** | `kitty.conf` | Terminal with Catppuccin Mocha colors |
| **Alacritty** | `alacritty.toml` | Terminal with TOML config parsing |
| **Ghostty** | `config` | Terminal with key-value config |
| **Neovim** | `init.lua` | Editor with lazy.nvim setup |
| **Rofi** | `config.rasi` | App launcher with rasi format |
| **Wofi** | `config` | Wayland app launcher |
| **Zsh** | `.zshrc`, `.zshenv` | Shell with Oh My Zsh + plugins |
| **Fish** | `config.fish` | Shell with Fisher plugins |
| **Bash** | `.bashrc`, `.bash_profile` | Shell with aliases and NVM |
| **Tmux** | `tmux.conf` | Terminal multiplexer with TPM |
| **Btop** | `btop.conf` | System monitor with Catppuccin theme |
| **Mako** | `config` | Notification daemon with colors |
| **Dunst** | `dunstrc` | Notification daemon with INI config |
| **Hyprpaper** | `hyprpaper.conf` | Wallpaper manager |
| **Hyprlock** | `hyprlock.conf` | Lock screen with blur and labels |
| **SWWW** | — | Wallpaper daemon (runtime only) |
| **Eww** | `eww.yuck`, `eww.scss` | Widget system with LISP-like config |
| **Cava** | `config` | Audio visualizer with gradients |
| **Starship** | `starship.toml` | Cross-shell prompt with icons |
| **Fastfetch** | `config.jsonc` | System info with JSON config |

---

## Installation

### Download

Go to [Releases](https://github.com/your-username/riceboard/releases) and download the latest version for your platform:

| Platform | Format | File |
|----------|--------|------|
| **Windows** | NSIS Installer | `Riceboard_*_x64-setup.exe` |
| **macOS** | DMG | `Riceboard_*_x64.dmg` |
| **Linux** | AppImage | `Riceboard_*_amd64.AppImage` |

### Linux (Arch)

```bash
# Make AppImage executable
chmod +x Riceboard_*_amd64.AppImage

# Run it
./Riceboard_*_amd64.AppImage
```

### Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) 1.78+
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

```bash
# Clone the repo
git clone https://github.com/your-username/riceboard.git
cd riceboard

# Install dependencies
npm install

# Run in dev mode
npx tauri dev

# Build for production
npx tauri build
```

---

## Usage

1. **Open a vault** — Click the folder icon to select your dotfiles directory (e.g., `~/.config`)
2. **Browse files** — Navigate the sidebar tree, expand directories
3. **Edit configs** — Click a file to open it in the editor
4. **See changes** — The simulation updates live as you type
5. **Toggle plugins** — Use the red/green buttons in the sidebar to enable/disable plugins
6. **Create snapshots** — Save backups before making big changes
7. **Use the palette** — `Ctrl+K` for quick access to everything

---

## Screenshots

> *Coming soon — Screenshots of the dark mode interface with Hyprland simulation*

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Framer Motion, shadcn/ui
- **Backend:** Rust, Tauri v2
- **Icons:** Pillow (Python) for ICO/PNG generation
- **CI/CD:** GitHub Actions for multi-platform builds

---

## Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with Rust and React for the Linux ricing community
</p>
