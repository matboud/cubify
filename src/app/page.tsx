"use client";

import { useState } from "react";
import Playground from "@/components/Playground";
import Settings    from "@/components/Settings";

// Exported so both Playground and Settings can reference the same type
// without creating a separate types file just for a four-value union.
export type MaterialPreset = "wood" | "metal" | "glass" | "plastic";

export default function Home() {
  const [color,  setColor]  = useState("#6366f1");
  const [preset, setPreset] = useState<MaterialPreset | null>(null);

  // Picking a color clears the active preset — they're mutually exclusive.
  // A preset owns its own color(s), so letting both be active simultaneously
  // would create a confusing priority conflict in the material factory.
  const handleColorChange = (hex: string) => {
    setColor(hex);
    setPreset(null);
  };

  return (
    <div className="flex h-full">
      {/* Left — 3D viewport takes the remaining width */}
      <div className="flex-1 min-w-0">
        <Playground color={color} preset={preset} />
      </div>

      {/* Right — fixed-width settings panel */}
      <div className="w-72 shrink-0 border-l border-white/10">
        <Settings
          color={color}
          onColorChange={handleColorChange}
          preset={preset}
          onPresetChange={setPreset}
        />
      </div>
    </div>
  );
}
