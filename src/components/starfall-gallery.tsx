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

const STREAM_LANES_WIDE: StreamLane[] = [
  { baseX: -1.55, baseZ: 0.0, swayAmplitude: 0.32, depthAmplitude: 0.18, phase: 0, speed: 0.095 },
  { baseX: 0.0, baseZ: 0.15, swayAmplitude: 0.38, depthAmplitude: 0.22, phase: Math.PI * 0.66, speed: 0.082 },
  { baseX: 1.55, baseZ: 0.0, swayAmplitude: 0.32, depthAmplitude: 0.18, phase: Math.PI * 1.33, speed: 0.1 },
];

const STREAM_LANES_COMPACT: StreamLane[] = [
  { baseX: -0.82, baseZ: 0.0, swayAmplitude: 0.22, depthAmplitude: 0.12, phase: 0, speed: 0.085 },
  { baseX: 0.0, baseZ: 0.1, swayAmplitude: 0.26, depthAmplitude: 0.14, phase: Math.PI * 0.66, speed: 0.075 },
  { baseX: 0.82, baseZ: 0.0, swayAmplitude: 0.22, depthAmplitude: 0.12, phase: Math.PI * 1.33, speed: 0.09 },
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
  const maxPhotos = compact ? 15 : 20;

  const items = useMemo(() => memory.items.slice(0, maxPhotos), [memory.items, maxPhotos]);

  /* Pre-compute fallback thumbs for videos (use planet cover or nearest image thumb) */
  const fallbackThumbs = useMemo(() => {
    const map = new Map<string, string>();
    let nearestThumb: string | null = null;
    for (const item of memory.items) {
      if (item.type === "image" && item.thumb) nearestThumb = item.thumb;
      if (item.type === "video" && !item.thumb) {
        map.set(item.id, nearestThumb ?? (memory.cover ?? "/universe-media/thumbs/001.jpg"));
      }
    }
    return map;
  }, [memory.items, memory.cover]);

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
            fallbackThumb={fallbackThumbs.get(slot.media.id)}
          />
        ))}
      </group>

      {/* Background stardust rain */}
      <StardustRain compact={compact} colors={colors} />

      {/* Theme color fog */}
      <mesh position={[0, 0, -3]}>
        <sphereGeometry args={[compact ? 3.5 : 5, 24, 16]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -1, -4]}>
        <sphereGeometry args={[compact ? 4 : 6, 20, 14]} />
        <meshBasicMaterial color={colors[2]} transparent opacity={0.03} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
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
  fallbackThumb,
}: {
  media: UniverseMedia;
  slot: { laneIndex: number; positionInLane: number; totalInLane: number; globalIndex: number };
  compact: boolean;
  colors: [string, string, string];
  onPreview: (media: UniverseMedia) => void;
  fallbackThumb?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const lane = (compact ? STREAM_LANES_COMPACT : STREAM_LANES_WIDE)[slot.laneIndex];
  const progressOffset = slot.positionInLane / slot.totalInLane; // stagger start

  const photoW = compact ? 0.58 : 0.48;
  const photoH = compact ? 0.76 : 0.64;
  const fallRange = compact ? 5.5 : 7.0;
  const startY = compact ? 3.2 : 3.8;

  const isVideo = media.type === "video";
  const textureUrl = isVideo ? (fallbackThumb ?? "/universe-media/thumbs/001.jpg") : (media.thumb ?? media.url);
  const texture = useTexture(textureUrl);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = compact ? 4 : 8;
    texture.needsUpdate = true;
  }, [texture, compact]);

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
      const glowPulse = 0.1 + Math.sin(state.clock.elapsedTime * 1.2 + slot.globalIndex) * 0.03;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowPulse;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onPreview(media);
  };

  return (
    <group ref={groupRef}>
      {/* Circular glow halo behind photo */}
      <mesh ref={glowRef} position={[0, 0, -0.02]}>
        <circleGeometry args={[Math.max(photoW, photoH) * 0.72, 48]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Photo plane */}
      <mesh onClick={handleClick}>
        <planeGeometry args={[photoW, photoH]} />
        <meshBasicMaterial map={texture} transparent opacity={isVideo ? 0.7 : 0.98} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Video darkening overlay + play icon */}
      {isVideo ? (
        <group>
          <mesh position={[0, 0, 0.005]}>
            <planeGeometry args={[photoW, photoH]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <group position={[0, 0, 0.01]}>
            <mesh>
              <circleGeometry args={[compact ? 0.1 : 0.12, 24]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
            </mesh>
            <mesh rotation={[0, 0, 0.15]} position={[0.01, 0, 0.001]}>
              <coneGeometry args={[0.025, 0.05, 3]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ) : null}
    </group>
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
