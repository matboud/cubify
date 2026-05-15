"use client";

import Image            from "next/image";
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

// CSS gradient previews that hint at each material's texture. Wood uses the
// real diffuse map (via next/image so it's served as optimised WebP at the
// right display size instead of the raw 2.7 MB JPEG).
const MATERIALS: {
  id:       MaterialPreset;
  label:    string;
  preview?: React.CSSProperties;
  imageSrc?: string;
}[] = [
  {
    id:       "wood",
    label:    "Wood",
    imageSrc: "/textures/wood/diff.jpg",
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

function StretchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
    >
      <path d="M3 3h5M3 3v5M21 3h-5M21 3v5M3 21h5M3 21v-5M21 21h-5M21 21v-5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

interface Props {
  color:           string;
  onColorChange:   (hex: string) => void;
  preset:          MaterialPreset | null;
  onPresetChange:  (id: MaterialPreset | null) => void;
  isStretching:    boolean;
  onStretchChange: (value: boolean) => void;
  isDark:          boolean;
  onToggleDark:    () => void;
  isReady:         boolean;
}

export default function Settings({
  color,
  onColorChange,
  preset,
  onPresetChange,
  isStretching,
  onStretchChange,
  isDark,
  onToggleDark,
  isReady,
}: Readonly<Props>) {
  // Clicking the active preset a second time deselects it and returns
  // control back to whichever color was selected before.
  const togglePreset = (id: MaterialPreset) =>
    onPresetChange(preset === id ? null : id);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#141414] overflow-y-auto">
      <div className="px-5 py-6 flex flex-col gap-6">

        {/* Header row -------------------------------------------------------- */}
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 dark:text-white/25">
            Settings
          </h2>

          {/* Light / dark toggle */}
          <button
            onClick={onToggleDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-black/40 dark:text-white/35 hover:text-black/70 dark:hover:text-white/60 hover:bg-black/5 dark:hover:bg-white/8 transition-all duration-150"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        {/* Color / Material / Transform — locked until the box is rendered */}
        <div className={`flex flex-col gap-6 transition-opacity duration-300 ${isReady ? "" : "opacity-30 pointer-events-none select-none"}`}>

        {/* Color ---------------------------------------------------------- */}
        <section>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/30 mb-3">
            Color
          </p>

          <div className="grid grid-cols-4 gap-2">
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
                    <span className="absolute inset-0 rounded-lg ring-2 ring-black/60 dark:ring-white/80 ring-offset-2 ring-offset-white dark:ring-offset-[#141414]" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <div className="border-t border-black/[0.07] dark:border-white/[0.07]" />

        {/* Material ------------------------------------------------------- */}
        <section>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/30 mb-3">
            Material
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {MATERIALS.map(({ id, label, preview, imageSrc }) => {
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
                        ? "border-black/20 dark:border-white/35 shadow-[0_0_16px_rgba(0,0,0,0.08)] dark:shadow-[0_0_16px_rgba(255,255,255,0.06)]"
                        : "border-black/10 dark:border-white/10 hover:border-black/18 dark:hover:border-white/22"
                    }
                  `}
                >
                  <div className="relative h-14 w-full overflow-hidden">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={label}
                        fill
                        sizes="144px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0" style={preview} />
                    )}
                  </div>

                  <div
                    className={`
                      flex items-center justify-between px-3 py-2
                      transition-colors duration-200
                      ${
                        selected
                          ? "bg-black/8 dark:bg-white/10 text-black dark:text-white"
                          : "bg-black/3 dark:bg-white/3 text-black/45 dark:text-white/45 group-hover:text-black/65 dark:group-hover:text-white/65 group-hover:bg-black/5 dark:group-hover:bg-white/6"
                      }
                    `}
                  >
                    <span className="text-xs font-medium">{label}</span>
                    {selected && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-black/50 dark:bg-white/70" />
                    )}
                  </div>

                  {selected && (
                    <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/15 dark:ring-white/25" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <div className="border-t border-black/[0.07] dark:border-white/[0.07]" />

        {/* Transform ------------------------------------------------------- */}
        <section>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/30 mb-3">
            Transform
          </p>
          <button
            onClick={() => onStretchChange(!isStretching)}
            className={`
              w-full flex items-center gap-3 px-3 py-3 rounded-xl
              border transition-all duration-200 active:scale-95
              ${isStretching
                ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                : "border-black/10 dark:border-white/10 bg-black/3 dark:bg-white/3 text-black/45 dark:text-white/45 hover:text-black/70 dark:hover:text-white/70 hover:bg-black/5 dark:hover:bg-white/6 hover:border-black/18 dark:hover:border-white/20"
              }
            `}
          >
            <StretchIcon />
            <span className="text-xs font-medium">Stretch Mode</span>
            {isStretching && (
              <span className="ml-auto text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
                Active
              </span>
            )}
          </button>
        </section>

        </div>{/* end isReady gate */}

      </div>
    </div>
  );
}
