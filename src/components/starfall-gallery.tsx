"use client";

import { Billboard, Text, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { UniverseMedia, BigMemoryPlanet } from "@/components/three-memory-universe";

/* ─── Theme Colors ─── */
const THEME_COLORS: Record<BigMemoryPlanet["theme"], [string, string, string]> = {
  pink: ["#ff8bd8", "#ffd7f2", "#6f255f"],
  cyan: ["#8ee7ff", "#dff8ff", "#1f5c6b"],
  gold: ["#ffd18f", "#fff0c8", "#6b4b1e"],
};

/* ─── Pseudo-random seed (same as three-memory-universe) ─── */
function seed(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/* ─── Stream config for 3 waterfall lanes ─── */
interface StreamLane {
  baseX: number;
  baseZ: number;
  swayAmplitude: number;
  depthAmplitude: number;
  phase: number;
  speed: number;
}

const STREAM_LANES: StreamLane[] = [
  { baseX: -1.55, baseZ: 0.0, swayAmplitude: 0.32, depthAmplitude: 0.18, phase: 0, speed: 0.095 },
  { baseX: 0.0, baseZ: 0.15, swayAmplitude: 0.38, depthAmplitude: 0.22, phase: Math.PI * 0.66, speed: 0.082 },
  { baseX: 1.55, baseZ: 0.0, swayAmplitude: 0.32, depthAmplitude: 0.18, phase: Math.PI * 1.33, speed: 0.1 },
];

/* ═══════════════════════════════════════════════════════════════
   StarfallGallery – exported entry
   ═══════════════════════════════════════════════════════════════ */
export function StarfallGallery({
  memory,
  compact,
  onPreview,
  visible,
}: {
  memory: BigMemoryPlanet;
  compact: boolean;
  onPreview: (media: UniverseMedia) => void;
  visible: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const currentOpacity = useRef(0);

  /* Smooth fade in / out */
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = visible ? 1 : 0;
    currentOpacity.current = THREE.MathUtils.lerp(currentOpacity.current, target, Math.min(1, delta * 3.5));
    group.current.visible = currentOpacity.current > 0.01;
    // We handle per-child opacity in children, but we also scale for a nice zoom feel
    const s = 0.92 + currentOpacity.current * 0.08;
    group.current.scale.setScalar(s);
  });

  return (
    <group ref={group}>
      <GalleryContent memory={memory} compact={compact} onPreview={onPreview} />
    </group>
  );
}

/* ─── Internal content holder ─── */
function GalleryContent({
  memory,
  compact,
  onPreview,
}: {
  memory: BigMemoryPlanet;
  compact: boolean;
  onPreview: (media: UniverseMedia) => void;
}) {
  const colors = THEME_COLORS[memory.theme];
  const maxPhotos = compact ? 12 : 20;

  const items = useMemo(() => memory.items.slice(0, maxPhotos), [memory.items, maxPhotos]);

  /* Distribute photos evenly across 3 lanes */
  const photoSlots = useMemo(() => {
    return items.map((media, index) => {
      const laneIndex = index % 3;
      const positionInLane = Math.floor(index / 3);
      const totalInLane = Math.ceil(items.length / 3);
      return { media, laneIndex, positionInLane, totalInLane, globalIndex: index };
    });
  }, [items]);

  return (
    <>
      {/* Title */}
      <StarfallTitle title={memory.title} colors={colors} />

      {/* Waterfall photos */}
      <group>
        {photoSlots.map((slot) => (
          <WaterfallPhoto
            key={slot.media.id}
            media={slot.media}
            slot={slot}
            compact={compact}
            colors={colors}
            onPreview={onPreview}
          />
        ))}
      </group>

      {/* Background stardust rain */}
      <StardustRain compact={compact} colors={colors} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WaterfallPhoto – single photo falling along S-curve with trail
   ═══════════════════════════════════════════════════════════════ */
function WaterfallPhoto({
  media,
  slot,
  compact,
  colors,
  onPreview,
}: {
  media: UniverseMedia;
  slot: { laneIndex: number; positionInLane: number; totalInLane: number; globalIndex: number };
  compact: boolean;
  colors: [string, string, string];
  onPreview: (media: UniverseMedia) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);

  const lane = STREAM_LANES[slot.laneIndex];
  const progressOffset = slot.positionInLane / slot.totalInLane; // stagger start

  const photoW = compact ? 0.38 : 0.48;
  const photoH = compact ? 0.5 : 0.64;
  const fallRange = compact ? 5.0 : 7.0;
  const startY = compact ? 2.8 : 3.8;
  const trailCount = compact ? 5 : 10;

  /* Trail particle buffer – lazily built once */
  const trailGeometry = useMemo(() => {
    const positions = new Float32Array(trailCount * 3);
    const sizes = new Float32Array(trailCount);
    const opacities = new Float32Array(trailCount);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute("aOpacity", new THREE.Float32BufferAttribute(opacities, 1));
    return geo;
  }, [trailCount]);

  const isVideo = media.type === "video";
  const texture = useTexture(isVideo ? "/universe-media/thumbs/001.jpg" : (media.thumb ?? media.url));

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = compact ? 1 : 2;
    texture.needsUpdate = true;
  }, [texture, compact]);

  const trailMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: compact ? 0.045 : 0.058,
        color: colors[0],
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [colors, compact],
  );

  /* S-curve position calculator */
  function getPosition(progress: number): [number, number, number] {
    const x = lane.baseX + Math.sin(progress * Math.PI * 2 + lane.phase) * lane.swayAmplitude;
    const y = startY - progress * fallRange;
    const z = lane.baseZ + Math.cos(progress * Math.PI + lane.phase) * lane.depthAmplitude;
    return [x, y, z];
  }

  /* Animate every frame */
  useFrame((state) => {
    if (!groupRef.current) return;

    const elapsed = state.clock.elapsedTime * lane.speed;
    const rawProgress = (elapsed + progressOffset) % 1;

    const [px, py, pz] = getPosition(rawProgress);
    groupRef.current.position.set(px, py, pz);

    // Billboard toward camera
    const { camera } = state;
    groupRef.current.quaternion.slerp(camera.quaternion, 0.18);

    // Breathing scale
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.85 + slot.globalIndex * 1.1) * 0.028;
    groupRef.current.scale.setScalar(breath);

    // Glow pulse
    if (glowRef.current) {
      const glowPulse = 0.14 + Math.sin(state.clock.elapsedTime * 1.2 + slot.globalIndex) * 0.04;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowPulse;
    }

    // Update trail particles
    if (trailRef.current) {
      const posAttr = trailRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const sizeAttr = trailRef.current.geometry.getAttribute("size") as THREE.BufferAttribute;

      for (let i = 0; i < trailCount; i++) {
        const trailProgress = (rawProgress - (i + 1) * 0.008 + 1) % 1;
        const [tx, ty, tz] = getPosition(trailProgress);
        posAttr.setXYZ(i, tx, ty, tz);

        const s = Math.max(0.001, (1 - i / trailCount) * (compact ? 0.04 : 0.055));
        sizeAttr.setX(i, s);
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      // Fade trail material opacity based on trail count
      (trailRef.current.material as THREE.PointsMaterial).opacity = 0.6;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onPreview(media);
  };

  return (
    <>
      {/* Trail particles */}
      <points ref={trailRef} geometry={trailGeometry} material={trailMaterial} />

      <group ref={groupRef}>
        {/* Glow halo */}
        <mesh ref={glowRef} scale={[1.55, 1.55, 1]} position={[0, 0, -0.02]}>
          <planeGeometry args={[photoW * 1.35, photoH * 1.35]} />
          <meshBasicMaterial color={colors[0]} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Outer glow (larger, fainter) */}
        <mesh scale={[2.0, 2.0, 1]} position={[0, 0, -0.03]}>
          <planeGeometry args={[photoW * 1.15, photoH * 1.15]} />
          <meshBasicMaterial color={colors[1]} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Photo plane */}
        <mesh onClick={handleClick}>
          <planeGeometry args={[photoW, photoH]} />
          <meshBasicMaterial map={texture} transparent opacity={isVideo ? 0.5 : 0.96} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {/* Video indicator */}
        {isVideo ? (
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[compact ? 0.08 : 0.1, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
          </mesh>
        ) : null}

        {/* Subtle border frame */}
        <mesh scale={[1.04, 1.04, 1]} position={[0, 0, 0.001]}>
          <planeGeometry args={[photoW, photoH]} />
          <meshBasicMaterial color={colors[2]} transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   StardustRain – background particle rain
   ═══════════════════════════════════════════════════════════════ */
function StardustRain({ compact, colors }: { compact: boolean; colors: [string, string, string] }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = compact ? 200 : 600;
  const particleSize = compact ? 0.028 : 0.038;

  const { positions, velocities, colorArray } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count); // y-speed per particle
    const col = new Float32Array(count * 3);

    const c0 = new THREE.Color(colors[0]);
    const c1 = new THREE.Color(colors[1]);
    const white = new THREE.Color("#ffffff");
    const purple = new THREE.Color("#d4b8ff");

    const palette = [c0, c1, white, purple];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (seed(i, 1) - 0.5) * 7; // x
      pos[i * 3 + 1] = (seed(i, 2) - 0.5) * 10; // y
      pos[i * 3 + 2] = (seed(i, 3) - 0.5) * 4 - 0.5; // z

      vel[i] = 0.15 + seed(i, 4) * 0.35; // fall speed

      // Pick a random palette color
      const target = palette[i % palette.length];
      const mixed = c0.clone().lerp(target, seed(i, 5) * 0.6);
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }

    return { positions: pos, velocities: vel, colorArray: col };
  }, [count, colors]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [particleSize],
  );

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const halfYRange = compact ? 5 : 5;
    const bottomY = -halfYRange;
    const topY = halfYRange;

    for (let i = 0; i < count; i++) {
      let y = posAttr.getY(i) - velocities[i] * delta;
      if (y < bottomY) {
        y = topY;
        // Slightly randomize x/z on respawn
        posAttr.setX(i, (seed(i, 1 + Math.floor(performance.now() * 0.0001)) - 0.5) * 7);
        posAttr.setZ(i, (seed(i, 3) - 0.5) * 4 - 0.5);
      }
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colorArray, 3));
    return geo;
  }, [positions, colorArray]);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/* ═══════════════════════════════════════════════════════════════
   StarfallTitle – glowing title at the top
   ═══════════════════════════════════════════════════════════════ */
function StarfallTitle({ title, colors }: { title: string; colors: [string, string, string] }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    // Gentle float
    group.current.position.y = 4.2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.06;
  });

  return (
    <group ref={group} position={[0, 4.2, 0.5]}>
      {/* Glow backdrop */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[2.8, 0.52]} />
        <meshBasicMaterial color={colors[2]} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Main title text */}
      <Text
        fontSize={0.22}
        anchorX="center"
        anchorY="middle"
        color={colors[1]}
        outlineWidth={0.012}
        outlineColor={colors[0]}
        fillOpacity={0.95}
        outlineOpacity={0.7}
      >
        {title}
      </Text>

      {/* Duplicate glow text (slightly offset, additive) */}
      <Text
        position={[0, 0, -0.01]}
        fontSize={0.22}
        anchorX="center"
        anchorY="middle"
        color={colors[0]}
        fillOpacity={0.15}
        outlineWidth={0.008}
        outlineColor={colors[0]}
        outlineOpacity={0.3}
      >
        {title}
      </Text>
    </group>
  );
}
