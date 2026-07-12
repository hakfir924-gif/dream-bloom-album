"use client";

import { AdaptiveDpr, Billboard, OrbitControls, PerformanceMonitor, PerspectiveCamera, Stars, Text, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { MemoryOrbitRing } from "@/components/memory-orbit-ring";
import type { MemoryRecord } from "@/data/memory-records";
import { MemoryPlanetGroup } from "@/components/memory-planet-group";
import { deleteLocalDiary, loadLocalDiaries, loadLocalPlanets, seedDemoDiaries, type DiaryMood, type LocalDiaryEntry, type LocalMemoryPlanet } from "@/data/local-memory-store";
import { CreateMemorySheet } from "@/components/create-memory-sheet";
import { CreateDiarySheet } from "@/components/create-diary-sheet";
import { DiaryReader } from "@/components/diary-reader";
import { StarCalendar } from "@/components/star-calendar";

export type UniverseMedia = {
  id: string;
  type: "image" | "video" | "text";
  url: string;
  thumb: string | null;
  originalName: string;
  text?: string;
  date?: string;
  location?: string;
  note?: string;
};

export type MemoryTheme = "pink" | "cyan" | "gold" | "purple";

export type BigMemoryPlanet = {
  id: "photos" | "motion" | "best";
  title: string;
  subtitle: string;
  theme: "pink" | "cyan" | "gold";
  cover: string | null;
  items: UniverseMedia[];
};

export type SmallMemoryPlanet = {
  id: string;
  title: string;
  subtitle: string;
  cover: string | null;
  items: UniverseMedia[];
};

export type MemoryCollection = {
  id: string;
  title: string;
  subtitle: string;
  theme: MemoryTheme;
  cover: string | null;
  items: UniverseMedia[];
};

export type UniverseManifest = {
  counts: { total: number; images: number; videos: number; smallGroups: number };
  smallPlanets: SmallMemoryPlanet[];
  bigPlanets: BigMemoryPlanet[];
};

type ThreeMemoryUniverseProps = {
  exploring: boolean;
  onPreview: (media: UniverseMedia, record?: MemoryRecord) => void;
  onOpenCollection?: (memory: MemoryCollection) => void;
  onOpenDiary?: (entry: LocalDiaryEntry) => void;
};

export type MemoryNode = MemoryCollection & {
  position: [number, number, number];
  size: number;
  phase: number;
  year: "2023" | "2024" | "2025";
  important: boolean;
};

const THEME_COLORS: Record<MemoryTheme, [string, string, string]> = {
  pink: ["#ff8bd8", "#ffe2f6", "#7d2b67"],
  cyan: ["#8ee7ff", "#e3fbff", "#1f6271"],
  gold: ["#ffd18f", "#fff1c9", "#7a531e"],
  purple: ["#c4a2ff", "#f0e7ff", "#3f246e"],
};

const BIG_PLANET_NAMES: Record<BigMemoryPlanet["id"], string> = {
  photos: "曦光星",
  motion: "月澜星",
  best: "曜藏星",
};

export function ThreeMemoryUniverse({ exploring, onPreview, onOpenCollection, onOpenDiary }: ThreeMemoryUniverseProps) {
  const [manifest, setManifest] = useState<UniverseManifest | null>(null);
  const [localPlanets, setLocalPlanets] = useState<LocalMemoryPlanet[]>([]);
  const [diaries, setDiaries] = useState<LocalDiaryEntry[]>([]);
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(true);
  const [shipMenuOpen, setShipMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState<LocalDiaryEntry | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [diaryRevision, setDiaryRevision] = useState(0);
  const [reducedFx, setReducedFx] = useState(false);
  const [arrivedMemoryId, setArrivedMemoryId] = useState<string | null>(null);
  const flightIntensity = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCreateMemory = () => setCreateOpen(true);
  const openDiary = (entry: LocalDiaryEntry) => onOpenDiary ? onOpenDiary(entry) : setSelectedDiary(entry);
  const removeDiary = async (id: string) => {
    await deleteLocalDiary(id);
    if (selectedDiary?.id === id) setSelectedDiary(null);
    setDiaryRevision((revision) => revision + 1);
  };

  useEffect(() => {
    fetch("/universe-media/manifest.json").then((res) => res.json()).then(setManifest).catch(() => setManifest(null));
  }, []);

  useEffect(() => {
    loadLocalPlanets().then(setLocalPlanets).catch(() => setLocalPlanets([]));
  }, [localRevision]);

  useEffect(() => {
    seedDemoDiaries().then(loadLocalDiaries).then(setDiaries).catch(() => setDiaries([]));
  }, [diaryRevision]);

  const nodes = useMemo(() => (manifest ? buildMemoryNodes(manifest, isMobile, localPlanets) : []), [isMobile, localPlanets, manifest]);
  const activeMemory = nodes.find((node) => node.id === activeMemoryId) ?? null;
  const fxCompact = isMobile || reducedFx;

  const selectMemory = (id: string) => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setArrivedMemoryId(null);
    setActiveMemoryId(id);
    setShipMenuOpen(false);
  };

  const exitMemory = () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setArrivedMemoryId(null);
    setShipMenuOpen(false);
    exitTimer.current = setTimeout(() => {
      setActiveMemoryId(null);
      exitTimer.current = null;
    }, 620);
  };

  const visitRandomMemory = () => {
    const choices = nodes.filter((node) => node.id !== activeMemoryId);
    if (choices.length === 0) return;
    selectMemory(choices[Math.floor(Math.random() * choices.length)].id);
  };

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 820 || window.matchMedia("(pointer: coarse)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!activeMemoryId || !exploring) return;
    return playFlightAudioCue();
  }, [activeMemoryId, exploring]);

  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        className="h-full w-full touch-none"
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={isMobile ? [1, 2] : [1, 1.45]}
      >
        <PerformanceMonitor flipflops={2} onDecline={() => setReducedFx(true)} onFallback={() => setReducedFx(true)} />
        <AdaptiveDpr pixelated />
        <PerspectiveCamera makeDefault position={[0, 0.35, 11.2]} fov={48} />
        <color attach="background" args={["#070311"]} />
        <fog attach="fog" args={["#0b031d", 6.5, 27]} />
        <ambientLight intensity={1.04} />
        <pointLight position={[0, 0, 0]} color="#ff91d7" intensity={5.8} distance={15} />
        <pointLight position={[-5.2, 3.8, 3.2]} color="#8ee7ff" intensity={3.4} distance={16} />
        <pointLight position={[4.4, -2.8, -3.5]} color="#c4a2ff" intensity={2.6} distance={18} />
        <Stars radius={95} depth={62} count={isMobile ? 900 : 1900} factor={isMobile ? 1.15 : 1.45} saturation={0.45} fade speed={0.014} />
        <Stars radius={70} depth={48} count={isMobile ? 950 : 2100} factor={isMobile ? 1.9 : 2.55} saturation={0.9} fade speed={0.032} />
        <NebulaClouds compact={fxCompact} active={Boolean(activeMemoryId)} flightRef={flightIntensity} />
        <DistantStarClusters compact={fxCompact} active={Boolean(activeMemoryId)} />
        <YearConstellations dimmed={Boolean(activeMemoryId)} />
        <NearParticles compact={fxCompact} active={Boolean(activeMemoryId)} flightRef={flightIntensity} />
        <DreamPetals compact={fxCompact} flightRef={flightIntensity} />
        <VelocityStreaks compact={fxCompact} flightRef={flightIntensity} />
        <ShootingStars compact={fxCompact} active={Boolean(activeMemoryId)} />
        <CosmicPulseEvents compact={fxCompact} active={Boolean(activeMemoryId)} />
        <SpaceDust compact={fxCompact} active={Boolean(activeMemoryId)} flightRef={flightIntensity} />
        <UniverseCamera
          exploring={exploring}
          activeMemory={activeMemory}
          compact={isMobile}
          flightRef={flightIntensity}
          onArrival={setArrivedMemoryId}
        />
        {manifest ? (
          <SceneContent
            nodes={nodes}
            exploring={exploring}
            activeMemoryId={activeMemoryId}
            arrivedMemoryId={arrivedMemoryId}
            compact={isMobile}
            onSelectMemory={selectMemory}
            onPreview={onPreview}
            onOpenCollection={onOpenCollection}
            diaries={diaries}
            onOpenDiary={openDiary}
            onShipOpen={() => setShipMenuOpen((open) => !open)}
          />
        ) : null}
        {!fxCompact ? <DreamPostEffects /> : null}
      </Canvas>

      {activeMemoryId ? (
        <button
          type="button"
          onClick={exitMemory}
          className="absolute left-4 top-5 z-20 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs tracking-[0.14em] text-pink-50 backdrop-blur-md active:scale-95"
        >
          返回星海
        </button>
      ) : null}
      {shipMenuOpen ? (
        <div className="absolute bottom-5 left-1/2 z-20 w-[min(290px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/14 bg-[#170b28]/72 p-2 shadow-[0_16px_54px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <button type="button" onClick={() => { setShipMenuOpen(false); setDiaryOpen(true); }} className="mb-2 min-h-12 w-full rounded-xl border border-pink-100/24 bg-pink-100/14 px-3 text-sm tracking-[0.1em] text-pink-50 transition active:scale-95">记录今天</button>
          <button type="button" onClick={() => { setShipMenuOpen(false); setCalendarOpen(true); }} className="mb-2 min-h-11 w-full rounded-xl border border-purple-100/18 bg-purple-100/10 px-3 text-xs tracking-[0.1em] text-purple-50 transition active:scale-95">打开星历</button>
          <p className="px-3 pb-2 pt-1 text-center text-[10px] tracking-[0.16em] text-pink-100/62">记忆航行器</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={visitRandomMemory} className="min-h-11 rounded-xl border border-pink-100/14 bg-pink-100/10 px-3 text-xs text-pink-50 transition active:scale-95">随机抵达</button>
            <button type="button" onClick={exitMemory} className="min-h-11 rounded-xl border border-white/12 bg-white/7 px-3 text-xs text-white/86 transition active:scale-95">返回星海</button>
          </div>
          <button type="button" onClick={() => { setShipMenuOpen(false); onCreateMemory(); }} className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/18 bg-cyan-100/10 px-3 text-xs tracking-[0.08em] text-cyan-50 transition active:scale-95">创造记忆星球</button>
        </div>
      ) : null}
      <CreateMemorySheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setLocalRevision((revision) => revision + 1)} />
      <CreateDiarySheet open={diaryOpen} onClose={() => setDiaryOpen(false)} onCreated={() => setDiaryRevision((revision) => revision + 1)} />
      <StarCalendar open={calendarOpen} entries={diaries} onClose={() => setCalendarOpen(false)} onOpenEntry={openDiary} onDeleteEntry={removeDiary} />
      <DiaryReader entry={selectedDiary} onClose={() => setSelectedDiary(null)} />
    </div>
  );
}

