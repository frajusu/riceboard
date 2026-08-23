use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub children: Option<Vec<FileNode>>,
    pub plugin: Option<String>,
}

fn detect_plugin(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    let plugins = [
        "hyprland", "waybar", "kitty", "alacritty", "ghostty", "wezterm",
        "rofi", "wofi", "fuzzel", "walker", "neovim", "nvim", "helix",
        "zsh", "bash", "fish", "tmux", "btop", "htop", "mako", "dunst",
        "swww", "hyprpaper", "swaybg", "eww", "ags", "cava", "pywal",
        "wallust", "matugen", "hyprlock", "swaylock", "hypridle", "swayidle",
        "foot", "vscode", "fastfetch", "starship",
    ];
    for plugin in plugins {
        if lower.contains(plugin) {
            return Some(plugin.to_string());
        }
    }
    None
}

fn scan_dir(path: &PathBuf, depth: usize) -> Vec<FileNode> {
    let mut nodes = Vec::new();
    if depth > 10 {
        return nodes;
    }

    if let Ok(entries) = fs::read_dir(path) {
        let mut sorted: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        sorted.sort_by(|a, b| {
            let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
            b_dir.cmp(&a_dir).then_with(|| a.file_name().cmp(&b.file_name()))
        });

        for entry in sorted {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == ".riceboard" {
                continue;
            }
            let entry_path = entry.path();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

            let node = if is_dir {
                FileNode {
                    id: entry_path.to_string_lossy().to_string(),
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    file_type: "directory".to_string(),
                    children: Some(scan_dir(&entry_path, depth + 1)),
                    plugin: None,
                }
            } else {
                FileNode {
                    id: entry_path.to_string_lossy().to_string(),
                    name: name.clone(),
                    path: entry_path.to_string_lossy().to_string(),
                    file_type: "file".to_string(),
                    children: None,
                    plugin: detect_plugin(&name),
                }
            };
            nodes.push(node);
        }
    }
    nodes
}

