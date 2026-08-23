import React, { useRef, useEffect, useState, useCallback } from "react";
import { GitBranch, ZoomIn, ZoomOut, RotateCcw, Info } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  category: string;
  description: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

const categoryColors: Record<string, string> = {
  wm: "#89b4fa",
  bar: "#a6e3a1",
  terminal: "#cba6f7",
  shell: "#f9e2af",
  editor: "#f38ba8",
  launcher: "#fab387",
  wallpaper: "#89dceb",
  notification: "#f5c2e7",
  lock: "#eba0ac",
  other: "#a6adc8",
};

function buildGraphFromFiles(fileTree: any[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const pluginMap: Record<string, string> = {
    hyprland: "wm", waybar: "bar", kitty: "terminal", alacritty: "terminal",
    ghostty: "terminal", wezterm: "terminal", zsh: "shell", bash: "shell",
    fish: "shell", neovim: "editor", nvim: "editor", helix: "editor",
    rofi: "launcher", wofi: "launcher", fuzzel: "launcher", walker: "launcher",
    swww: "wallpaper", hyprpaper: "wallpaper", swaybg: "wallpaper",
    mako: "notification", dunst: "notification", swaync: "notification",
    hyprlock: "lock", swaylock: "lock",
    tmux: "terminal", btop: "terminal", cava: "terminal",
    eww: "bar", ags: "bar", starship: "shell",
  };

  function walk(items: any[]) {
    for (const item of items) {
      if (item.type === "directory" && item.children) {
        walk(item.children);
      } else if (item.plugin) {
        const cat = pluginMap[item.plugin] || "other";
        if (!nodes.find((n) => n.id === item.plugin)) {
          nodes.push({
            id: item.plugin,
            label: item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1),
            x: 0, y: 0,
            color: categoryColors[cat] || categoryColors.other,
            category: cat,
            description: item.name,
          });
        }
      }
    }
  }
  walk(fileTree);

  if (nodes.length === 0) {
    const defaults: GraphNode[] = [
      { id: "hyprland", label: "Hyprland", x: 250, y: 180, color: "#89b4fa", category: "wm", description: "Window manager" },
      { id: "waybar", label: "Waybar", x: 400, y: 100, color: "#a6e3a1", category: "bar", description: "Status bar" },
      { id: "kitty", label: "Kitty", x: 400, y: 260, color: "#cba6f7", category: "terminal", description: "Terminal emulator" },
      { id: "zsh", label: "Zsh", x: 550, y: 260, color: "#f9e2af", category: "shell", description: "Shell" },
      { id: "neovim", label: "Neovim", x: 550, y: 340, color: "#f38ba8", category: "editor", description: "Text editor" },
      { id: "rofi", label: "Rofi", x: 400, y: 340, color: "#fab387", category: "launcher", description: "App launcher" },
      { id: "swww", label: "SWWW", x: 100, y: 100, color: "#89dceb", category: "wallpaper", description: "Wallpaper daemon" },
      { id: "mako", label: "Mako", x: 100, y: 260, color: "#f5c2e7", category: "notification", description: "Notification daemon" },
      { id: "tmux", label: "Tmux", x: 550, y: 180, color: "#a6adc8", category: "terminal", description: "Terminal multiplexer" },
    ];
    nodes.push(...defaults);
    edges.push(
      { from: "hyprland", to: "waybar", label: "spawn" },
      { from: "hyprland", to: "kitty", label: "launch" },
      { from: "hyprland", to: "rofi", label: "launch" },
      { from: "hyprland", to: "swww", label: "exec" },
      { from: "hyprland", to: "mako", label: "exec" },
      { from: "kitty", to: "zsh", label: "runs" },
      { from: "kitty", to: "tmux", label: "runs" },
      { from: "zsh", to: "neovim", label: "launches" },
      { from: "tmux", to: "neovim", label: "launches" },
    );
  } else {
    // Build edges based on common relationships
    const relationships: [string, string, string][] = [
      ["hyprland", "waybar", "spawn"],
      ["hyprland", "kitty", "launch"],
      ["hyprland", "rofi", "launch"],
      ["hyprland", "wofi", "launch"],
      ["hyprland", "swww", "exec"],
      ["hyprland", "hyprpaper", "exec"],
      ["hyprland", "mako", "exec"],
      ["hyprland", "dunst", "exec"],
      ["hyprland", "hyprlock", "exec"],
      ["hyprland", "eww", "exec"],
      ["hyprland", "ags", "exec"],
      ["kitty", "zsh", "runs"],
      ["kitty", "bash", "runs"],
      ["kitty", "fish", "runs"],
      ["kitty", "tmux", "runs"],
      ["zsh", "neovim", "launches"],
      ["bash", "neovim", "launches"],
      ["fish", "neovim", "launches"],
      ["tmux", "neovim", "launches"],
      ["neovim", "nvim", "is"],
    ];
    const ids = nodes.map((n) => n.id);
    for (const [from, to, label] of relationships) {
      if (ids.includes(from) && ids.includes(to)) {
        edges.push({ from, to, label });
      }
    }
  }

  // Layout: circular around center
  const cx = 280, cy = 220, radius = 150;
  nodes.forEach((node, i) => {
    if (node.x === 0) {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      node.x = cx + radius * Math.cos(angle);
      node.y = cy + radius * Math.sin(angle);
    }
  });

  return { nodes, edges };
}