function UniverseCamera({
  exploring,
  activeMemory,
  compact,
  flightRef,
  onArrival,
}: {
  exploring: boolean;
  activeMemory: MemoryNode | null;
  compact: boolean;
  flightRef: MutableRefObject<number>;
  onArrival: (memoryId: string | null) => void;
}) {
  const controls = useRef<OrbitControlsType | null>(null);
  const { camera } = useThree();
  const previousId = useRef<string | null>(null);
  const flight = useRef<{
    startedAt: number;
    fromPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    positionCurve: THREE.CubicBezierCurve3;
    targetCurve: THREE.CubicBezierCurve3;
    duration: number;
    destinationId: string | null;
    arcDirection: number;
    fromFov: number;
    targetFov: number;
  } | null>(null);
  const cameraPoint = useRef(new THREE.Vector3());
  const targetPoint = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!controls.current) return;
    let completedThisFrame = false;
    const nextId = activeMemory?.id ?? null;
    if (previousId.current !== nextId) {
      previousId.current = nextId;
      const target = activeMemory ? new THREE.Vector3(...activeMemory.position) : new THREE.Vector3(0, 0, 0);
      const position = activeMemory
        ? target.clone().add(new THREE.Vector3(0.14, 0.22, compact ? 5.6 : 6.6))
        : new THREE.Vector3(0, 0.35, 11.2);
      const direction = position.clone().sub(camera.position).normalize();
      const distance = camera.position.distanceTo(position);
      const side = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
      const arcDirection = (activeMemory?.phase ?? 1) % 2 > 1 ? -1 : 1;
      const positionControlA = camera.position.clone().addScaledVector(direction, distance * 0.16).addScaledVector(side, arcDirection * (compact ? 0.34 : 0.55));
      positionControlA.y += activeMemory ? (compact ? 0.22 : 0.34) : 0.18;
      const positionControlB = camera.position.clone().lerp(position, 0.76).addScaledVector(side, arcDirection * (compact ? 0.88 : 1.35));
      positionControlB.y += activeMemory ? (compact ? 0.48 : 0.76) : 0.28;
      const targetControlA = controls.current.target.clone().lerp(target, 0.28);
      targetControlA.y += activeMemory ? 0.12 : 0.06;
      const targetControlB = controls.current.target.clone().lerp(target, 0.78);
      targetControlB.y += activeMemory ? 0.3 : 0.1;
      flight.current = {
        startedAt: performance.now(),
        fromPosition: camera.position.clone(),
        fromTarget: controls.current.target.clone(),
        positionCurve: new THREE.CubicBezierCurve3(camera.position.clone(), positionControlA, positionControlB, position),
        targetCurve: new THREE.CubicBezierCurve3(controls.current.target.clone(), targetControlA, targetControlB, target),
        duration: activeMemory ? (compact ? 2250 : 2550) : 1750,
        destinationId: nextId,
        arcDirection,
        fromFov: (camera as THREE.PerspectiveCamera).fov,
        targetFov: activeMemory ? 45 : 48,
      };
    }

    if (flight.current) {
      const elapsed = performance.now() - flight.current.startedAt;
      const progress = THREE.MathUtils.clamp(elapsed / flight.current.duration, 0, 1);
      const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
      const accelerate = THREE.MathUtils.smoothstep(progress, 0.04, 0.34);
      const brake = 1 - THREE.MathUtils.smoothstep(progress, 0.68, 0.98);
      const pulse = Math.pow(accelerate * brake, 0.72);
      controls.current.enabled = false;
      flight.current.positionCurve.getPoint(eased, cameraPoint.current);
      flight.current.targetCurve.getPoint(eased, targetPoint.current);
      camera.position.copy(cameraPoint.current);
      controls.current.target.copy(targetPoint.current);
      flightRef.current = THREE.MathUtils.lerp(flightRef.current, pulse, 0.18);
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.fov = THREE.MathUtils.lerp(flight.current.fromFov, flight.current.targetFov, eased) + pulse * (compact ? 4.2 : 6.8);
      perspective.updateProjectionMatrix();
      camera.lookAt(targetPoint.current);
      camera.rotateZ(Math.sin(progress * Math.PI) * (compact ? 0.012 : 0.02) * flight.current.arcDirection);
      if (progress >= 1) {
        const destinationId = flight.current.destinationId;
        const targetFov = flight.current.targetFov;
        completedThisFrame = true;
        flight.current = null;
        flightRef.current = 0;
        perspective.fov = targetFov;
        perspective.updateProjectionMatrix();
        onArrival(destinationId);
      }
    } else {
      controls.current.enabled = exploring;
      flightRef.current = THREE.MathUtils.lerp(flightRef.current, 0, 0.12);
    }
    controls.current.enableZoom = exploring;
    if (!flight.current && !completedThisFrame) controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={activeMemory ? 2.8 : 4.6}
      maxDistance={activeMemory ? (compact ? 7.2 : 9.2) : 15}
      rotateSpeed={0.42}
      zoomSpeed={0.52}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    />
  );
}

