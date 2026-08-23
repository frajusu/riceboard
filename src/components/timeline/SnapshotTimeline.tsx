import React from "react";
import { motion } from "framer-motion";
import { Clock, RotateCcw, GitCommit } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SnapshotTimeline() {
  const { snapshots } = useAppStore();

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Timeline
        </p>
        <span className="text-[10px] text-muted-foreground">
          {snapshots.length} snapshots
        </span>
      </div>

      {snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Clock className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Sin snapshots</p>
          <p className="text-xs mt-1">Se crean al guardar cambios</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            {[...snapshots].reverse().map((snapshot, idx) => (
              <motion.div
                key={snapshot.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative flex items-start gap-3 py-2 pl-2"
              >
                <div className="relative z-10 mt-1">
                  <div className="h-5 w-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    <GitCommit className="h-2.5 w-2.5 text-primary" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">
                      {snapshot.description || `Snapshot ${snapshot.id}`}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Restaurar</TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatTimestamp(snapshot.timestamp)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {snapshot.files.length} archivos
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
