"use client";

import { useEffect, useState } from "react";
import Playground from "@/components/Playground";
import Settings    from "@/components/Settings";

// Exported so both Playground and Settings can reference the same type
// without creating a separate types file just for a four-value union.
export type MaterialPreset = "wood" | "metal" | "glass" | "plastic";

export default function Home() {
  const [color,        setColor]        = useState("#6366f1");
  const [preset,       setPreset]       = useState<MaterialPreset | null>(null);
  const [isStretching, setIsStretching] = useState(false);
  const [isDark,       setIsDark]       = useState(true);

  // Keep the <html> class in sync with the toggle so every dark: utility
  // in the tree responds — the initial "dark" class is set in layout.tsx
  // to avoid a flash of the light theme on first paint.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Picking a color clears the active preset — they're mutually exclusive.
  // A preset owns its own color(s), so letting both be active simultaneously
  // would create a confusing priority conflict in the material factory.
  const handleColorChange = (hex: string) => {
    setColor(hex);
    setPreset(null);
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Viewport — takes all remaining space; min-h-0 lets flex shrink it */}
      <div className="flex-1 min-h-0 min-w-0">
        <Playground
          color={color}
          preset={preset}
          isStretching={isStretching}
          isDark={isDark}
        />
      </div>

      {/* Settings — bottom strip on mobile, full-height sidebar on md+ */}
      <div className="h-56 md:h-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-black/10 dark:border-white/10">
        <Settings
          color={color}
          onColorChange={handleColorChange}
          preset={preset}
          onPresetChange={setPreset}
          isStretching={isStretching}
          onStretchChange={setIsStretching}
          isDark={isDark}
          onToggleDark={() => setIsDark(d => !d)}
        />
      </div>
    </div>
  );
}