function SceneContent({
  nodes,
  exploring,
  activeMemoryId,
  arrivedMemoryId,
  compact,
  onSelectMemory,
  onPreview,
  onOpenCollection,
  diaries,
  onOpenDiary,
  onShipOpen,
}: {
  nodes: MemoryNode[];
  exploring: boolean;
  activeMemoryId: string | null;
  arrivedMemoryId: string | null;
  compact: boolean;
  onSelectMemory: (id: string) => void;
  onPreview: (media: UniverseMedia, record?: MemoryRecord) => void;
  onOpenCollection?: (memory: MemoryCollection) => void;
  diaries: LocalDiaryEntry[];
  onOpenDiary: (entry: LocalDiaryEntry) => void;
  onShipOpen: () => void;
}) {
  const activeMemory = nodes.find((node) => node.id === activeMemoryId) ?? null;

  return (
    <group scale={exploring ? 1 : 0.72}>
      {!activeMemory ? <CenterMark dimmed={false} /> : null}
      <MemoryShip compact={compact} dimmed={Boolean(activeMemory)} onOpen={onShipOpen} />
      <MemoryStarField nodes={nodes} activeMemoryId={activeMemoryId} arrivedMemoryId={arrivedMemoryId} onSelectMemory={onSelectMemory} onOpenCollection={onOpenCollection} />
      <DiaryStarField entries={diaries} dimmed={Boolean(activeMemory)} onOpen={onOpenDiary} />
      {/* Floating memories stay around the planet while its central cover remains the collection entry. */}
      {activeMemory ? <MemoryOrbitRing memory={activeMemory} origin={activeMemory.position} compact={compact} expanded={arrivedMemoryId === activeMemory.id} onPreview={onPreview} /> : null}
      <ReleaseFlash memory={activeMemory && arrivedMemoryId === activeMemory.id ? activeMemory : null} />
    </group>
  );
}

function DreamPostEffects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={0.72} luminanceThreshold={0.76} luminanceSmoothing={0.48} mipmapBlur />
      <Vignette eskil={false} offset={0.24} darkness={0.62} />
    </EffectComposer>
  );
}

function MemoryShip({ compact, dimmed, onOpen }: { compact: boolean; dimmed: boolean; onOpen: () => void }) {
  const ship = useRef<THREE.Group>(null);
  const engine = useRef<THREE.MeshBasicMaterial>(null);
  const engineRing = useRef<THREE.Mesh>(null);
  const cabin = useRef<THREE.MeshPhysicalMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const wingShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.2, 0);
    shape.lineTo(0.2, 0.035);
    shape.lineTo(-0.1, 0.31);
    shape.lineTo(-0.26, 0.25);
    shape.closePath();
    return shape;
  }, []);
  const trail = useMemo(() => {
    const values = new Float32Array(22 * 3);
    for (let index = 0; index < 22; index += 1) {
      const distance = index / 21;
      values[index * 3] = -0.42 - distance * 0.78;
      values[index * 3 + 1] = (seed(index, 71) - 0.5) * (0.04 + distance * 0.17);
      values[index * 3 + 2] = (seed(index, 72) - 0.5) * (0.04 + distance * 0.12);
    }
    return values;
  }, []);

  useFrame((state, delta) => {
    if (!ship.current) return;
    const t = state.clock.elapsedTime;
    ship.current.position.y = (compact ? 2.25 : 2.55) + Math.sin(t * 0.62) * 0.08;
    ship.current.position.x = (compact ? 2.35 : 3.35) + Math.cos(t * 0.36) * 0.09;
    ship.current.rotation.z = -0.12 + Math.sin(t * 0.42) * 0.035;
    ship.current.rotation.y = Math.sin(t * 0.31) * 0.16;
    ship.current.scale.setScalar(THREE.MathUtils.lerp(ship.current.scale.x, hovered ? 1.1 : dimmed ? 0.72 : 1, 0.08));
    if (engine.current) engine.current.opacity = dimmed ? 0.1 : 0.4 + Math.sin(t * 4.2) * 0.14;
    if (engineRing.current) engineRing.current.rotation.x += delta * 1.2;
    if (cabin.current) cabin.current.emissiveIntensity = dimmed ? 0.12 : 0.42 + Math.sin(t * 1.5) * 0.08;
  });

  const open = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onOpen();
  };

  return (
    <group ref={ship} position={[compact ? 2.35 : 3.35, compact ? 2.25 : 2.55, 0.35]} scale={compact ? 0.86 : 1}>
      <mesh rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.82]}>
        <capsuleGeometry args={[0.13, 0.42, 8, 20]} />
        <meshPhysicalMaterial color="#fff8ff" emissive="#e9b9ff" emissiveIntensity={0.2} roughness={0.18} metalness={0.34} clearcoat={1} clearcoatRoughness={0.12} transparent opacity={dimmed ? 0.3 : 0.94} />
      </mesh>
      <mesh position={[0.39, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 0.9, 0.78]}>
        <coneGeometry args={[0.13, 0.3, 20]} />
        <meshPhysicalMaterial color="#fff5ff" emissive="#f6c8ff" emissiveIntensity={0.18} roughness={0.16} metalness={0.42} clearcoat={1} />
      </mesh>
      <mesh position={[0.1, 0.105, 0.105]} scale={[0.86, 0.66, 0.62]}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshPhysicalMaterial ref={cabin} color="#b9edff" emissive="#72d9ff" emissiveIntensity={0.42} transmission={0.3} thickness={0.7} transparent opacity={dimmed ? 0.15 : 0.72} roughness={0.05} metalness={0.08} clearcoat={1} />
      </mesh>
      <mesh position={[-0.08, -0.03, 0.02]}>
        <shapeGeometry args={[wingShape]} />
        <meshPhysicalMaterial color="#f5c982" emissive="#ffbc68" emissiveIntensity={0.28} roughness={0.22} metalness={0.58} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.22 : 0.88} />
      </mesh>
      <mesh position={[-0.08, 0.03, -0.03]} scale={[1, -1, 1]}>
        <shapeGeometry args={[wingShape]} />
        <meshPhysicalMaterial color="#f1b9dc" emissive="#ff8fd2" emissiveIntensity={0.25} roughness={0.22} metalness={0.46} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.2 : 0.86} />
      </mesh>
      <mesh ref={engineRing} position={[-0.36, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.15, 0.014, 8, 40]} />
        <meshBasicMaterial color="#aeeeff" transparent opacity={dimmed ? 0.08 : 0.68} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[-0.53, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.6, 0.76, 0.76]}>
        <coneGeometry args={[0.13, 0.42, 20]} />
        <meshBasicMaterial ref={engine} color="#bdefff" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <points>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[trail, 3]} /></bufferGeometry>
        <pointsMaterial size={0.04} color="#ffc9ec" transparent opacity={dimmed ? 0.1 : 0.68} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      <mesh scale={[1.9, 1.25, 1.25]} onClick={open} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard position={[0, -0.48, 0]} follow>
        <Text fontSize={0.045} anchorX="center" anchorY="middle" color="#ffe9f8" fillOpacity={dimmed ? 0.28 : hovered ? 0.92 : 0.6}>
          记忆航行器
        </Text>
      </Billboard>
    </group>
  );
}

