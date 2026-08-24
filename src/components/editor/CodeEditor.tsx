import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, Save, Circle, Scissors, Copy, ClipboardPaste, Undo2, Redo2, CheckSquare, AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useContextMenu } from "@/components/ui/context-menu";
import { t } from "@/lib/i18n";
import { validateConfig, type ConfigError } from "@/lib/config-validator";

const editorFontFamily = "'JetBrainsMono Nerd Font', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
const editorFontSize = 13;
const editorLineHeight = 1.6;
const editorPadding = 16;

function highlightSyntax(code: string, filename: string): React.ReactNode[] {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const keywords: Record<string, string[]> = {
    ini: ["bind", "monitor", "workspace", "input", "general", "decoration", "animations", "layerrule", "windowrule", "plugin", "exec", "exec-once", "env", "source"],
    conf: ["bind", "monitor", "workspace", "input", "general", "decoration", "animations", "layerrule", "windowrule", "plugin", "exec", "exec-once", "env", "source"],
    css: ["color", "background", "font", "padding", "margin", "border", "border-radius", "box-shadow", "transition", "hover", "active", "focus", "width", "height", "display", "flex", "grid"],
    lua: ["local", "function", "end", "if", "then", "else", "elseif", "for", "while", "do", "return", "require", "vim", "true", "false", "nil"],
    json: [],
    yaml: [],
    sh: ["if", "then", "else", "fi", "for", "do", "done", "while", "case", "esac", "function", "return", "export", "source", "alias", "in"],
    zsh: ["if", "then", "else", "fi", "for", "do", "done", "while", "case", "esac", "function", "return", "export", "source", "alias", "in"],
    fish: ["if", "else", "end", "for", "while", "function", "return", "set", "export", "source", "alias"],
    rasi: ["configuration", "theme", "import"],
  };
  const commentStart: Record<string, string> = {
    ini: "#", conf: "#", css: "/*", lua: "--", json: "//", yaml: "#",
    sh: "#", zsh: "#", fish: "#", rasi: "//",
  };

  const kws = keywords[ext] || [];
  const cStart = commentStart[ext] || "#";
  const lines = code.split("\n");

  return lines.map((line, lineIdx) => {
    let parts: React.ReactNode[] = [];
    let remaining = line;

    if (cStart === "/*") {
      const blockComment = remaining.match(/\/\*[\s\S]*?\*\//);
      if (blockComment) {
        const idx = remaining.indexOf(blockComment[0]);
        if (idx > 0) parts.push(<span key="pre">{remaining.substring(0, idx)}</span>);
        parts.push(<span key="cm" style={{ color: "#8b949e", fontStyle: "italic" }}>{blockComment[0]}</span>);
        remaining = remaining.substring(idx + blockComment[0].length);
      }
    } else {
      const commentIdx = remaining.indexOf(cStart);
      if (commentIdx >= 0) {
        const before = remaining.substring(0, commentIdx);
        const comment = remaining.substring(commentIdx);
        remaining = "";
        if (before) {
          parts.push(...highlightTokens(before, kws, ext));
        }
        parts.push(<span key="cm" style={{ color: "#8b949e", fontStyle: "italic" }}>{comment}</span>);
      }
    }

    if (remaining) {
      parts.push(...highlightTokens(remaining, kws, ext));
    }

    return (
      <div key={lineIdx} style={{ minHeight: `${editorFontSize * editorLineHeight}px`, lineHeight: `${editorLineHeight}` }}>
        {parts.length > 0 ? parts : "\u00A0"}
      </div>
    );
  });
}

function highlightTokens(text: string, kws: string[], ext: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest = -1;
    let earliestIdx = remaining.length;
    let earliestLen = 0;

    // Check strings
    const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
    if (strMatch && strMatch.index! < earliestIdx) {
      earliest = 0; earliestIdx = strMatch.index!; earliestLen = strMatch[0].length;
    }

    // Check numbers
    const numMatch = remaining.match(/^\b(\d+\.?\d*)\b/);
    if (numMatch && numMatch.index! < earliestIdx) {
      earliest = 1; earliestIdx = numMatch.index!; earliestLen = numMatch[0].length;
    }

    // Check keywords
    if (kws.length > 0) {
      const kwRegex = new RegExp(`^\\b(${kws.join("|")})\\b`);
      const kwMatch = remaining.match(kwRegex);
      if (kwMatch && kwMatch.index! < earliestIdx) {
        earliest = 2; earliestIdx = kwMatch.index!; earliestLen = kwMatch[0].length;
      }
    }

    if (earliest === -1) {
      parts.push(<span key={parts.length}>{remaining}</span>);
      break;
    }

    if (earliestIdx > 0) {
      parts.push(<span key={parts.length}>{remaining.substring(0, earliestIdx)}</span>);
    }

    const token = remaining.substring(earliestIdx, earliestIdx + earliestLen);
    if (earliest === 0) {
      parts.push(<span key={parts.length} style={{ color: "#a5d6ff" }}>{token}</span>);
    } else if (earliest === 1) {
      parts.push(<span key={parts.length} style={{ color: "#79c0ff" }}>{token}</span>);
    } else if (earliest === 2) {
      parts.push(<span key={parts.length} style={{ color: "#ff7b72", fontWeight: 500 }}>{token}</span>);
    }

    remaining = remaining.substring(earliestIdx + earliestLen);
  }

  return parts;
}

