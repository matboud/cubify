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
const MAX_DISTANCE = 30;

// Polar angle limits — kept a hair away from 0 and π so the camera never
// flips when it passes directly over the top or bottom of the box.
const MIN_PHI = 0.08;
const MAX_PHI = Math.PI - 0.08;

// The 8 corners of a unit cube, expressed as sign vectors (±1, ±1, ±1).
// Multiplying these by the box's half-dimensions gives world-space positions.
const CORNER_SIGNS = [
  new THREE.Vector3(-1, -1, -1),
  new THREE.Vector3(+1, -1, -1),
  new THREE.Vector3(-1, +1, -1),
  new THREE.Vector3(+1, +1, -1),
  new THREE.Vector3(-1, -1, +1),
  new THREE.Vector3(+1, -1, +1),
  new THREE.Vector3(-1, +1, +1),
  new THREE.Vector3(+1, +1, +1),
];

// Handle appearance states. Using THREE.Color objects avoids re-allocating
// strings on every hover event.
const COLOR_NORMAL = new THREE.Color("#a1a1aa");
const COLOR_HOVER  = new THREE.Color("#818cf8");
const COLOR_ACTIVE = new THREE.Color("#c7d2fe");

// Shared handle geometry — all 8 corners reuse the same buffer.
const HANDLE_GEO = new THREE.SphereGeometry(0.065, 16, 10);

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
type ZoomKey  = "ZoomIn" | "ZoomOut";


// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

function loadWoodMaps(onAllLoaded: () => void) {
  // Each call gets its own LoadingManager so the callback fires exactly when
  // all four maps for this particular material build are done.
  const manager = new THREE.LoadingManager(onAllLoaded);
  const loader  = new THREE.TextureLoader(manager);
  const diff    = loader.load("/textures/wood/diff.jpg");
  const nor     = loader.load("/textures/wood/nor.jpg");
  const rough   = loader.load("/textures/wood/rough.jpg");
  const ao      = loader.load("/textures/wood/ao.jpg");
  // Only the diffuse/albedo map is perceptually encoded (sRGB).
  // Normal, roughness, and AO maps carry linear data.
  diff.colorSpace = THREE.SRGBColorSpace;
  return { diff, nor, rough, ao };
}


// ---------------------------------------------------------------------------
// Material factory
// ---------------------------------------------------------------------------