const DIARY_MOOD_COLORS: Record<DiaryMood, [string, string]> = {
  happy: ["#ff9fd1", "#fff0ad"],
  calm: ["#85e8ff", "#e7fbff"],
  miss: ["#bd9cff", "#ffd4ed"],
  sad: ["#789bd1", "#d9e8ff"],
  excited: ["#ffc36f", "#fff2b5"],
  tired: ["#9990ad", "#e7deef"],
};

function DiaryStarField({ entries, dimmed, onOpen }: { entries: LocalDiaryEntry[]; dimmed: boolean; onOpen: (entry: LocalDiaryEntry) => void }) {
  const visibleEntries = entries.filter((entry) => entry.attachments.length > 0).slice(0, 24);
  return <group>{visibleEntries.map((entry, index) => <DiaryStar key={entry.id} entry={entry} index={index} dimmed={dimmed} onOpen={onOpen} />)}</group>;
}

function DiaryStar({ entry, index, dimmed, onOpen }: { entry: LocalDiaryEntry; index: number; dimmed: boolean; onOpen: (entry: LocalDiaryEntry) => void }) {
  const group = useRef<THREE.Group>(null);
  const star = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Points>(null);
  const [hovered, setHovered] = useState(false);
  const colors = DIARY_MOOD_COLORS[entry.mood];
  const angle = index * 2.399 + 0.74;
  const radius = 2.45 + (index % 5) * 0.54 + Math.floor(index / 5) * 0.22;
  const position = useMemo(() => [Math.cos(angle) * radius, -2.25 + (index % 4) * 0.55, Math.sin(angle) * radius * 0.56 - 0.2] as [number, number, number], [angle, index, radius]);
  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    for (let point = 0; point < 10; point += 1) {
      const pointAngle = -Math.PI / 2 + point * Math.PI / 5;
      const pointRadius = point % 2 === 0 ? 0.17 : 0.065;
      const x = Math.cos(pointAngle) * pointRadius;
      const y = Math.sin(pointAngle) * pointRadius;
      if (point === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);
  const dustPositions = useMemo(() => {
    const values = new Float32Array(18 * 3);
    for (let particle = 0; particle < 18; particle += 1) {
      const spread = seed(index * 31 + particle, 7);
      values[particle * 3] = -0.1 - spread * 0.58;
      values[particle * 3 + 1] = (seed(index * 43 + particle, 8) - 0.5) * (0.08 + spread * 0.22);
      values[particle * 3 + 2] = (seed(index * 59 + particle, 9) - 0.5) * 0.12;
    }
    return values;
  }, [index]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const time = state.clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(time * 0.52 + index) * 0.08;
    const target = dimmed ? 0.45 : hovered ? 1.16 : 1;
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, target, 0.08));
    if (star.current) {
      star.current.rotation.z += delta * 0.08;
      const pulse = 1 + Math.sin(time * 1.7 + index) * 0.08;
      star.current.scale.setScalar(pulse);
    }
    if (dust.current) {
      dust.current.rotation.x = Math.sin(time * 0.32 + index) * 0.18;
      dust.current.position.x = Math.sin(time * 0.45 + index) * 0.04;
    }
  });

  const open = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!dimmed) onOpen(entry);
  };

  return (
    <group ref={group} position={position}>
      <points ref={dust} rotation={[0, 0, angle * 0.18]}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[dustPositions, 3]} /></bufferGeometry>
        <pointsMaterial size={0.025} color={colors[0]} transparent opacity={dimmed ? 0.04 : 0.48} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      <Billboard follow>
        <group ref={star} onClick={open} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          <mesh scale={2.45}><shapeGeometry args={[starShape]} /><meshBasicMaterial color={colors[0]} transparent opacity={dimmed ? 0.025 : hovered ? 0.2 : 0.11} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
          <mesh><shapeGeometry args={[starShape]} /><meshBasicMaterial color={colors[1]} transparent opacity={dimmed ? 0.15 : 0.92} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
          <mesh scale={[0.18, 2.7, 1]}><planeGeometry args={[0.12, 0.12]} /><meshBasicMaterial color={colors[1]} transparent opacity={dimmed ? 0.03 : 0.32} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
          <mesh scale={[2.7, 0.18, 1]}><planeGeometry args={[0.12, 0.12]} /><meshBasicMaterial color={colors[0]} transparent opacity={dimmed ? 0.03 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
          <mesh><circleGeometry args={[0.038, 16]} /><meshBasicMaterial color="#ffffff" transparent opacity={dimmed ? 0.15 : 0.96} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
        </group>
        <mesh scale={2.8} onClick={open} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}><circleGeometry args={[0.13, 16]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      </Billboard>
      <Billboard position={[0, -0.34, 0]} follow><Text fontSize={0.045} anchorX="center" anchorY="middle" color="#fff4fb" outlineWidth={0.003} outlineColor="#100716" fillOpacity={dimmed ? 0.08 : hovered ? 0.92 : 0}>{entry.title}</Text><Text position={[0, -0.085, 0]} fontSize={0.026} anchorX="center" anchorY="middle" color={colors[1]} fillOpacity={dimmed ? 0.04 : hovered ? 0.5 : 0}>{entry.date}</Text></Billboard>
    </group>
  );
}