#[tauri::command]
pub fn scan_directory(path: String) -> Vec<FileNode> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        scan_dir(&p, 0)
    } else {
        vec![]
    }
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(vault_path: String, name: String) -> Result<String, String> {
    let path = PathBuf::from(&vault_path).join(&name);
    if path.exists() {
        return Err("File already exists".to_string());
    }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_snapshot(vault_path: String) -> Result<String, String> {
    let vault = PathBuf::from(&vault_path);
    if !vault.is_dir() {
        return Err("Not a directory".to_string());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let snapshot_dir = vault.join(".riceboard").join("snapshots");
    fs::create_dir_all(&snapshot_dir).map_err(|e| e.to_string())?;

    let snapshot_name = format!("snapshot_{}", timestamp);
    let snapshot_path = snapshot_dir.join(&snapshot_name);
    fs::create_dir_all(&snapshot_path).map_err(|e| e.to_string())?;

    fn copy_recursive(from: &PathBuf, to: &PathBuf) -> Result<(), String> {
        if from.is_dir() {
            fs::create_dir_all(to).map_err(|e| e.to_string())?;
            if let Ok(entries) = fs::read_dir(from) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let name = entry.file_name();
                    let from_path = entry.path();
                    let to_path = to.join(&name);
                    if name.to_string_lossy().to_string() == ".riceboard" {
                        continue;
                    }
                    if from_path.is_dir() {
                        copy_recursive(&from_path, &to_path)?;
                    } else {
                        fs::copy(&from_path, &to_path).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        Ok(())
    }

    copy_recursive(&vault, &snapshot_path)?;
    Ok(snapshot_name)
}

fn default_configs() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("hyprland", "# Hyprland config\n\nmonitor = , preferred, auto, 1\n\n$mainMod = SUPER\n\nbind = $mainMod, Return, exec, kitty\nbind = $mainMod, Q, killactive\nbind = $mainMod, V, togglefloating\nbind = $mainMod, F, fullscreen\nbind = $mainMod, 1, workspace, 1\nbind = $mainMod, 2, workspace, 2\nbind = $mainMod, 3, workspace, 3\n\nexec-once = waybar\nexec-once = mako\nexec-once = swww init\n\ngeneral {\n    gaps_in = 5\n    gaps_out = 10\n    border_size = 2\n    col.active_border = rgba(cba6f7ee)\n    col.inactive_border = rgba(45475aee)\n    layout = dwindle\n}\n\ndecoration {\n    rounding = 8\n    blur {\n        enabled = true\n        size = 3\n        passes = 1\n    }\n}\n\nanimations {\n    enabled = true\n    bezier = ease, 0.25, 0.1, 0.25, 1\n    animation = windows, 1, 4, ease\n    animation = fade, 1, 4, ease\n    animation = workspaces, 1, 4, ease\n}\n");
    m.insert("waybar", "{\n  \"layer\": \"top\",\n  \"position\": \"top\",\n  \"height\": 30,\n  \"spacing\": 4,\n  \"modules-left\": [\"hyprland/workspaces\", \"hyprland/window\"],\n  \"modules-center\": [\"clock\"],\n  \"modules-right\": [\"pulseaudio\", \"network\", \"battery\", \"tray\"],\n  \"clock\": {\n    \"format\": \"{:%H:%M}\",\n    \"format-alt\": \"{:%A, %B %d, %Y}\"\n  },\n  \"battery\": {\n    \"states\": { \"warning\": 30, \"critical\": 15 },\n    \"format\": \"{icon} {capacity}%\",\n    \"format-charging\": \"\u{f0e7} {capacity}%\"\n  },\n  \"pulseaudio\": {\n    \"format\": \"{icon} {volume}%\",\n    \"format-muted\": \"\u{f6a9} Muted\"\n  },\n  \"network\": {\n    \"format-wifi\": \"\u{f1eb} {signalStrength}%\",\n    \"format-ethernet\": \"\u{f0ac} {ipaddr}\"\n  }\n}");
    m.insert("waybar-style", "/* Waybar styles */\n* {\n  font-family: JetBrainsMono Nerd Font;\n  font-size: 13px;\n}\n\nwindow#waybar {\n  background: rgba(17, 17, 27, 0.85);\n  color: #cdd6f4;\n}\n\n#workspaces button {\n  padding: 0 5px;\n  color: #6c7086;\n  border-radius: 4px;\n}\n\n#workspaces button.active {\n  color: #cba6f7;\n  background: rgba(203, 166, 247, 0.15);\n}\n\n#clock, #battery, #pulseaudio, #network, #tray {\n  padding: 0 10px;\n}\n\n#battery.warning { color: #f9e2af; }\n#battery.critical { color: #f38ba8; }\n#battery.charging { color: #a6e3a1; }");
    m.insert("kitty", "# Kitty config\n\nfont_family      JetBrainsMono Nerd Font\nfont_size         12.0\nbold_font         JetBrainsMono Nerd Font Bold\nitalic_font       JetBrainsMono Nerd Font Italic\n\nbackground        #1e1e2e\nforeground        #cdd6f4\ncursor            #f5e0dc\ncursor_text_color #1e1e2e\n\nselection_background  #45475a\nselection_foreground  #cdd6f4\n\n# Black\ncolor0 #45475a\ncolor8 #585b70\n# Red\ncolor1 #f38ba8\ncolor9 #f38ba8\n# Green\ncolor2 #a6e3a1\ncolor10 #a6e3a1\n# Yellow\ncolor3 #f9e2af\ncolor11 #f9e2af\n# Blue\ncolor4 #89b4fa\ncolor12 #89b4fa\n# Magenta\ncolor5 #f5c2e7\ncolor13 #f5c2e7\n# Cyan\ncolor6 #89dceb\ncolor14 #89dceb\n# White\ncolor7 #bac2de\ncolor15 #a6adc8\n\nscrollback_lines 10000\nenable_audio_bell no\nwindow_padding_width 4\nhide_window_decorations no\nconfirm_os_window_close yes\nshell_integration no-cursor\n");
    m.insert("rofi", "/* Rofi config */\nconfiguration {\n  modi: \"drun,run,window\";\n  show-icons: true;\n  icon-theme: \"Papirus\";\n  font: \"JetBrainsMono Nerd Font 12\";\n  display-drun: \" Apps\";\n  display-run: \" Run\";\n  display-window: \" Windows\";\n}\n\n* {\n  bg: #1e1e2e;\n  bg-alt: #313244;\n  fg: #cdd6f4;\n  fg-alt: #a6adc8;\n  accent: #cba6f7;\n}\n\nwindow {\n  width: 600px;\n  background-color: @bg;\n  border: 2px solid;\n  border-color: @accent;\n  border-radius: 8px;\n  padding: 20px;\n}\n\ninputbar {\n  children: [prompt, entry];\n  padding: 8px;\n  border-radius: 4px;\n  background-color: @bg-alt;\n}\n\nlistview {\n  lines: 5;\n  spacing: 4px;\n  padding: 8px 0;\n}\n\nelement selected {\n  background-color: @accent;\n  color: @bg;\n  border-radius: 4px;\n}");
    m.insert("nvim", "-- Neovim config (init.lua)\n-- Bootstrap lazy.nvim\nlocal lazypath = vim.fn.stdpath(\"data\") .. \"/lazy/lazy.nvim\"\nif not vim.loop.fs_stat(lazypath) then\n  vim.fn.system({\n    \"git\", \"clone\", \"--filter=blob:none\",\n    \"https://github.com/folke/lazy.nvim.git\",\n    \"--branch=stable\", lazypath,\n  })\nend\nvim.opt.rtp:prepend(lazypath)\n\nrequire(\"lazy\").setup({\n  { \"catppuccin/nvim\", name = \"catppuccin\", priority = 1000 },\n  { \"nvim-telescope/telescope.nvim\", dependencies = { \"nvim-lua/plenary.nvim\" } },\n  { \"nvim-treesitter/nvim-treesitter\", build = \":TSUpdate\" },\n  { \"neovim/nvim-lspconfig\" },\n  { \"hrsh7th/nvim-cmp\", dependencies = { \"hrsh7th/cmp-nvim-lsp\", \"hrsh7th/cmp-buffer\", \"hrsh7th/cmp-path\" } },\n  { \"lukas-reineke/indent-blankline.nvim\" },\n  { \"numToStr/Comment.nvim\" },\n  { \"nvim-lualine/lualine.nvim\" },\n})\n\nvim.cmd.colorscheme(\"catppuccin\")\n\nlocal opt = vim.opt\nopt.number = true\nopt.relativenumber = true\nopt.tabstop = 2\nopt.shiftwidth = 2\nopt.expandtab = true\nopt.smartindent = true\nopt.wrap = false\nopt.swapfile = false\nopt.backup = false\nopt.undofile = true\nopt.incsearch = true\nopt.termguicolors = true\nopt.scrolloff = 8\nopt.signcolumn = \"yes\"\nopt.cursorline = true\n\nlocal map = vim.keymap.set\nmap(\"n\", \"<leader>ff\", \"<cmd>Telescope find_files<cr>\")\nmap(\"n\", \"<leader>fg\", \"<cmd>Telescope live_grep<cr>\")\nmap(\"n\", \"<leader>fb\", \"<cmd>Telescope buffers<cr>\")\nmap(\"n\", \"<leader>e\", \"<cmd>NvimTreeToggle<cr>\")\nmap(\"n\", \"<C-s>\", \"<cmd>w<cr>\")\n");
    m.insert("nvim-snacks", "-- Snacks dashboard\n{ \"folke/snacks.nvim\", opts = { dashboard = { enabled = true } } }");
    m.insert("mako", "# Mako notification daemon config\nfont=JetBrainsMono Nerd Font 10\nwidth=350\nheight=150\nborder-radius=8\nmargin-top=10\nmargin-right=10\npadding=15\nbackground-color=#1e1e2ee6\ntext-color=#cdd6f4\nborder-color=#cba6f7\nborder-size=2\nprogress-color=#a6e3a1\nmax-visible=5\ndefault-timeout=5000\nlayer=overlay\nanchor=top-right\n");
    m.insert("zsh", "# Oh My Zsh config\nexport ZSH=\"$HOME/.oh-my-zsh\"\n\nZSH_THEME=\"powerlevel10k/powerlevel10k\"\n\nplugins=(\n  git\n  zsh-autosuggestions\n  zsh-syntax-highlighting\n  zsh-completions\n  zsh-history-substring-search\n)\n\nsource $ZSH/oh-my-zsh.sh\n\n# Aliases\nalias ll=\"ls -la\"\nalias la=\"ls -A\"\nalias l=\"ls -CF\"\nalias update=\"sudo pacman -Syu\"\nalias install=\"sudo pacman -S\"\nalias search=\"pacman -Ss\"\n\n# NVM\nexport NVM_DIR=\"$HOME/.nvm\"\n[ -s \"$NVM_DIR/nvm.sh\" ] && \\., \"$NVM_DIR/nvm.sh\"\n[ -s \"$NVM_DIR/bash_completion\" ] && \\., \"$NVM_DIR/bash_completion\"\n\n# pnpm\nexport PNPM_HOME=\"$HOME/.local/share/pnpm\"\nexport PATH=\"$PNPM_HOME:$PATH\"\n");
    m.insert("tmux", "# Tmux config\nset -g prefix C-s\nunbind C-b\n\nset -g mouse on\nset -g base-index 1\nsetw -g pane-base-index 1\nset -g renumber-windows on\nset -g set-clipboard on\nset -g history-limit 50000\n\n# Reload config\nbind r source-file ~/.tmux.conf \\; display \"Config reloaded!\"\n\n# Split panes\nbind | split-window -h -c \"#{pane_current_path}\"\nbind - split-window -v -c \"#{pane_current_path}\"\nunbind '\"'\nunbind %\n\n# Navigate panes\nbind -n M-Left select-pane -L\nbind -n M-Right select-pane -R\nbind -n M-Up select-pane -U\nbind -n M-Down select-pane -D\n\n# Vi mode\nsetw -g mode-keys vi\n\n# Plugins (TPM)\nset -g @plugin 'tmux-plugins/tpm'\nset -g @plugin 'tmux-plugins/tmux-sensible'\nset -g @plugin 'tmux-plugins/tmux-resurrect'\nset -g @plugin 'catppuccin/tmux'\n\nrun '~/.tmux/plugins/tpm/tpm'\n");
    m.insert("btop", "# Btop config\n# https://github.com/aristocratos/btop\n\nupdate_ms=2000\nproc_sorting=\"cpu lazy\"\nproc_cores=True\nproc_memory=True\nproc_graphs=True\nuse_icons=True\ncolor_theme=catppuccin_mocha\ntheme_background=False\ngpu_mirror_inverted=True\n\n# Custom presets\n[cpu_graph]\n    mid_cpu=True\n    cpu_counters=True\n\n[mem_graph]\n    mem_graphs=True\n    swap_graph=True\n");
    m.insert("swww", "# SWWW wallpaper daemon\n# No persistent config file - use at runtime:\n# swww img /path/to/wallpaper --transition-type fade --transition-duration 1\n# swww img /path/to/wallpaper --transition-type wipe --transition-angle 45\n# swww img /path/to/wallpaper --transition-type grow --transition-pos center\n\n# Common transition types: fade, wipe, grow, outer, left, right, top, bottom\n# Default: fade with 0.5s duration at 60fps");
    m.insert("dunst", "[global]\n    monitor = 0\n    follow = mouse\n    width = 350\n    height = 150\n    origin = top-right\n    offset = 10x10\n    scale = 0\n    notification_limit = 5\n    progress_bar = true\n    progress_bar_height = 10\n    progress_bar_frame_width = 1\n    progress_bar_min_width = 150\n    progress_bar_max_width = 300\n\n    indicate_hidden = yes\n    transparency = 0\n    separator_height = 2\n    padding = 15\n    horizontal_padding = 15\n    text_icon_padding = 0\n    frame_width = 2\n    frame_color = \"#cba6f7\"\n    gap_size = 0\n    separator_color = frame\n    sort = yes\n    idle_threshold = 120\n\n    font = JetBrainsMono Nerd Font 10\n    line_height = 0\n    markup = full\n    format = \"<b>%s</b>\\n%b\"\n    alignment = left\n    vertical_alignment = center\n    show_age_threshold = 60\n    ellipsize = middle\n    ignore_newline = no\n    stack_duplicates = true\n    hide_duplicate_count = false\n    show_indicators = yes\n\n    icon_position = left\n    min_icon_size = 32\n    max_icon_size = 64\n    corner_radius = 8\n\n    history_length = 200\n    show_age_threshold = 60\n\n    corner_radius = 8\n    mouse_left_click = close_current\n    mouse_middle_click = do_action, close_current\n    mouse_right_click = close_all\n\n[urgency_low]\n    background = \"#1e1e2e\"\n    foreground = \"#cdd6f4\"\n    timeout = 5\n\n[urgency_normal]\n    background = \"#1e1e2e\"\n    foreground = \"#cdd6f4\"\n    timeout = 10\n\n[urgency_critical]\n    background = \"#1e1e2e\"\n    foreground = \"#cdd6f4\"\n    frame_color = \"#f38ba8\"\n    timeout = 0\n");
    m.insert("alacritty", "# Alacritty config\n\n[window]\npadding = { x = 4, y = 4 }\ndecorations = \"Full\"\noption_as_alt = \"Option\"\n\n[font]\nnormal = { family = \"JetBrainsMono Nerd Font\", style = \"Regular\" }\nbold = { family = \"JetBrainsMono Nerd Font\", style = \"Bold\" }\nitalic = { family = \"JetBrainsMono Nerd Font\", style = \"Italic\" }\nsize = 12.0\n\n[colors.primary]\nbackground = \"#1e1e2e\"\nforeground = \"#cdd6f4\"\ndim_foreground = \"#7f849c\"\n\n[colors.normal]\nblack = \"#45475a\"\nred = \"#f38ba8\"\ngreen = \"#a6e3a1\"\nyellow = \"#f9e2af\"\nblue = \"#89b4fa\"\nmagenta = \"#f5c2e7\"\ncyan = \"#89dceb\"\nwhite = \"#bac2de\"\n\n[colors.bright]\nblack = \"#585b70\"\nred = \"#f38ba8\"\ngreen = \"#a6e3a1\"\nyellow = \"#f9e2af\"\nblue = \"#89b4fa\"\nmagenta = \"#f5c2e7\"\ncyan = \"#89dceb\"\nwhite = \"#a6adc8\"\n\n[cursor]\nstyle = { shape = \"Block\", blinking = \"On\" }\ncursor.unfocused_hollow = true\n\n[mouse]\nhide_when_typing = true\n\n[scrolling]\nhistory = 10000\n");
    m.insert("ghostty", "# Ghostty config\n\nfont-family = JetBrainsMono Nerd Font\nfont-size = 12\nfont-style = Regular\n\nbackground = #1e1e2e\nforeground = #cdd6f4\ncursor-color = #f5e0dc\ncursor-text = #1e1e2e\nselection-background = #45475a\nselection-foreground = #cdd6f4\n\npalette = 0=#45475a\npalette = 1=#f38ba8\npalette = 2=#a6e3a1\npalette = 3=#f9e2af\npalette = 4=#89b4fa\npalette = 5=#f5c2e7\npalette = 6=#89dceb\npalette = 7=#bac2de\npalette = 8=#585b70\npalette = 9=#f38ba8\npalette = 10=#a6e3a1\npalette = 11=#f9e2af\npalette = 12=#89b4fa\npalette = 13=#f5c2e7\npalette = 14=#89dceb\npalette = 15=#a6adc8\n\nwindow-padding-x = 4\nwindow-padding-y = 4\nwindow-decoration = true\nwindow-save-state = true\nscrollback-limit = 10000\nmouse-hide-while-typing = true\n");
    m.insert("fish", "# Fish shell config\n\n# Theme\nset -g fish_theme Catppuccin Mocha\n\n# Fisher\nif not functions -q fisher\n    curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source\n    fisher install jorgebucaran/fisher\nend\n\n# Plugins\nfisher install catppuccin/fish\nfisher install jethrokuan/z\nfisher install jethrokuan/fzf\nfisher install ilancosmos/tide\nfisher install franchise-consulting/gruvbox-fish\n\n# Aliases\nalias ll \"ls -la\"\nalias la \"ls -A\"\nalias l \"ls -CF\"\nalias gs \"git status\"\nalias ga \"git add\"\nalias gc \"git commit\"\nalias gp \"git push\"\nalias update \"paru -Syu\"\nalias install \"paru -S\"\nalias search \"paru -Ss\"\n\n# Environment\nset -gx EDITOR nvim\nset -gx VISUAL nvim\nset -gx PATH $HOME/.local/bin $PATH\nset -gx PATH $HOME/.cargo/bin $PATH\nset -gx PNPM_HOME \"$HOME/.local/share/pnpm\"\nset -gx PATH $PNPM_HOME $PATH\n\n# FZF\nset -gx FZF_DEFAULT_COMMAND 'fd --type f --hidden --follow --exclude .git'\nset -gx FZF_CTRL_T_COMMAND $FZF_DEFAULT_COMMAND\nset -gx FZF_ALT_C_COMMAND 'fd --type d --hidden --follow --exclude .git'\n\n# Starship\nstarship init fish | source\n");
    m.insert("bash", "# Bash config\n\n# If not running interactively, don't do anything\n[[ $- != *i* ]] && return\n\n# History\nHISTSIZE=10000\nSAVEHIST=10000\nHISTFILE=~/.bash_history\nset -o vi\n\n# Prompt\nPS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '\n\n# Aliases\nalias ll='ls -la'\nalias la='ls -A'\nalias l='ls -CF'\nalias grep='grep --color=auto'\nalias update='sudo pacman -Syu'\nalias install='sudo pacman -S'\nalias search='pacman -Ss'\n\n# NVM\nexport NVM_DIR=\"$HOME/.nvm\"\n[ -s \"$NVM_DIR/nvm.sh\" ] && \\., \"$NVM_DIR/nvm.sh\"\n[ -s \"$NVM_DIR/bash_completion\" ] && \\., \"$NVM_DIR/bash_completion\"\n\n# Conda\n# >>> conda initialize >>>\n# !! Contents within this block are managed by 'conda init' !!\n__conda_setup=\"$('/usr/bin/conda' 'shell.bash' 'hook' 2> /dev/null)\"\nif [ $? -eq 0 ]; then\n    eval \"$__conda_setup\"\nelse\n    if [ -f \"/opt/miniconda3/etc/profile.d/conda.sh\" ]; then\n        . \"/opt/miniconda3/etc/profile.d/conda.sh\"\n    else\n        export PATH=\"/opt/miniconda3/bin:$PATH\"\n    fi\nfi\nunset __conda_setup\n# <<< conda initialize <<<\n");
    m.insert("wofi", "# Wofi config\nwidth=600\nheight=400\nlocation=center\nshow=drun\nprompt=Search...\nallow_images=true\nimage_size=32\ncase_sensitive=false\nallow_markup=true\nno_actions=true\nhalign=fill\norientation=vertical\ncontent_halign=fill\ninsensitive=\nallow_images=true\ndynamic_lines=true\n");
    m.insert("hyprpaper", "# Hyprpaper config\npreload = /path/to/wallpaper.jpg\nwallpaper = , /path/to/wallpaper.jpg\nsplash = false\nipc = on\n\n# You can also use swww for dynamic wallpapers:\n# preload = ~/wallpapers/1.jpg\n# wallpaper = eDP-1, ~/wallpapers/1.jpg");
    m.insert("hyprlock", "# Hyprlock config\n\nbackground {\n    monitor =\n    path = /path/to/wallpaper.jpg\n    blur_passes = 4\n    blur_size = 8\n    noise = 0.0117\n    contrast = 0.9\n    brightness = 0.8\n    vibrancy = 0.21\n    vibrancy_darkness = 0.7\n}\n\ngeneral {\n    no_fade_in = false\n    no_fade_out = false\n    ignore_empty_input = false\n    fail_timeout = 1000\n}\n\ninput-field {\n    monitor =\n    size = 300, 50\n    outline_thickness = 2\n    dots_size = 0.25\n    dots_spacing = 0.2\n    dots_center = true\n    outer_color = rgba(203, 166, 247, 0.5)\n    inner_color = rgba(30, 30, 46, 0.8)\n    font_color = rgba(205, 214, 244, 1)\n    fade_on_empty = true\n    placeholder_text = <span foreground=\"##cdd6f4\">Password...</span>\n    hide_input = false\n    rounding = 8\n    check_color = rgba(166, 227, 161, 1)\n    fail_color = rgba(243, 139, 168, 1)\n    capslock_color = rgba(249, 226, 175, 1)\n    numlock_color = rgba(137, 180, 250, 1)\n    bothlock_color = rgba(147, 220, 235, 1)\n    numlock_visible = true\n    capslock_visible = true\n    position = 0, -200\n    halign = center\n    valign = center\n}\n\nlabel {\n    monitor =\n    text = cmd[update:1000] echo \"$(date +\"%A, %B %d\")\"\n    color = rgba(205, 214, 244, 1)\n    font_size = 22\n    font_family = JetBrainsMono Nerd Font\n    position = 0, 80\n    halign = center\n    valign = center\n}\n\nlabel {\n    monitor =\n    text = cmd[update:1000] echo \"$(date +\"%I:%M %p\")\"\n    color = rgba(205, 214, 244, 1)\n    font_size = 94\n    font_family = JetBrainsMono Nerd Font\n    position = 0, 0\n    halign = center\n    valign = center\n}\n");
    m.insert("eww", ";; Eww config - eww.yuck\n\n(defwindow main\n  :stacking \"fg\"\n  :geometry (geometry :x \"0%\" :y \"0%\" :width \"100%\" :height \"30px\" :anchor \"top center\")\n  (bar))\n\n(defwidget bar []\n  (box :class \"bar\" :space-evenly true :halign \"fill\" :valign \"center\"\n    (workspaces)\n    (clock)\n    (tray)))\n\n(defwidget workspaces []\n  (box :class \"workspaces\" :space-evenly true\n    (button :class \"ws\" \"1\")\n    (button :class \"ws\" \"2\")\n    (button :class \"ws\" \"3\")\n    (button :class \"ws\" \"4\")\n    (button :class \"ws\" \"5\")))\n\n(defwidget clock []\n  (label :class \"clock\"\n    :text \"${time}\"\n    :update 1000))\n\n(defwidget tray []\n  (systray))\n\n(defvar time \"\")\n\n(script :period \"1s\"\n  \"date '+%H:%M:%S'\"\n  (setvar time))\n");
    m.insert("eww-style", "/* Eww bar styles */\n* {\n  font-family: JetBrainsMono Nerd Font;\n  font-size: 13px;\n}\n\n.bar {\n  background: rgba(17, 17, 27, 0.85);\n  color: #cdd6f4;\n  padding: 0 10px;\n}\n\n.workspaces button {\n  padding: 0 5px;\n  color: #6c7086;\n  border-radius: 4px;\n  background: transparent;\n}\n\n.workspaces button:hover {\n  color: #cba6f7;\n  background: rgba(203, 166, 247, 0.15);\n}\n\n.clock {\n  color: #cdd6f4;\n  padding: 0 10px;\n}\n");
    m.insert("cava", "# Cava config\n\n# Input\nmethod = auto\nsource = auto\n\n# Framerate\nframerate = 60\nautosens = 1\nsensitivity = 100\n\n# Bars\nbars = 0\nbar_width = 20\nbar_spacing = 0\nbar_height = 320\n\n# Colors\ncolor = catppuccin_mocha\n\n[gradient]\n1 = #cba6f7\n2 = #f5c2e7\n3 = #89b4fa\n4 = #89dceb\n5 = #a6e3a1\n6 = #f9e2af\n7 = #f38ba8\n\n[smoothing]\nintegral = 0.01\nmonstercat = 1\nwaves = 0.0\n\n# Controls\ndata_format = binary\nbinary_data = 0\n\n# Spectrum\nshow = inactive\nstereo = combined\n\n# Shadows\nshadow_range = 0.7\nshadow_bits = 2\n\n# Blur\nblur = 0\nnoise = 0.01\n");
    m.insert("starship", "# Starship prompt config\nformat = \"\"\"\n[\\[\\[\\[fg:#cba6f7$brightness$](bg:#313244 fg:#45475a)\\u{e0b2}](bg:#313244)\\[\\[\\[fg:#313244 bg:#1e1e2e]\\u{e0b2}](fg:#313244 bg:#1e1e2e)\n[isaac@arch](fg:#cba6f7 bg:#1e1e2e) \\[\\[\\[fg:#1e1e2e bg:#313244]\\u{e0b2}](fg:#313244 bg:#1e1e2e)\\[\\[\\[fg:#cba6f7 bg:#313244] $directory](bg:#313244 fg:#cba6f7)\n[\\[\\[\\[fg:#313244 bg:#1e1e2e]\\u{e0b2}](fg:#1e1e2e bg:#1e1e2e)\\n$character\"\"\"\n\n[directory]\nstyle = \"fg:#cba6f7 bg:#313244\"\ntruncation_length = 4\ntruncation_symbol = \".../\"\n\n[directory.substitutions]\n\"Documents\" = \"󰈙 \"\n\"Downloads\" = \" \"\n\"Music\" = \"󰝚 \"\n\"Pictures\" = \" \"\n\"Developer\" = \" \"\n\n[character]\nsuccess_symbol = \"[❯](fg:#a6e3a1)\"\nerror_symbol = \"[❯](fg:#f38ba8)\"\n\n[git_branch]\nstyle = \"fg:#f9e2af\"\nsymbol = \" \"\n\n[git_status]\nstyle = \"fg:#f38ba8\"\n\n[nodejs]\nsymbol = \" \"\nstyle = \"fg:#a6e3a1\"\n\n[rust]\nsymbol = \"🦀 \"\nstyle = \"fg:#f38ba8\"\n\n[python]\nsymbol = \" \"\nstyle = \"fg:#f9e2af\"\n\n[docker_context]\nsymbol = \" \"\nstyle = \"fg:#89b4fa\"\n\n[cmd_duration]\nmin_time = 2_000\nstyle = \"fg:#89dceb\"\nformat = \"took [$duration]($style) \"\n");
    m.insert("fastfetch", "{\n  \"$schema\": \"https://github.com/fastfetch-cli/fastfetch/raw/dev/doc/json_schema.json\",\n  \"logo\": {\n    \"type\": \"small\",\n    \"padding\": {\n      \"top\": 1,\n      \"left\": 2,\n      \"right\": 2\n    }\n  },\n  \"display\": {\n    \"color\": {\n      \"keys\": \"cyan\",\n      \"title\": \"cyan\"\n    },\n    \"separator\": \" -> \"\n  },\n  \"modules\": [\n    \"title\",\n    \"separator\",\n    \"os\",\n    \"host\",\n    \"kernel\",\n    \"uptime\",\n    \"packages\",\n    \"shell\",\n    \"terminal\",\n    \"de\",\n    \"wm\",\n    \"wmtheme\",\n    \"separator\",\n    \"cpu\",\n    \"gpu\",\n    \"memory\",\n    \"swap\",\n    \"disk\",\n    \"separator\",\n    \"localip\",\n    \"battery\",\n    \"player\",\n    \"locale\",\n    \"break\",\n    \"colors\"\n  ]\n}");
    m
}

#[tauri::command]
pub fn check_vault_structure(vault_path: String) -> Result<HashMap<String, Vec<String>>, String> {
    let vault = PathBuf::from(&vault_path);
    if !vault.is_dir() {
        return Err("Not a directory".to_string());
    }

    let plugin_dirs: HashMap<&str, Vec<&str>> = HashMap::from([
        ("hyprland", vec!["hypr"]),
        ("waybar", vec!["waybar"]),
        ("kitty", vec!["kitty"]),
        ("alacritty", vec!["alacritty"]),
        ("rofi", vec!["rofi"]),
        ("wofi", vec!["wofi"]),
        ("neovim", vec!["nvim"]),
        ("nvim", vec!["nvim"]),
        ("zsh", vec!["zsh"]),
        ("fish", vec!["fish"]),
        ("mako", vec!["mako"]),
        ("dunst", vec!["dunst"]),
        ("tmux", vec!["tmux"]),
        ("btop", vec!["btop"]),
        ("swww", vec!["swww"]),
        ("eww", vec!["eww"]),
        ("cava", vec!["cava"]),
        ("fastfetch", vec!["fastfetch"]),
    ]);

    let plugin_files: HashMap<&str, Vec<&str>> = HashMap::from([
        ("hyprland", vec!["hypr/hyprland.conf", "hypr/hyprland.lua"]),
        ("waybar", vec!["waybar/config", "waybar/config.jsonc", "waybar/style.css"]),
        ("kitty", vec!["kitty/kitty.conf"]),
        ("alacritty", vec!["alacritty/alacritty.toml", "alacritty/alacritty.yml"]),
        ("ghostty", vec!["ghostty/config"]),
        ("rofi", vec!["rofi/config.rasi"]),
        ("wofi", vec!["wofi/config"]),
        ("neovim", vec!["nvim/init.lua"]),
        ("nvim", vec!["nvim/init.lua"]),
        ("zsh", vec!["zsh/.zshrc"]),
        ("fish", vec!["fish/config.fish"]),
        ("bash", vec![".bashrc", ".bash_profile"]),
        ("mako", vec!["mako/config"]),
        ("dunst", vec!["dunst/dunstrc"]),
        ("tmux", vec!["tmux/tmux.conf", ".tmux.conf"]),
        ("btop", vec!["btop/btop.conf"]),
        ("swww", vec!["swww"]),
        ("hyprpaper", vec!["hyprpaper.conf"]),
        ("hyprlock", vec!["hyprlock.conf"]),
        ("eww", vec!["eww/eww.yuck", "eww/eww.scss"]),
        ("cava", vec!["cava/config"]),
        ("starship", vec!["starship.toml"]),
        ("fastfetch", vec!["fastfetch/config.jsonc"]),
    ]);

    let mut result: HashMap<String, Vec<String>> = HashMap::new();

    for plugin_name in plugin_dirs.keys() {
        let mut existing = Vec::new();
        if let Some(dirs) = plugin_dirs.get(plugin_name) {
            for dir in dirs {
                if vault.join(dir).exists() {
                    existing.push(format!("dir:{}", dir));
                }
            }
        }
        if let Some(files) = plugin_files.get(plugin_name) {
            for file in files {
                if vault.join(file).exists() {
                    existing.push(format!("file:{}", file));
                }
            }
        }
        if !existing.is_empty() {
            result.insert(plugin_name.to_string(), existing);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn setup_vault(vault_path: String, plugins: Vec<String>) -> Result<Vec<String>, String> {
    let vault = PathBuf::from(&vault_path);
    if !vault.is_dir() {
        return Err("Not a directory".to_string());
    }

    let defaults = default_configs();
    let mut created = Vec::new();

    let plugin_dirs: HashMap<&str, Vec<&str>> = HashMap::from([
        ("hyprland", vec!["hypr"]),
        ("waybar", vec!["waybar"]),
        ("kitty", vec!["kitty"]),
        ("alacritty", vec!["alacritty"]),
        ("rofi", vec!["rofi"]),
        ("wofi", vec!["wofi"]),
        ("neovim", vec!["nvim", "nvim/lua"]),
        ("nvim", vec!["nvim", "nvim/lua"]),
        ("zsh", vec!["zsh"]),
        ("fish", vec!["fish"]),
        ("mako", vec!["mako"]),
        ("dunst", vec!["dunst"]),
        ("tmux", vec!["tmux"]),
        ("btop", vec!["btop"]),
        ("swww", vec!["swww"]),
        ("eww", vec!["eww"]),
        ("cava", vec!["cava"]),
        ("fastfetch", vec!["fastfetch"]),
    ]);

    let plugin_files: HashMap<&str, Vec<(&str, &str)>> = HashMap::from([
        ("hyprland", vec![("hypr/hyprland.conf", "hyprland")]),
        ("waybar", vec![("waybar/config", "waybar"), ("waybar/style.css", "waybar-style")]),
        ("kitty", vec![("kitty/kitty.conf", "kitty")]),
        ("alacritty", vec![("alacritty/alacritty.toml", "alacritty")]),
        ("ghostty", vec![("ghostty/config", "ghostty")]),
        ("rofi", vec![("rofi/config.rasi", "rofi")]),
        ("wofi", vec![("wofi/config", "wofi")]),
        ("neovim", vec![("nvim/init.lua", "nvim")]),
        ("nvim", vec![("nvim/init.lua", "nvim")]),
        ("zsh", vec![("zsh/.zshrc", "zsh")]),
        ("fish", vec![("fish/config.fish", "fish")]),
        ("bash", vec![(".bashrc", "bash")]),
        ("mako", vec![("mako/config", "mako")]),
        ("dunst", vec![("dunst/dunstrc", "dunst")]),
        ("tmux", vec![("tmux/tmux.conf", "tmux")]),
        ("btop", vec![("btop/btop.conf", "btop")]),
        ("swww", vec![("swww/wallpapers/.gitkeep", "")]),
        ("hyprpaper", vec![("hyprpaper.conf", "hyprpaper")]),
        ("hyprlock", vec![("hyprlock.conf", "hyprlock")]),
        ("eww", vec![("eww/eww.yuck", "eww"), ("eww/eww.scss", "eww-style")]),
        ("cava", vec![("cava/config", "cava")]),
        ("starship", vec![("starship.toml", "starship")]),
        ("fastfetch", vec![("fastfetch/config.jsonc", "fastfetch")]),
    ]);

    for plugin_name in &plugins {
        let name = plugin_name.as_str();
        if let Some(dirs) = plugin_dirs.get(name) {
            for dir in dirs {
                let dir_path = vault.join(dir);
                if !dir_path.exists() {
                    fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
                }
            }
        }
        if let Some(files) = plugin_files.get(name) {
            for (file_path, config_key) in files {
                let full_path = vault.join(file_path);
                if !full_path.exists() {
                    let content = defaults.get(config_key).unwrap_or(&"");
                    if !content.is_empty() {
                        if let Some(parent) = full_path.parent() {
                            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                        }
                        fs::write(&full_path, content).map_err(|e| e.to_string())?;
                        created.push(file_path.to_string());
                    }
                }
            }
        }
    }

    Ok(created)
}