export function RelationGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileTree = useAppStore((s) => s.fileTree);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragNodeStart, setDragNodeStart] = useState({ x: 0, y: 0 });

  const { nodes, edges } = React.useMemo(
    () => buildGraphFromFiles(fileTree),
    [fileTree]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.width / 2 + offset.x, rect.height / 2 + offset.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-rect.width / 2, -rect.height / 2);

    // Draw edges with labels
    edges.forEach((edge) => {
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      if (!from || !to) return;

      const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;

      // Curved edge
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const cx2 = mx - dy * 0.15;
      const cy2 = my + dx * 0.15;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(cx2, cy2, to.x, to.y);
      ctx.strokeStyle = isHighlighted
        ? "rgba(137, 180, 250, 0.7)"
        : "rgba(137, 180, 250, 0.25)";
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();

      // Arrow
      const angle = Math.atan2(to.y - cy2, to.x - cx2);
      const arrowLen = 6;
      const ax = to.x - Math.cos(angle) * 20;
      const ay = to.y - Math.sin(angle) * 20;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowLen * Math.cos(angle - 0.4), ay - arrowLen * Math.sin(angle - 0.4));
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowLen * Math.cos(angle + 0.4), ay - arrowLen * Math.sin(angle + 0.4));
      ctx.strokeStyle = isHighlighted ? "rgba(137, 180, 250, 0.7)" : "rgba(137, 180, 250, 0.3)";
      ctx.lineWidth = isHighlighted ? 1.5 : 1;
      ctx.stroke();

      // Edge label
      if (edge.label && isHighlighted) {
        const lx = (from.x + to.x) / 2 - dy * 0.15 * 0.5;
        const ly = (from.y + to.y) / 2 + dx * 0.15 * 0.5;
        ctx.font = "9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(137, 180, 250, 0.6)";
        ctx.fillText(edge.label, lx, ly - 6);
      }
    });

    // Draw nodes
    nodes.forEach((node) => {
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode?.id === node.id;
      const radius = isHovered || isSelected ? 24 : 20;

      // Glow
      if (isHovered || isSelected) {
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 40);
        gradient.addColorStop(0, node.color + "30");
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shadow
      ctx.shadowColor = node.color + "40";
      ctx.shadowBlur = isHovered ? 12 : 4;
      ctx.shadowOffsetY = 2;

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color + (isHovered || isSelected ? "ff" : "bb");
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label below node
      ctx.fillStyle = isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.8)";
      ctx.font = `${isHovered || isSelected ? "bold " : ""}10px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y);

      // Category label
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.fillStyle = node.color + "aa";
      ctx.fillText(node.category, node.x, node.y + radius + 10);
    });

    ctx.restore();
  }, [nodes, edges, zoom, offset, hoveredNode, selectedNode]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getNodeAt = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (clientX - rect.left - rect.width / 2 - offset.x) / zoom + rect.width / 2;
      const y = (clientY - rect.top - rect.height / 2 - offset.y) / zoom + rect.height / 2;
      return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 22) || null;
    },
    [nodes, zoom, offset]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node) {
        setDragNode(node.id);
        setDragNodeStart({ x: node.x, y: node.y });
        setDragStart({ x: e.clientX, y: e.clientY });
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [getNodeAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragNode) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dx = (e.clientX - dragStart.x) / zoom;
        const dy = (e.clientY - dragStart.y) / zoom;
        const node = nodes.find((n) => n.id === dragNode);
        if (node) {
          node.x = dragNodeStart.x + dx;
          node.y = dragNodeStart.y + dy;
        }
        return;
      }

      if (isDragging) {
        setOffset({
          x: offset.x + (e.clientX - dragStart.x),
          y: offset.y + (e.clientY - dragStart.y),
        });
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const node = getNodeAt(e.clientX, e.clientY);
      setHoveredNode(node?.id || null);
      canvas.style.cursor = node ? "grab" : "default";
    },
    [isDragging, dragNode, dragStart, offset, zoom, getNodeAt, nodes, dragNodeStart]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragNode) {
        setDragNode(null);
        return;
      }
      if (isDragging) {
        setIsDragging(false);
        return;
      }
      // Click select
      const node = getNodeAt(e.clientX, e.clientY);
      setSelectedNode(node);
    },
    [isDragging, dragNode, getNodeAt]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(Math.max(z + delta, 0.3), 3));
    },
    []
  );

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Grafo de Relaciones
        </p>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 transition-all duration-100 hover:bg-accent/80 active:scale-95"
                onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 transition-all duration-100 hover:bg-accent/80 active:scale-95"
                onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 transition-all duration-100 hover:bg-accent/80 active:scale-95"
                onClick={resetView}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset vista</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        ref={containerRef}
        className="bg-card/50 rounded-lg border overflow-hidden relative"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-56"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredNode(null);
            setIsDragging(false);
            setDragNode(null);
          }}
          onWheel={handleWheel}
        />

        {/* Selected node info panel */}
        {selectedNode && (
          <div className="absolute bottom-2 left-2 right-2 bg-background/95 backdrop-blur-sm rounded-lg border p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedNode.color }}
                />
                <span className="text-xs font-medium">{selectedNode.label}</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {selectedNode.category}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setSelectedNode(null)}
              >
                <span className="text-xs">×</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {selectedNode.description} — Archivo: {selectedNode.description}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-3 gap-1">
        {Object.entries(categoryColors).slice(0, 9).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