export function CodeEditor() {
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const closeTab = useAppStore((s) => s.closeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const saveCurrentFile = useAppStore((s) => s.saveCurrentFile);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const { showMenu, MenuPortal } = useContextMenu();
  const [errors, setErrors] = useState<ConfigError[]>([]);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveCurrentFile]);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.addEventListener("scroll", handleScroll, { passive: true });
      return () => ta.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, activeTabId]);

  // Reset scroll on tab change
  useEffect(() => {
    if (textareaRef.current) textareaRef.current.scrollTop = 0;
    if (highlightRef.current) highlightRef.current.scrollTop = 0;
    if (lineNumRef.current) lineNumRef.current.scrollTop = 0;
    setErrors([]);
    setProblemsOpen(false);
    setHoveredLine(null);
  }, [activeTabId]);

  // Debounced validation
  useEffect(() => {
    if (!activeTab) return;
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      const result = validateConfig(activeTab.name, activeTab.content, activeTab.path);
      setErrors(result);
    }, 300);
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, [activeTab?.content, activeTab?.name]);

  const errorLines = useMemo(() => {
    const map = new Map<number, ConfigError[]>();
    for (const err of errors) {
      const existing = map.get(err.line) || [];
      existing.push(err);
      map.set(err.line, existing);
    }
    return map;
  }, [errors]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ta = textareaRef.current;
    const hasSelection = ta && ta.selectionStart !== ta.selectionEnd;
    const items = [
      { label: t("editor.contextMenu.undo"), icon: <Undo2 className="h-4 w-4" />, shortcut: "Ctrl+Z", onClick: () => document.execCommand("undo") },
      { label: t("editor.contextMenu.redo"), icon: <Redo2 className="h-4 w-4" />, shortcut: "Ctrl+Y", onClick: () => document.execCommand("redo") },
      { divider: true, label: "" },
      { label: t("editor.contextMenu.cut"), icon: <Scissors className="h-4 w-4" />, shortcut: "Ctrl+X", disabled: !hasSelection, onClick: () => { ta?.focus(); document.execCommand("cut"); } },
      { label: t("editor.contextMenu.copy"), icon: <Copy className="h-4 w-4" />, shortcut: "Ctrl+C", disabled: !hasSelection, onClick: () => { ta?.focus(); document.execCommand("copy"); } },
      { label: t("editor.contextMenu.paste"), icon: <ClipboardPaste className="h-4 w-4" />, shortcut: "Ctrl+V", onClick: () => { ta?.focus(); document.execCommand("paste"); } },
      { divider: true, label: "" },
      { label: t("editor.contextMenu.selectAll"), icon: <CheckSquare className="h-4 w-4" />, shortcut: "Ctrl+A", onClick: () => { ta?.focus(); ta?.select(); } },
    ];
    showMenu(e, items);
  }, [showMenu]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
            <span className="text-2xl font-bold bg-gradient-to-br from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">R</span>
          </div>
          <h2 className="text-lg font-semibold mb-1">{t("editor.empty.title")}</h2>
          <p className="text-sm">{t("editor.empty.hint")}</p>
          <p className="text-xs mt-2 text-muted-foreground/60">{t("editor.empty.shortcut")}</p>
        </div>
      </div>
    );
  }

  const lines = activeTab.content.split("\n");
  const lineCount = lines.length;
  const highlighted = highlightSyntax(activeTab.content, activeTab.name);
  const lineNumWidth = Math.max(40, String(lineCount).length * 9 + 24);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center border-b bg-card/50 overflow-x-auto shrink-0">
        {openTabs.map((tab) => (
          <div key={tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 border-r cursor-pointer text-sm whitespace-nowrap group transition-colors ${tab.id === activeTabId ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.modified ? <Circle className="h-2 w-2 fill-orange-400 text-orange-400 shrink-0" /> : <span className="w-2 h-2" />}
            <span>{tab.name}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Editor: single scrollable container */}
      <div ref={containerRef} className="flex-1 min-h-0 relative font-mono" style={{ fontSize: editorFontSize }}>
        {/* Textarea: handles input, selection, and scrolling */}
        <textarea
          ref={textareaRef}
          value={activeTab.content}
          onChange={(e) => updateTabContent(activeTab.id, e.target.value)}
          onContextMenu={handleContextMenu}
          className="absolute inset-0 w-full h-full resize-none outline-none"
          style={{
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            padding: `${editorPadding}px ${editorPadding}px ${editorPadding}px ${lineNumWidth + editorPadding}px`,
            color: "transparent",
            caretColor: "hsl(var(--caret))",
            backgroundColor: "transparent",
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto",
            overflowY: "auto",
            tabSize: 4,
            zIndex: 3,
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />

        {/* Highlighted code (scrolls with textarea via JS) */}
        <div
          ref={highlightRef}
          className="absolute inset-0 pointer-events-none whitespace-pre overflow-hidden"
          style={{
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            padding: `${editorPadding}px ${editorPadding}px ${editorPadding}px ${lineNumWidth + editorPadding}px`,
            tabSize: 4,
            zIndex: 1,
          }}
          aria-hidden="true"
        >
          {highlighted}
        </div>

        {/* Line numbers (scrolls vertically with textarea via JS) */}
        <div
          ref={lineNumRef}
          className="absolute top-0 bottom-0 left-0 text-right select-none border-r bg-card/30 text-muted-foreground/50 overflow-hidden pointer-events-none"
          style={{
            width: lineNumWidth,
            fontFamily: editorFontFamily,
            fontSize: editorFontSize,
            lineHeight: editorLineHeight,
            paddingTop: editorPadding,
            paddingBottom: editorPadding,
            paddingRight: 8,
            zIndex: 2,
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => {
            const errs = errorLines.get(i + 1);
            const hasError = errs?.some(e => e.severity === "error");
            const hasWarning = errs?.some(e => e.severity === "warning");
            return (
              <div
                key={i}
                className="relative"
                style={{ minHeight: `${editorFontSize * editorLineHeight}px` }}
                onMouseEnter={() => setHoveredLine(i + 1)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                <span className={hasError ? "text-red-400" : hasWarning ? "text-yellow-400" : ""}>
                  {hasError ? <AlertCircle className="inline h-3 w-3 mr-0.5 -mt-0.5" /> : hasWarning ? <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5 text-yellow-400" /> : null}
                  {i + 1}
                </span>
                {hoveredLine === i + 1 && errs && errs.length > 0 && (
                  <div className="absolute left-full ml-2 top-0 z-50 bg-popover border rounded-md shadow-lg p-2 min-w-[200px] max-w-[350px] pointer-events-auto">
                    {errs.map((err, j) => (
                      <div key={j} className={`text-[11px] flex items-start gap-1.5 ${err.severity === "error" ? "text-red-400" : "text-yellow-400"}`}>
                        {err.severity === "error" ? <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t text-[11px] text-muted-foreground bg-card/30 shrink-0">
        <div className="flex items-center gap-4">
          <span>{activeTab.name}</span>
          <span>{lineCount} lineas</span>
          {errors.length > 0 && (
            <button
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent/50 transition-colors ${errors.some(e => e.severity === "error") ? "text-red-400" : "text-yellow-400"}`}
              onClick={() => setProblemsOpen(!problemsOpen)}
            >
              {errors.some(e => e.severity === "error") ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              <span>{errors.filter(e => e.severity === "error").length} errores, {errors.filter(e => e.severity === "warning").length} warnings</span>
              {problemsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>{activeTab.modified ? "Modificado" : "Guardado"}</span>
        </div>
      </div>

      {/* Problems panel */}
      {problemsOpen && errors.length > 0 && (
        <div className="border-t bg-card/50 max-h-[180px] overflow-auto shrink-0">
          <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground border-b flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />Problems ({errors.length})
          </div>
          <div className="divide-y">
            {errors.map((err, i) => (
              <div
                key={i}
                className="px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-accent/30 cursor-pointer"
                onClick={() => {
                  if (textareaRef.current) {
                    const ta = textareaRef.current;
                    const contentLines = ta.value.split("\n");
                    let pos = 0;
                    for (let l = 0; l < err.line - 1 && l < contentLines.length; l++) {
                      pos += contentLines[l].length + 1;
                    }
                    ta.focus();
                    ta.setSelectionRange(pos, pos + 10);
                    const lineHeight = editorFontSize * editorLineHeight;
                    ta.scrollTop = Math.max(0, (err.line - 5) * lineHeight);
                    handleScroll();
                  }
                }}
              >
                {err.severity === "error" ? <AlertCircle className="h-3 w-3 text-red-400 shrink-0" /> : <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />}
                <span className="text-muted-foreground w-12 shrink-0">Ln {err.line}</span>
                <span className={err.severity === "error" ? "text-red-400" : "text-yellow-400"}>{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {MenuPortal}
    </div>
  );
}
