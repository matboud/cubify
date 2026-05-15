"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { MaterialPreset } from "@/app/page";

// Radians rotated per animation frame while an orbit key is held.
// Zoom applies the same 3% per frame; holding the button accelerates naturally.
const ORBIT_SPEED  = 0.025;
const DOLLY_FACTOR = 0.97; // zoom-in multiplier (<1 shrinks the radius)
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 12;

// Polar angle limits — kept a hair away from 0 and π so the camera never
// flips when it passes directly over the top or bottom of the box.
const MIN_PHI = 0.08;
const MAX_PHI = Math.PI - 0.08;

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
type ZoomKey  = "ZoomIn" | "ZoomOut";


// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

const texLoader = new THREE.TextureLoader();

function loadWoodMaps() {
  const diff  = texLoader.load("/textures/wood/diff.jpg");
  const nor   = texLoader.load("/textures/wood/nor.jpg");
  const rough = texLoader.load("/textures/wood/rough.jpg");
  const ao    = texLoader.load("/textures/wood/ao.jpg");

  // Only the diffuse/albedo map is perceptually encoded (sRGB).
  // Normal, roughness, and AO maps are linear data — correcting their
  // color space would shift the values and break the shading.
  diff.colorSpace = THREE.SRGBColorSpace;

  return { diff, nor, rough, ao };
}


// ---------------------------------------------------------------------------
// Material factory
// ---------------------------------------------------------------------------

function buildMaterial(
  preset: MaterialPreset | null,
  color: string
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {

  if (preset === "wood") {
    const { diff, nor, rough, ao } = loadWoodMaps();
    return new THREE.MeshStandardMaterial({
      map:            diff,
      normalMap:      nor,
      roughnessMap:   rough,
      aoMap:          ao,
      aoMapIntensity: 1,
      // roughness: 1 means the roughnessMap drives the value completely.
      // A lower scalar would multiply the map and make the surface look
      // artificially smoother than the real wood.
      roughness: 1,
      metalness: 0,
    });
  }

  if (preset === "metal") {
    return new THREE.MeshStandardMaterial({
      color:    "#B8C4CC",
      roughness: 0.15,
      metalness: 1,
      // Boosting envMapIntensity makes the room environment reflections more
      // visible on the surface — critical for metal to read as metallic.
      envMapIntensity: 1.8,
    });
  }

  if (preset === "glass") {
    // MeshPhysicalMaterial's `transmission` is physically-based light-through-
    // material. Unlike plain opacity, it bends light via the IOR value and
    // produces the characteristic glass distortion behind the object.
    return new THREE.MeshPhysicalMaterial({
      color:        "#AACCFF",
      roughness:    0.04,
      metalness:    0,
      transmission: 0.92,
      ior:          1.52,
      thickness:    0.5,
      transparent:  true,
      // DoubleSide so inner faces are visible when looking through the box.
      // depthWrite: false prevents z-fighting at grazing angles.
      side:       THREE.DoubleSide,
      depthWrite: false,
    });
  }

  if (preset === "plastic") {
    // clearcoat simulates the thin lacquer layer on injection-molded plastic.
    // It sits on top of the base roughness and gives that wet, shiny look
    // without making the whole surface feel like metal.
    return new THREE.MeshPhysicalMaterial({
      color:              "#FF3A30",
      roughness:          0.22,
      metalness:          0,
      clearcoat:          1,
      clearcoatRoughness: 0.08,
    });
  }

  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.15,
  });
}

// Releases the material and all of its texture maps from GPU memory.
// Especially important for wood, which carries four 2K textures.
function disposeMaterial(mat: THREE.Material | THREE.Material[]) {
  const list = Array.isArray(mat) ? mat : [mat];
  for (const m of list) {
    const s = m as THREE.MeshStandardMaterial;
    s.map?.dispose();
    s.normalMap?.dispose();
    s.roughnessMap?.dispose();
    s.aoMap?.dispose();
    m.dispose();
  }
}


// ---------------------------------------------------------------------------
// On-screen D-pad (mirrors keyboard arrow keys for touch / tablet users)
// ---------------------------------------------------------------------------