function CenterMark({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const particleRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const particlePositions = useMemo(() => {
    const arr = new Float32Array(140 * 3);
    for (let i = 0; i < 140; i += 1) {
      const angle = (i / 140) * Math.PI * 2;
      const r = 0.74 + seed(i, 1) * 0.52;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = (seed(i, 2) - 0.5) * 0.42;
      arr[i * 3 + 2] = Math.sin(angle) * r * 0.55;
    }
    return arr;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = -0.08 + Math.sin(t * 0.38) * 0.06;
      group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, dimmed ? 0.78 : 1, 0.04));
    }
    if (particleRef.current) particleRef.current.rotation.y = t * 0.045;
    if (coreRef.current) {
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = dimmed ? 0.08 : 0.22 + Math.sin(t * 1.1) * 0.04;
    }
  });

  return (
    <group ref={group} position={[0, -0.08, -0.25]}>
      <points ref={particleRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.02} color="#ffc0e8" transparent opacity={dimmed ? 0.18 : 0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={coreRef} scale={1.6}>
        <sphereGeometry args={[0.42, 32, 20]} />
        <meshBasicMaterial color="#ff91d7" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[0.95, 0.15, 0]}>
        <torusGeometry args={[1.02, 0.006, 8, 96]} />
        <meshBasicMaterial color="#ffe2f6" transparent opacity={dimmed ? 0.08 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Billboard position={[0, -0.58, 0.14]} follow>
        <Text fontSize={0.17} anchorX="center" anchorY="middle" color="#fff0fb" outlineWidth={0.004} outlineColor="#c06eba" fillOpacity={dimmed ? 0.28 : 0.92}>
          {"\u2764 鑫鑫宇宙"}
        </Text>
        <Text position={[0, -0.2, 0]} fontSize={0.052} anchorX="center" anchorY="middle" color="#ffd9f4" fillOpacity={dimmed ? 0.16 : 0.62}>
          Every Star Is A Memory
        </Text>
      </Billboard>
    </group>
  );
}

function MemoryStarField({
  nodes,
  activeMemoryId,
  arrivedMemoryId,
  onSelectMemory,
  onOpenCollection,
}: {
  nodes: MemoryNode[];
  activeMemoryId: string | null;
  arrivedMemoryId: string | null;
  onSelectMemory: (id: string) => void;
  onOpenCollection?: (memory: MemoryCollection) => void;
}) {
  return (
    <group>
      {nodes.map((node, index) => (
        node.important ? (
          <MemoryPlanetGroup
            key={node.id}
            node={node}
            index={index}
            active={activeMemoryId === node.id}
            arrived={arrivedMemoryId === node.id}
            dimmed={Boolean(activeMemoryId && activeMemoryId !== node.id)}
            onSelectMemory={onSelectMemory}
            onOpenCollection={onOpenCollection}
          />
        ) : (
          <MemoryStar
            key={node.id}
            node={node}
            index={index}
            active={activeMemoryId === node.id}
            dimmed={Boolean(activeMemoryId && activeMemoryId !== node.id)}
            onSelectMemory={onSelectMemory}
            onOpenCollection={onOpenCollection}
          />
        )
      ))}
    </group>
  );
}

