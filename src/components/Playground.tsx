"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const ORBIT_SPEED = 0.025;
const DOLLY_FACTOR = 0.97; // multiply offset per frame when moving closer
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 12;
const UP = new THREE.Vector3(0, 1, 0);

export default function Playground() {
  const [rendered, setRendered] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Set<string>>(new Set());

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
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const material = new THREE.MeshStandardMaterial({
      color: "#6366f1",
      roughness: 0.35,
      metalness: 0.15,
    });
    const box = new THREE.Mesh(geometry, material);
    scene.add(box);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); // stop page scroll
        keysRef.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const keys = keysRef.current;
      if (keys.size > 0) {
        // offset = vector from orbit target to camera
        const offset = camera.position.clone().sub(controls.target);

        if (keys.has("ArrowLeft")) {
          offset.applyAxisAngle(UP, ORBIT_SPEED);
        }
        if (keys.has("ArrowRight")) {
          offset.applyAxisAngle(UP, -ORBIT_SPEED);
        }
        if (keys.has("ArrowUp")) {
          offset.multiplyScalar(DOLLY_FACTOR);
        }
        if (keys.has("ArrowDown")) {
          offset.multiplyScalar(1 / DOLLY_FACTOR);
        }

        // clamp distance so we don't clip through the box or fly away
        const dist = offset.length();
        if (dist < MIN_DISTANCE) offset.setLength(MIN_DISTANCE);
        if (dist > MAX_DISTANCE) offset.setLength(MAX_DISTANCE);

        camera.position.copy(controls.target).add(offset);
      }

      box.rotation.x += 0.003;
      box.rotation.y += 0.005;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [rendered]);

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
        <div ref={mountRef} className="w-full h-full" />
      )}
    </div>
  );
}