function ChevronIcon({ dir }: Readonly<{ dir: ArrowKey }>) {
  const rotate = {
    ArrowUp:    "-rotate-90",
    ArrowDown:  "rotate-90",
    ArrowLeft:  "rotate-180",
    ArrowRight: "rotate-0",
  }[dir];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-5 h-5 ${rotate}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DPadButton({
  direction,
  keysRef,
}: Readonly<{
  direction: ArrowKey;
  keysRef:   React.RefObject<Set<string>>;
}>) {
  // We write to the same Set the animation loop reads from, so pointer events
  // and keyboard events both drive the camera without extra state or re-renders.
  const press   = () => keysRef.current.add(direction);
  const release = () => keysRef.current.delete(direction);

  return (
    <button
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      className="
        flex items-center justify-center w-12 h-12 rounded-xl
        bg-white/5 border border-white/10
        text-white/60 hover:text-white
        hover:bg-white/10 hover:border-white/20
        active:scale-90 active:bg-indigo-500/30 active:border-indigo-400/50 active:text-indigo-300
        transition-all duration-100 select-none cursor-pointer
        shadow-lg shadow-black/40 backdrop-blur-sm
      "
      aria-label={direction}
    >
      <ChevronIcon dir={direction} />
    </button>
  );
}

function DPad({ keysRef }: Readonly<{ keysRef: React.RefObject<Set<string>> }>) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <DPadButton direction="ArrowUp"    keysRef={keysRef} />
      <div className="flex gap-1.5">
        <DPadButton direction="ArrowLeft"  keysRef={keysRef} />
        <DPadButton direction="ArrowDown"  keysRef={keysRef} />
        <DPadButton direction="ArrowRight" keysRef={keysRef} />
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Zoom controls — a classic map-style +/− widget, placed bottom-right.
// Scroll wheel also zooms via OrbitControls; these buttons serve touch users.
// ---------------------------------------------------------------------------

function ZoomInIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L22 22" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L22 22" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ZoomButton({
  action,
  keysRef,
}: Readonly<{
  action:  ZoomKey;
  keysRef: React.RefObject<Set<string>>;
}>) {
  const press   = () => keysRef.current.add(action);
  const release = () => keysRef.current.delete(action);

  return (
    <button
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={action === "ZoomIn" ? "Zoom in" : "Zoom out"}
      className="
        flex items-center justify-center w-11 h-11
        bg-white/5 text-white/60
        hover:bg-white/10 hover:text-white
        active:bg-indigo-500/30 active:text-indigo-300
        transition-all duration-100 select-none cursor-pointer
      "
    >
      {action === "ZoomIn" ? <ZoomInIcon /> : <ZoomOutIcon />}
    </button>
  );
}

function ZoomControls({ keysRef }: Readonly<{ keysRef: React.RefObject<Set<string>> }>) {
  return (
    <div className="
      flex flex-col overflow-hidden
      rounded-xl border border-white/10
      shadow-lg shadow-black/40 backdrop-blur-sm
    ">
      <ZoomButton action="ZoomIn"  keysRef={keysRef} />
      <div className="border-t border-white/10" />
      <ZoomButton action="ZoomOut" keysRef={keysRef} />
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  color:  string;
  preset: MaterialPreset | null;
}

export default function Playground({ color, preset }: Readonly<Props>) {
  const [rendered, setRendered] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef  = useRef<Set<string>>(new Set());
  const meshRef  = useRef<THREE.Mesh | null>(null);

  // Scene setup — runs once when the user clicks "Render a box".
  //
  // We intentionally omit `preset` and `color` from the dependency array.
  // The material they describe at mount time is baked in here, and every
  // subsequent change is handled by the swap effect below. Adding them would
  // tear down and rebuild the entire Three.js scene on every color pick.
  useEffect(() => {
    if (!rendered || !mountRef.current) return;

    const container = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f0f0f");

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(2.5, 1.8, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // ACES filmic tone mapping gives a more cinematic, natural exposure curve
    // compared to the default linear mapping, especially visible on metals.
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // A PMREMGenerator bakes the environment into a format Three.js can sample
    // from. Without an env map, metalness has nothing to reflect and glass has
    // nothing to refract — both would look flat and unconvincing.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Three-point lighting: ambient fills shadows, key light is the sun,
    // fill light is a cool bounce from the opposite side.
    const ambient   = new THREE.AmbientLight(0xffffff, 0.5);
    const keyLight  = new THREE.DirectionalLight(0xffffff, 1.2);
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    keyLight.position.set(5, 6, 5);
    fillLight.position.set(-4, 2, -3);
    scene.add(ambient, keyLight, fillLight);

    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    // aoMap is sampled from UV channel 1, but BoxGeometry only ships with
    // channel 0. Copying it over keeps AO working without extra UV work.
    geometry.setAttribute("uv2", geometry.getAttribute("uv"));

    const material = buildMaterial(preset, color);
    const box      = new THREE.Mesh(geometry, material);
    scene.add(box);
    meshRef.current = box;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.06;
    controls.minDistance    = MIN_DISTANCE;
    controls.maxDistance    = MAX_DISTANCE;
    // Mirror our keyboard phi clamps so mouse drag is clamped the same way.
    controls.minPolarAngle  = MIN_PHI;
    controls.maxPolarAngle  = MAX_PHI;

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); // stop the page from scrolling while navigating
        keysRef.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    globalThis.addEventListener("resize",  onResize);
    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("keyup",   onKeyUp);

    // Pre-allocate so the animation loop creates zero garbage per frame.
    const sph = new THREE.Spherical();
    const tmp = new THREE.Vector3();

    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const keys = keysRef.current;
      if (keys.size > 0) {
        // Express camera position in spherical coordinates relative to the
        // orbit target. Adjusting theta orbits left/right, phi orbits up/down,
        // and radius zooms in/out — all without losing the look-at target.
        sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));

        if (keys.has("ArrowLeft"))  sph.theta -= ORBIT_SPEED;
        if (keys.has("ArrowRight")) sph.theta += ORBIT_SPEED;
        // phi = 0 is directly above, π is directly below — clamp at both poles.
        if (keys.has("ArrowUp"))    sph.phi = Math.max(MIN_PHI, sph.phi - ORBIT_SPEED);
        if (keys.has("ArrowDown"))  sph.phi = Math.min(MAX_PHI, sph.phi + ORBIT_SPEED);
        if (keys.has("ZoomIn"))     sph.radius = Math.max(MIN_DISTANCE, sph.radius * DOLLY_FACTOR);
        if (keys.has("ZoomOut"))    sph.radius = Math.min(MAX_DISTANCE, sph.radius / DOLLY_FACTOR);

        camera.position.copy(controls.target).add(tmp.setFromSpherical(sph));
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      globalThis.removeEventListener("resize",  onResize);
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("keyup",   onKeyUp);
      controls.dispose();
      disposeMaterial(box.material);
      geometry.dispose();
      renderer.dispose();
      meshRef.current = null;
      renderer.domElement.remove();
    };
  }, [rendered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live material swap — fires when the user picks a different color or preset.
  // Keeping this in a separate effect means we never rebuild the scene;
  // we just swap the material on the existing mesh and free the old GPU memory.
  useEffect(() => {
    if (meshRef.current) {
      disposeMaterial(meshRef.current.material);
      meshRef.current.material = buildMaterial(preset, color);
    }
  }, [preset, color]);

  return (
    <div className="relative w-full h-full bg-[#0f0f0f]">
      {!rendered ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => setRendered(true)}
            className="px-8 py-4 rounded-xl bg-indigo-500 text-white font-semibold text-base tracking-wide hover:bg-indigo-400 active:scale-95 transition-all duration-150 shadow-lg shadow-indigo-500/30"
          >
            Render a box
          </button>
        </div>
      ) : (
        <>
          <div ref={mountRef} className="w-full h-full" />

          {/* D-pad — bottom-center */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <DPad keysRef={keysRef} />
          </div>

          {/* Zoom — bottom-right, same row as the D-pad */}
          <div className="absolute bottom-6 right-6 flex items-end">
            <ZoomControls keysRef={keysRef} />
          </div>
        </>
      )}
    </div>
  );
}