function MemoryStar({
  node,
  index,
  active,
  dimmed,
  onSelectMemory,
  onOpenCollection,
}: {
  node: MemoryNode;
  index: number;
  active: boolean;
  dimmed: boolean;
  onSelectMemory: (id: string) => void;
  onOpenCollection?: (memory: MemoryCollection) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const dustRef = useRef<THREE.Points>(null);
  const previewRef = useRef<THREE.Group>(null);
  const texture = useTexture(node.cover ?? "/universe-media/thumbs/001.jpg");
  const colors = THEME_COLORS[node.theme];
  const opacity = dimmed ? 0.18 : 1;

  const localDust = useMemo(() => {
    const count = node.important ? 34 : 18;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = seed(i + index * 10, 1) * Math.PI * 2;
      const r = node.size * (1.4 + seed(i, 2) * 3.2);
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = (seed(i, 3) - 0.5) * node.size * 2.6;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, [index, node.important, node.size]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const targetScale = dimmed ? 0.62 : active ? 1.36 : 1;
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.08));
    group.current.position.y = node.position[1] + Math.sin(t * 0.42 + node.phase) * 0.08;
    group.current.position.z = node.position[2] + (dimmed ? -1.4 : 0);
    group.current.rotation.y = t * 0.05 + node.phase;
    if (haloRef.current) {
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = dimmed ? 0.025 : active ? 0.34 + Math.sin(t * 1.3 + index) * 0.08 : 0.16 + Math.sin(t * 1.1 + index) * 0.06;
    }
    if (ringRef.current) ringRef.current.rotation.z = t * 0.12 + node.phase;
    if (dustRef.current) dustRef.current.rotation.y = t * 0.18;
    if (previewRef.current) {
      previewRef.current.position.x = Math.sin(t * 0.48 + node.phase) * node.size * 0.22;
      previewRef.current.position.y = Math.cos(t * 0.39 + node.phase) * node.size * 0.14;
      previewRef.current.position.z = node.size * (0.12 + Math.sin(t * 0.31 + index) * 0.08);
      previewRef.current.scale.setScalar(1 + Math.sin(t * 0.72 + index) * 0.07);
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (active) onOpenCollection?.(node);
    else onSelectMemory(node.id);
  };

  return (
    <group ref={group} position={node.position}>
      <mesh onClick={handleClick} scale={node.important ? 1.25 : 1}>
        <sphereGeometry args={[node.size * (node.important ? 3.1 : 4.45), 18, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={haloRef} scale={node.important ? 4.2 : 3.4}>
        <sphereGeometry args={[node.size, 20, 14]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh onClick={handleClick} scale={node.important ? 1.25 : 1}>
        <sphereGeometry args={[node.size, 22, 14]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={0.34 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={node.important ? 1.9 : 1.55}>
        <sphereGeometry args={[node.size, 20, 12]} />
        <meshPhysicalMaterial color={colors[2]} transparent opacity={0.13 * opacity} roughness={0.08} transmission={0.36} clearcoat={1} emissive={colors[0]} emissiveIntensity={0.12} depthWrite={false} />
      </mesh>
      <group ref={previewRef} position={[0, 0, node.size * 0.12]}>
        <Billboard follow>
          <mesh onClick={handleClick}>
            <circleGeometry args={[node.size * (node.important ? 0.74 : 0.58), 24]} />
            <meshBasicMaterial map={texture} transparent opacity={(node.important ? 0.22 : 0.12) * opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      </group>
      <Billboard position={[0, 0, node.size * 3.3]} follow>
        <mesh onClick={handleClick}>
          <circleGeometry args={[node.size * (node.important ? 1.72 : 2.35), 32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
      <mesh ref={ringRef} rotation={[0.78, 0.2, node.phase]} scale={node.important ? 1.15 : 1}>
        <torusGeometry args={[node.size * 2.05, node.size * 0.025, 6, 54]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={0.25 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[localDust, 3]} />
        </bufferGeometry>
        <pointsMaterial size={node.important ? 0.022 : 0.016} color={colors[1]} transparent opacity={0.45 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <Billboard position={[0, -node.size * (node.important ? 3.6 : 3.1), 0]} follow>
        <Text fontSize={node.important ? 0.085 : 0.052} anchorX="center" anchorY="middle" color="#fff4fb" outlineWidth={0.003} outlineColor="#100716" fillOpacity={dimmed ? 0.12 : node.important ? 0.86 : 0.5}>
          {node.title}
        </Text>
      </Billboard>
    </group>
  );
}

function YearConstellations({ dimmed }: { dimmed: boolean }) {
  const labels = [
    { year: "2024", name: "闪光日常", position: [5.7, 1.8, -8.4] as [number, number, number] },
    { year: "2025", name: "正在发光", position: [1.2, -3.1, -7.6] as [number, number, number] },
  ];

  return (
    <group>
      {labels.map((label) => (
        <Billboard key={label.year} position={label.position} follow>
          <Text fontSize={0.18} anchorX="center" anchorY="middle" color="#f9e8ff" fillOpacity={dimmed ? 0.12 : 0.34}>
            {label.year}
          </Text>
          <Text position={[0, -0.22, 0]} fontSize={0.064} anchorX="center" anchorY="middle" color="#bfefff" fillOpacity={dimmed ? 0.08 : 0.26}>
            {label.name}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

function SpaceDust({ compact, active, flightRef }: { compact: boolean; active: boolean; flightRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const count = compact ? 820 : 1800;
    const arr = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const arm = index % 5;
      const t = index / count;
      const radius = 0.65 + Math.pow(t, 0.66) * 8.8;
      const angle = radius * 1.32 + arm * (Math.PI / 2.5) + (seed(index, 2) - 0.5) * 0.68;
      arr[index * 3] = Math.cos(angle) * radius;
      arr[index * 3 + 1] = (seed(index, 3) - 0.5) * 1.3;
      arr[index * 3 + 2] = Math.sin(angle) * radius * 0.58 - 1.0;
    }
    return arr;
  }, [compact]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * ((active ? 0.03 : 0.016) + flightRef.current * 0.05);
  });

  return (
    <group ref={group} rotation={[0.12, 0, -0.08]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={compact ? 0.028 : 0.034} color="#ffd7f3" transparent opacity={active ? 0.4 : 0.64} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

function NearParticles({ compact, active, flightRef }: { compact: boolean; active: boolean; flightRef: MutableRefObject<number> }) {
  const points = useRef<THREE.Points>(null);
  const count = compact ? 90 : 170;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (seed(i, 12) - 0.5) * 10;
      arr[i * 3 + 1] = (seed(i, 13) - 0.5) * 7;
      arr[i * 3 + 2] = 1.6 + seed(i, 14) * 4.2;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (!points.current) return;
    const pos = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      const z = pos.getZ(i) + delta * ((active ? 0.82 : 0.28) + flightRef.current * (compact ? 3.6 : 5.4));
      pos.setZ(i, z > 5.8 ? 1.3 : z);
    }
    pos.needsUpdate = true;
    const material = points.current.material as THREE.PointsMaterial;
    material.opacity = 0.16 + flightRef.current * 0.42;
    material.size = (compact ? 0.04 : 0.055) * (1 + flightRef.current * 0.65);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={compact ? 0.04 : 0.055} color="#fff0fb" transparent opacity={active ? 0.34 : 0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function DreamPetals({ compact, flightRef }: { compact: boolean; flightRef: MutableRefObject<number> }) {
  const points = useRef<THREE.Points>(null);
  const count = compact ? 14 : 28;
  const texture = useMemo(createPetalTexture, []);
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      data[index * 3] = (seed(index, 51) - 0.5) * 12;
      data[index * 3 + 1] = (seed(index, 52) - 0.5) * 8;
      data[index * 3 + 2] = 0.8 + seed(index, 53) * 6.8;
    }
    return data;
  }, [count]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state, delta) => {
    if (!points.current) return;
    const attribute = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < count; index += 1) {
      const y = attribute.getY(index) - delta * (0.08 + seed(index, 54) * 0.08 + flightRef.current * 0.62);
      const x = attribute.getX(index) + Math.sin(state.clock.elapsedTime * 0.35 + index) * delta * 0.035;
      attribute.setX(index, x);
      attribute.setY(index, y < -4.2 ? 4.2 : y);
    }
    attribute.needsUpdate = true;
    points.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.035;
    const material = points.current.material as THREE.PointsMaterial;
    material.opacity = 0.16 + flightRef.current * 0.16;
  });

  return (
    <points ref={points}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial map={texture} size={compact ? 0.12 : 0.16} color="#ffd0eb" transparent opacity={0.16} alphaTest={0.015} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function createPetalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(28, 24, 2, 32, 32, 28);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.42, "rgba(255,190,226,0.72)");
    gradient.addColorStop(1, "rgba(255,150,208,0)");
    context.fillStyle = gradient;
    context.save();
    context.translate(32, 32);
    context.rotate(-0.58);
    context.scale(0.62, 1);
    context.beginPath();
    context.arc(0, 0, 27, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function DistantStarClusters({ compact, active }: { compact: boolean; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const count = compact ? 280 : 620;
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3);
    const centers: Array<[number, number, number]> = [[-7.5, 3.4, -14], [7.8, 2.1, -17], [2.2, -5.1, -13.5], [-1.4, 5.8, -20]];
    for (let index = 0; index < count; index += 1) {
      const center = centers[index % centers.length];
      const spread = 0.35 + seed(index, 22) * 2.8;
      const angle = seed(index, 23) * Math.PI * 2;
      data[index * 3] = center[0] + Math.cos(angle) * spread;
      data[index * 3 + 1] = center[1] + Math.sin(angle) * spread * 0.52;
      data[index * 3 + 2] = center[2] + (seed(index, 24) - 0.5) * 3.8;
    }
    return data;
  }, [count]);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.018) * 0.035;
    group.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.014) * 0.018;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial size={compact ? 0.045 : 0.055} color="#f8e9ff" transparent opacity={active ? 0.22 : 0.38} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

function VelocityStreaks({ compact, flightRef }: { compact: boolean; flightRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.LineBasicMaterial>(null);
  const { camera } = useThree();
  const count = compact ? 38 : 72;
  const positions = useMemo(() => {
    const data = new Float32Array(count * 6);
    for (let index = 0; index < count; index += 1) {
      const depth = 1.2 + seed(index, 31) * 7.4;
      const x = (seed(index, 32) - 0.5) * depth * 1.18;
      const y = (seed(index, 33) - 0.5) * depth * 0.72;
      const length = 0.18 + seed(index, 34) * 0.7;
      data[index * 6] = x;
      data[index * 6 + 1] = y;
      data[index * 6 + 2] = -depth;
      data[index * 6 + 3] = x * (1 + length * 0.09);
      data[index * 6 + 4] = y * (1 + length * 0.09);
      data[index * 6 + 5] = -depth + length * 2.8;
    }
    return data;
  }, [count]);

  useFrame(() => {
    if (!group.current || !material.current) return;
    const intensity = flightRef.current;
    group.current.visible = intensity > 0.025;
    group.current.position.copy(camera.position);
    group.current.quaternion.copy(camera.quaternion);
    group.current.scale.z = 0.5 + intensity * 1.28;
    material.current.opacity = intensity * (compact ? 0.32 : 0.44);
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <lineBasicMaterial ref={material} color="#f7e8ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

const NEBULA_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(13.1, 7.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(2.7, 2.0);
    float drift = uTime * 0.018;
    float cloud = fbm(p * 1.18 + vec2(drift, -drift * 0.55));
    float detail = fbm(p * 2.35 - vec2(drift * 0.4, drift));
    float ribbon = 0.5 + 0.5 * sin(p.x * 1.65 + cloud * 4.2 - uTime * 0.025);
    float shape = smoothstep(0.24, 0.92, cloud * 0.74 + detail * 0.28 + ribbon * 0.16);
    float edge = smoothstep(1.15, 0.18, length(p * vec2(0.68, 0.92)));
    float alpha = shape * edge * uOpacity;
    vec3 color = uColor * (0.76 + cloud * 0.72) + vec3(0.12, 0.055, 0.15) * detail;
    gl_FragColor = vec4(color, alpha);
  }
`;

function NebulaClouds({ compact, active, flightRef }: { compact: boolean; active: boolean; flightRef: MutableRefObject<number> }) {
  const layers = useMemo(() => {
    const all = [
      { position: [-2.6, 1.25, -7.5] as [number, number, number], rotation: [0.08, 0.2, -0.24] as [number, number, number], scale: [15.5, 7.4] as [number, number], color: "#ff67c8", opacity: 0.32, phase: 0.2 },
      { position: [5.2, -1.45, -9.8] as [number, number, number], rotation: [-0.12, -0.24, 0.22] as [number, number, number], scale: [14.8, 8.2] as [number, number], color: "#765dff", opacity: 0.3, phase: 1.7 },
      { position: [-1.2, -3.15, -6.2] as [number, number, number], rotation: [0.18, -0.08, -0.38] as [number, number, number], scale: [11.8, 5.8] as [number, number], color: "#58d9ef", opacity: 0.22, phase: 3.1 },
      { position: [2.8, 4.4, -12.6] as [number, number, number], rotation: [-0.18, 0.15, 0.36] as [number, number, number], scale: [16.2, 8.1] as [number, number], color: "#df7cff", opacity: 0.22, phase: 4.4 },
      { position: [-8.4, -0.2, -13.8] as [number, number, number], rotation: [0.05, 0.3, 0.08] as [number, number, number], scale: [14.8, 6.5] as [number, number], color: "#ff9bcf", opacity: 0.19, phase: 5.8 },
    ];
    return compact ? all.slice(0, 3) : all;
  }, [compact]);

  return <group>{layers.map((layer, index) => <NebulaVeil key={index} {...layer} active={active} flightRef={flightRef} />)}</group>;
}

function NebulaVeil({ position, rotation, scale, color, opacity, phase, active, flightRef }: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  color: string;
  opacity: number;
  phase: number;
  active: boolean;
  flightRef: MutableRefObject<number>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(() => createNebulaTexture(phase), [phase]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state, delta) => {
    if (material.current) {
      material.current.opacity = THREE.MathUtils.lerp(material.current.opacity, opacity * (active ? 1.08 : 1) * (1 + flightRef.current * 0.3), 0.04);
    }
    if (mesh.current) {
      mesh.current.rotation.z += delta * (0.0025 + phase * 0.00025);
      mesh.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * 0.035 + phase) * 0.22;
      mesh.current.position.y = position[1] + Math.cos(state.clock.elapsedTime * 0.028 + phase) * 0.16;
    }
  });

  return (
    <mesh ref={mesh} position={position} rotation={rotation} scale={[scale[0], scale[1], 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial ref={material} map={texture} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function createNebulaTexture(phase: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, 256, 256);
    context.globalCompositeOperation = "lighter";
    for (let index = 0; index < 16; index += 1) {
      const angle = seed(index + Math.round(phase * 10), 41) * Math.PI * 2;
      const distance = seed(index, 42) * 68;
      const x = 128 + Math.cos(angle) * distance;
      const y = 128 + Math.sin(angle) * distance * 0.55;
      const radius = 34 + seed(index, 43) * 62;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${0.13 + seed(index, 44) * 0.12})`);
      gradient.addColorStop(0.42, "rgba(255,255,255,0.065)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.save();
      context.translate(x, y);
      context.rotate(angle * 0.28);
      context.scale(1.7, 0.55 + seed(index, 45) * 0.35);
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function ShootingStars({ compact, active }: { compact: boolean; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const count = compact ? 4 : 7;
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: i * 2.7 + seed(i, 7) * 5,
        speed: (active ? 0.65 : 0.38) + seed(i, 3) * 0.35,
        startX: (seed(i, 1) - 0.5) * 16,
        startY: 3 + seed(i, 2) * 4,
        length: compact ? 0.72 : 1.1,
      })),
    [active, compact, count],
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const star = stars[i];
      const cycle = ((t * star.speed + star.phase) % 4) / 4;
      if (cycle < 0.22) {
        const progress = cycle / 0.22;
        child.visible = true;
        child.position.set(star.startX + progress * 4.8, star.startY - progress * 3.4, active ? 0.8 : -2);
        (child as THREE.Mesh).scale.setScalar(1 - progress * 0.5);
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - progress) * (active ? 0.86 : 0.58);
      } else {
        child.visible = false;
      }
    });
  });

  return (
    <group ref={group}>
      {stars.map((star, i) => (
        <mesh key={i} rotation={[0, 0, -0.6]} visible={false}>
          <planeGeometry args={[star.length, 0.02]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function CosmicPulseEvents({ compact, active }: { compact: boolean; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const events = useMemo(() => [
    { position: [-5.6, 2.4, -5.8] as [number, number, number], color: "#ff9ed8", phase: 0.08 },
    { position: [5.1, 1.5, -7.2] as [number, number, number], color: "#9eeaff", phase: 0.46 },
    { position: [1.8, -3.1, -6.4] as [number, number, number], color: "#d6b6ff", phase: 0.76 },
  ], []);

  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((child, index) => {
      const cycle = (state.clock.elapsedTime * (active ? 0.085 : 0.055) + events[index].phase) % 1;
      const visible = cycle < 0.13;
      child.visible = visible;
      if (!visible) return;
      const progress = cycle / 0.13;
      child.scale.setScalar((compact ? 0.45 : 0.62) + progress * (compact ? 2.2 : 3.2));
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(progress * Math.PI) * (active ? 0.24 : 0.16);
    });
  });

  return (
    <group ref={group}>
      {events.map((event, index) => <mesh key={index} position={event.position} visible={false}><ringGeometry args={[0.28, 0.3, 56]} /><meshBasicMaterial color={event.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh>)}
    </group>
  );
}

function ReleaseFlash({ memory }: { memory: MemoryNode | null }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const start = useRef(0);
  const previous = useRef<string | null>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    if (!memory) {
      previous.current = null;
      meshRef.current.visible = false;
      return;
    }
    if (previous.current !== memory.id) {
      previous.current = memory.id;
      start.current = performance.now();
    }
    const progress = THREE.MathUtils.clamp((performance.now() - start.current) / 1200, 0, 1);
    meshRef.current.scale.setScalar(0.4 + progress * 4.4);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.42;
    meshRef.current.visible = progress < 1;
    if (glowRef.current) {
      glowRef.current.scale.setScalar(0.45 + progress * 2.1);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - progress, 2) * 0.2;
      glowRef.current.visible = progress < 1;
    }
  });

  if (!memory) return null;

  return <group position={memory.position}><mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.56, 72]} /><meshBasicMaterial color="#ffcaef" transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh><mesh ref={glowRef}><sphereGeometry args={[0.52, 20, 14]} /><meshBasicMaterial color="#fff0fb" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh></group>;
}

function buildMemoryNodes(manifest: UniverseManifest, compact: boolean, localPlanets: LocalMemoryPlanet[]): MemoryNode[] {
  const bigPositions: Array<[number, number, number]> = [
    [0, 1.6, -1.25],
    [-4.05, -1.45, -0.65],
    [4.05, -1.35, -0.85],
  ];
  const bigNodes: MemoryNode[] = manifest.bigPlanets.map((planet, index) => ({
    id: planet.id,
    title: BIG_PLANET_NAMES[planet.id],
    subtitle: planet.subtitle,
    theme: planet.theme,
    cover: planet.cover,
    items: planet.items,
    position: bigPositions[index],
    size: compact ? 0.2 : 0.24,
    phase: index * 1.7,
    year: index === 0 ? "2025" : index === 1 ? "2024" : "2023",
    important: true,
  }));

  const themes: MemoryTheme[] = ["pink", "cyan", "gold", "purple"];
  const featuredPositions: Array<[number, number, number]> = compact
    ? [[-3.25, 2.45, -1.65], [3.35, 2.35, -1.7], [0, -3.25, -1.45]]
    : [[-5.55, 2.75, -1.85], [5.65, 2.6, -1.9], [0, -4.35, -1.55]];
  const featuredThemes: MemoryTheme[] = ["cyan", "gold", "pink"];
  const featuredPlanets = manifest.smallPlanets.filter((item) => item.id.startsWith("featured-"));
  const featuredNodes: MemoryNode[] = featuredPlanets.map((item, index) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    theme: featuredThemes[index % featuredThemes.length],
    cover: item.cover,
    items: item.items,
    position: featuredPositions[index % featuredPositions.length],
    size: compact ? 0.16 : 0.2,
    phase: 0.8 + index * 1.9,
    year: "2025",
    important: true,
  }));

  const regularSmallPlanets = manifest.smallPlanets.filter((item) => !item.id.startsWith("featured-"));
  const smallNodes: MemoryNode[] = regularSmallPlanets.slice(0, compact ? 18 : 24).map((item, index) => {
    const angle = index * 2.399;
    const radius = (compact ? 3.45 : 4.45) + (index % 8) * (compact ? 0.42 : 0.58);
    const layer = index % 3;
    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      theme: themes[index % themes.length],
      cover: item.cover,
      items: item.items,
      position: [
        Math.cos(angle) * radius,
        ((index * 31) % 100) / 100 * (compact ? 4.0 : 4.8) - (compact ? 2.0 : 2.4),
        Math.sin(angle) * radius * 0.62 - 1.05 - layer * 0.28,
      ],
      size: (compact ? 0.092 : 0.11) + (index % 4) * 0.012,
      phase: angle,
      year: index % 3 === 0 ? "2025" : index % 3 === 1 ? "2024" : "2023",
      important: false,
    };
  });

  const localNodes: MemoryNode[] = localPlanets.map((planet, index) => {
    const angle = Math.PI * 0.22 + index * 1.68;
    const radius = (compact ? 3.15 : 4.15) + Math.floor(index / 4) * 0.72;
    return {
      id: planet.id,
      title: planet.title,
      subtitle: planet.subtitle,
      theme: planet.theme,
      cover: planet.cover,
      items: planet.items,
      position: [Math.cos(angle) * radius, 1.7 - (index % 3) * 1.45, Math.sin(angle) * radius * 0.56 - 0.35],
      size: compact ? 0.14 : 0.17,
      phase: angle,
      year: "2025",
      important: false,
    };
  });

  return [...bigNodes, ...featuredNodes, ...localNodes, ...smallNodes];
}

let flightAudioContext: AudioContext | null = null;

function playFlightAudioCue() {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    flightAudioContext ??= new AudioContext();
    const context = flightAudioContext;
    void context.resume();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(62, now + 2.25);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 2.25);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);
    oscillator.connect(filter).connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 2.4);

    const arrivalTimer = window.setTimeout(() => {
      const chime = context.createOscillator();
      const chimeGain = context.createGain();
      const start = context.currentTime;
      chime.type = "sine";
      chime.frequency.setValueAtTime(620, start);
      chime.frequency.exponentialRampToValueAtTime(880, start + 0.42);
      chimeGain.gain.setValueAtTime(0.0001, start);
      chimeGain.gain.exponentialRampToValueAtTime(0.015, start + 0.06);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);
      chime.connect(chimeGain).connect(context.destination);
      chime.start(start);
      chime.stop(start + 0.74);
    }, 2050);

    return () => window.clearTimeout(arrivalTimer);
  } catch {
    return;
  }
}

function seed(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
