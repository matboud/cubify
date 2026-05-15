"use client";

import type { MaterialPreset } from "@/app/page";

const COLORS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#ec4899", label: "Pink"   },
  { hex: "#ef4444", label: "Red"    },
  { hex: "#f97316", label: "Orange" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#22c55e", label: "Green"  },
  { hex: "#14b8a6", label: "Teal"   },
  { hex: "#0ea5e9", label: "Sky"    },
  { hex: "#e2e8f0", label: "White"  },
  { hex: "#64748b", label: "Slate"  },
  { hex: "#27272a", label: "Dark"   },
];

// CSS gradient previews that hint at each material's texture without
// needing to spin up a Three.js scene inside the settings panel.
const MATERIALS: {
  id:      MaterialPreset;
  label:   string;
  preview: React.CSSProperties;
}[] = [
  {
    id:    "wood",
    label: "Wood",
    preview: {
      background:
        "repeating-linear-gradient(91deg, #3D1F0A 0px, #6B3A1F 3px, #8B5A2E 7px, #7A4520 11px, #5C3017 15px, #A07040 19px, #6B3A1F 23px)",
    },
  },
  {
    id:    "metal",
    label: "Metal",
    preview: {
      background:
        "repeating-linear-gradient(180deg, #8090A0 0px, #B8C8D8 2px, #687888 5px, #C8D8E8 7px, #8090A0 10px)",
    },
  },
  {
    id:    "glass",
    label: "Glass",
    preview: {
      background:
        "linear-gradient(145deg, rgba(200,230,255,0.12) 0%, rgba(255,255,255,0.55) 28%, rgba(170,210,255,0.08) 52%, rgba(255,255,255,0.32) 78%)",
      border:       "1px solid rgba(200,230,255,0.35)",
      backdropFilter: "blur(8px)",
    },
  },
  {
    id:    "plastic",
    label: "Plastic",
    preview: {
      background:
        "radial-gradient(ellipse at 32% 28%, rgba(255,255,255,0.65), transparent 52%), linear-gradient(145deg, #FF5858, #C41414)",
    },
  },
];

interface Props {
  color:          string;
  onColorChange:  (hex: string) => void;
  preset:         MaterialPreset | null;
  onPresetChange: (id: MaterialPreset | null) => void;
}

export default function Settings({
  color,
  onColorChange,
  preset,
  onPresetChange,
}: Readonly<Props>) {
  // Clicking the active preset a second time deselects it and returns
  // control back to whichever color was selected before.
  const togglePreset = (id: MaterialPreset) =>
    onPresetChange(preset === id ? null : id);

  return (
    <div className="h-full flex flex-col bg-[#141414] overflow-y-auto">
      <div className="px-5 py-6 flex flex-col gap-6">

        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
          Settings
        </h2>

        {/* Color ---------------------------------------------------------- */}
        <section>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30 mb-3">
            Color
          </p>

          {/* Dim the palette when a material preset is active — it makes it
              obvious that the preset is controlling appearance, not the color. */}
          <div
            className={`grid grid-cols-4 gap-2 transition-opacity duration-300 ${
              preset ? "opacity-30 pointer-events-none" : "opacity-100"
            }`}
          >
            {COLORS.map(({ hex, label }) => {
              const selected = !preset && color === hex;
              return (
                <button
                  key={hex}
                  onClick={() => onColorChange(hex)}
                  title={label}
                  className="relative aspect-square rounded-lg transition-all duration-100 hover:scale-110 active:scale-95"
                  style={{ backgroundColor: hex }}
                >
                  {selected && (
                    <span className="absolute inset-0 rounded-lg ring-2 ring-white/80 ring-offset-2 ring-offset-[#141414]" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <div className="border-t border-white/[0.07]" />

        {/* Material ------------------------------------------------------- */}
        <section>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30 mb-3">
            Material
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {MATERIALS.map(({ id, label, preview }) => {
              const selected = preset === id;
              return (
                <button
                  key={id}
                  onClick={() => togglePreset(id)}
                  className={`
                    group relative flex flex-col overflow-hidden rounded-xl
                    border transition-all duration-200 active:scale-95
                    ${
                      selected
                        ? "border-white/35 shadow-[0_0_16px_rgba(255,255,255,0.06)]"
                        : "border-white/10 hover:border-white/22"
                    }
                  `}
                >
                  <div className="h-14 w-full" style={preview} />

                  <div
                    className={`
                      flex items-center justify-between px-3 py-2
                      transition-colors duration-200
                      ${
                        selected
                          ? "bg-white/10 text-white"
                          : "bg-white/3 text-white/45 group-hover:text-white/65 group-hover:bg-white/6"
                      }
                    `}
                  >
                    <span className="text-xs font-medium">{label}</span>
                    {selected && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-white/70" />
                    )}
                  </div>

                  {selected && (
                    <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/25" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