function buildMaterial(
  preset: MaterialPreset | null,
  color: string,
  onLoad: () => void = () => {}
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {

  if (preset === "wood") {
    const { diff, nor, rough, ao } = loadWoodMaps(onLoad);
    return new THREE.MeshStandardMaterial({
      map:            diff,
      normalMap:      nor,
      roughnessMap:   rough,
      aoMap:          ao,
      aoMapIntensity: 1,
      roughness: 1,
      metalness: 0,
    });
  }

  // All other presets are fully synchronous — signal completion immediately.
  onLoad();

  if (preset === "metal") {
    return new THREE.MeshStandardMaterial({
      color:    "#B8C4CC",
      roughness: 0.15,
      metalness: 1,
      envMapIntensity: 1.8,
    });
  }

  if (preset === "glass") {
    return new THREE.MeshPhysicalMaterial({
      color:        "#AACCFF",
      roughness:    0.04,
      metalness:    0,
      transmission: 0.92,
      ior:          1.52,
      thickness:    0.5,
      transparent:  true,
      side:       THREE.DoubleSide,
      depthWrite: false,
    });
  }

  if (preset === "plastic") {
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
// On-screen D-pad
// ---------------------------------------------------------------------------

function ChevronIcon({ dir }: Readonly<{ dir: ArrowKey }>) {
  const rotate = {
    ArrowUp:    "-rotate-90",
    ArrowDown:  "rotate-90",
    ArrowLeft:  "rotate-180",
    ArrowRight: "rotate-0",
  }[dir];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${rotate}`}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DPadButton({
  direction, keysRef,
}: Readonly<{ direction: ArrowKey; keysRef: React.RefObject<Set<string>> }>) {
  const press   = () => keysRef.current.add(direction);
  const release = () => keysRef.current.delete(direction);
  return (
    <button
      onPointerDown={press} onPointerUp={release} onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center justify-center w-12 h-12 rounded-xl
        bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10
        text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white
        hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20
        active:scale-90 active:bg-indigo-500/30 active:border-indigo-400/50 active:text-indigo-300
        transition-all duration-100 select-none cursor-pointer
        shadow-lg shadow-black/20 dark:shadow-black/40 backdrop-blur-sm"
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
// Zoom controls
// ---------------------------------------------------------------------------

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L22 22" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L22 22" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ZoomButton({
  action, keysRef,
}: Readonly<{ action: ZoomKey; keysRef: React.RefObject<Set<string>> }>) {
  const press   = () => keysRef.current.add(action);
  const release = () => keysRef.current.delete(action);
  return (
    <button
      onPointerDown={press} onPointerUp={release} onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={action === "ZoomIn" ? "Zoom in" : "Zoom out"}
      className="flex items-center justify-center w-11 h-11
        bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60
        hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white
        active:bg-indigo-500/30 active:text-indigo-300
        transition-all duration-100 select-none cursor-pointer"
    >
      {action === "ZoomIn" ? <ZoomInIcon /> : <ZoomOutIcon />}
    </button>
  );
}

function ZoomControls({ keysRef }: Readonly<{ keysRef: React.RefObject<Set<string>> }>) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/10
      shadow-lg shadow-black/20 dark:shadow-black/40 backdrop-blur-sm">
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
  color:        string;
  preset:       MaterialPreset | null;
  isStretching: boolean;
  isDark:       boolean;
  rendered:     boolean;
  onRender:     () => void;
}

export default function Playground({ color, preset, isStretching, isDark, rendered, onRender }: Readonly<Props>) {
  const [isLoadingTextures, setIsLoadingTextures] = useState(false);
  const mountRef  = useRef<HTMLDivElement>(null);
  const keysRef   = useRef<Set<string>>(new Set());
  const meshRef   = useRef<THREE.Mesh | null>(null);

  // Dimensions are stored in a ref so the pointer-event handlers (registered
  // once at scene setup) always read the latest values without stale closures.
  const dimensionsRef = useRef({ w: 1.6, h: 1.6, d: 1.6 });

  // Functions written by the scene-setup effect so reactive effects
  // can reach into the Three.js scene without needing direct access.
  const showHandlesFn  = useRef<(() => void) | null>(null);
  const hideHandlesFn  = useRef<(() => void) | null>(null);
  const setSceneBgFn   = useRef<((dark: boolean) => void) | null>(null);
  const isStretchingRef = useRef(isStretching);
  const isDarkRef       = useRef(isDark);

  // Keep the ref in sync whenever the prop changes.
  // The pointer handlers read the ref so they always see the current mode.
  useEffect(() => {
    isStretchingRef.current = isStretching;
    if (isStretching) showHandlesFn.current?.();
    else              hideHandlesFn.current?.();
  }, [isStretching]);

  // Sync the Three.js scene background whenever the theme toggles.
  useEffect(() => {
    isDarkRef.current = isDark;
    setSceneBgFn.current?.(isDark);
  }, [isDark]);

  // Scene setup — runs once when the user clicks "Render a box".
  useEffect(() => {
    if (!rendered || !mountRef.current) return;

    const container = mountRef.current;

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(isDarkRef.current ? "#0f0f0f" : "#f2f2f2");
    scene.background = bgColor;
    setSceneBgFn.current = (dark) => { bgColor.set(dark ? "#0f0f0f" : "#f2f2f2"); };

    const camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 1000
    );
    camera.position.set(2.5, 1.8, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const ambient   = new THREE.AmbientLight(0xffffff, 0.5);
    const keyLight  = new THREE.DirectionalLight(0xffffff, 1.2);
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    keyLight.position.set(5, 6, 5);
    fillLight.position.set(-4, 2, -3);
    scene.add(ambient, keyLight, fillLight);

    // Unit cube scaled to the current dimensions. Using mesh.scale instead of
    // rebuilding BoxGeometry on every stretch keeps the frame rate smooth.
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.setAttribute("uv2", geometry.getAttribute("uv"));
    setIsLoadingTextures(preset === "wood");
    const material = buildMaterial(preset, color, () => setIsLoadingTextures(false));
    const box = new THREE.Mesh(geometry, material);
    const { w, h, d } = dimensionsRef.current;
    box.scale.set(w, h, d);
    scene.add(box);
    meshRef.current = box;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance   = MIN_DISTANCE;
    controls.maxDistance   = MAX_DISTANCE;
    controls.minPolarAngle = MIN_PHI;
    controls.maxPolarAngle = MAX_PHI;

    // ----- Corner handles --------------------------------------------------

    // Each handle is a small sphere sitting at a box corner. depthTest: false
    // keeps them visible even when the camera is on the far side of the box,
    // which is important so the user can always see and grab all 8 handles.
    const handles = CORNER_SIGNS.map(() => {
      const mat = new THREE.MeshBasicMaterial({
        color:     COLOR_NORMAL.clone(),
        depthTest:  false,
        depthWrite: false,
      });
      const sphere = new THREE.Mesh(HANDLE_GEO, mat);
      sphere.renderOrder = 1; // draw after the box so handles are always on top
      sphere.visible = false;
      return sphere;
    });
    scene.add(...handles);

    const positionHandles = () => {
      const { w: cw, h: ch, d: cd } = dimensionsRef.current;
      handles.forEach((h, i) => {
        const s = CORNER_SIGNS[i];
        h.position.set(s.x * cw * 0.5, s.y * ch * 0.5, s.z * cd * 0.5);
      });
    };
    positionHandles();

    showHandlesFn.current = () => handles.forEach(h => { h.visible = true;  });
    hideHandlesFn.current = () => handles.forEach(h => { h.visible = false; });

    // If stretch mode was already on before the scene mounted, show immediately.
    if (isStretchingRef.current) showHandlesFn.current();

    // ----- Stretch drag state ----------------------------------------------

    const raycaster  = new THREE.Raycaster();
    const mouse      = new THREE.Vector2();
    const dragPlane  = new THREE.Plane();
    const hitPoint   = new THREE.Vector3();

    type Handle = THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    let activeHandle:  Handle | null = null;
    let activeIndex    = -1;
    let hoveredHandle: Handle | null = null;

    const toNDC = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      mouse.set(
        ((e.clientX - r.left) / container.clientWidth)  *  2 - 1,
        ((e.clientY - r.top)  / container.clientHeight) * -2 + 1,
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isStretchingRef.current) return;
      toNDC(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(handles.filter(h => h.visible));
      if (hits.length === 0) return;

      activeHandle = hits[0].object as Handle;
      activeIndex  = handles.indexOf(activeHandle);

      // Build a drag plane that faces the camera and passes through the handle.
      // Any mouse movement will project onto this plane, giving us a 3D position
      // we can map back to new box dimensions.
      const normal = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
      dragPlane.setFromNormalAndCoplanarPoint(normal, activeHandle.position);

      activeHandle.material.color.copy(COLOR_ACTIVE);
      controls.enabled = false; // prevent camera rotation during the drag
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isStretchingRef.current) return;
      toNDC(e);
      raycaster.setFromCamera(mouse, camera);

      if (activeHandle) {
        // Project the ray onto the drag plane to get the new corner position.
        if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;

        const signs = CORNER_SIGNS[activeIndex];

        // Symmetric reshape: the dragged corner and its mirror both move, so
        // the box always stays centred at the origin.
        dimensionsRef.current = {
          w: Math.max(0.3, hitPoint.x * signs.x * 2),
          h: Math.max(0.3, hitPoint.y * signs.y * 2),
          d: Math.max(0.3, hitPoint.z * signs.z * 2),
        };
        const { w: nw, h: nh, d: nd } = dimensionsRef.current;
        box.scale.set(nw, nh, nd);
        positionHandles();

      } else {
        // Hover detection — highlight whichever handle the cursor is over.
        const visibleHandles = handles.filter(h => h.visible);
        const hits = raycaster.intersectObjects(visibleHandles);
        const next = hits.length > 0 ? hits[0].object as Handle : null;

        if (next !== hoveredHandle) {
          if (hoveredHandle) {
            hoveredHandle.material.color.copy(COLOR_NORMAL);
          }
          if (next) {
            next.material.color.copy(COLOR_HOVER);
          }
          hoveredHandle = next;
          renderer.domElement.style.cursor = next ? "grab" : "default";
        }
      }
    };

    const onPointerUp = () => {
      if (activeHandle) {
        // Restore handle colour — stay hovered if the cursor is still on it.
        const col = hoveredHandle === activeHandle ? COLOR_HOVER : COLOR_NORMAL;
        activeHandle.material.color.copy(col);
        activeHandle = null;
        activeIndex  = -1;
        controls.enabled = true;
        renderer.domElement.style.cursor = hoveredHandle ? "grab" : "default";
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup",   onPointerUp);

    // ----- Keyboard / animation loop ---------------------------------------

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    globalThis.addEventListener("resize",  onResize);
    globalThis.addEventListener("keydown", onKeyDown);
    globalThis.addEventListener("keyup",   onKeyUp);

    // Pre-allocated to avoid GC pressure inside the animation loop.
    const sph = new THREE.Spherical();
    const tmp = new THREE.Vector3();

    // Extracted so animate() stays below the cognitive-complexity limit.
    const stepCamera = () => {
      const keys = keysRef.current;
      if (keys.size === 0) return;
      sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
      if (keys.has("ArrowLeft"))  sph.theta  -= ORBIT_SPEED;
      if (keys.has("ArrowRight")) sph.theta  += ORBIT_SPEED;
      if (keys.has("ArrowUp"))    sph.phi     = Math.max(MIN_PHI,      sph.phi    - ORBIT_SPEED);
      if (keys.has("ArrowDown"))  sph.phi     = Math.min(MAX_PHI,      sph.phi    + ORBIT_SPEED);
      if (keys.has("ZoomIn"))     sph.radius  = Math.max(MIN_DISTANCE, sph.radius * DOLLY_FACTOR);
      if (keys.has("ZoomOut"))    sph.radius  = Math.min(MAX_DISTANCE, sph.radius / DOLLY_FACTOR);
      camera.position.copy(controls.target).add(tmp.setFromSpherical(sph));
    };

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      stepCamera();
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      globalThis.removeEventListener("resize",  onResize);
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("keyup",   onKeyUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup",   onPointerUp);
      controls.dispose();
      disposeMaterial(box.material);
      geometry.dispose();
      handles.forEach(h => h.material.dispose());
      renderer.dispose();
      showHandlesFn.current = null;
      hideHandlesFn.current = null;
      setSceneBgFn.current  = null;
      meshRef.current = null;
      renderer.domElement.remove();
    };
  }, [rendered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live material swap — fires when the user picks a different color or preset.
  useEffect(() => {
    if (meshRef.current) {
      setIsLoadingTextures(preset === "wood");
      disposeMaterial(meshRef.current.material);
      meshRef.current.material = buildMaterial(preset, color, () => setIsLoadingTextures(false));
    }
  }, [preset, color]);

  return (
    <div className="relative w-full h-full bg-[#f2f2f2] dark:bg-[#0f0f0f]">
      {!rendered ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={onRender}
            className="px-8 py-4 rounded-xl bg-indigo-500 text-white font-semibold text-base tracking-wide hover:bg-indigo-400 active:scale-95 transition-all duration-150 shadow-lg shadow-indigo-500/30"
          >
            Render a box
          </button>
        </div>
      ) : (
        <>
          <div ref={mountRef} className="w-full h-full" />

          {isLoadingTextures && (
            <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-[#f2f2f2]/60 dark:bg-[#0f0f0f]/60">
              <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 rounded-full border-2 border-black/10 dark:border-white/15 border-t-black/60 dark:border-t-white/80 animate-spin" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40 dark:text-white/50">
                  Loading
                </p>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <DPad keysRef={keysRef} />
          </div>

          <div className="absolute bottom-6 right-6 flex items-end">
            <ZoomControls keysRef={keysRef} />
          </div>
        </>
      )}
    </div>
  );
}
