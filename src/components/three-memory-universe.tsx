"use client";

import { Billboard, OrbitControls, PerspectiveCamera, Stars, Text, useTexture, useVideoTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { StarfallGallery } from "@/components/starfall-gallery";

export type UniverseMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  thumb: string | null;
  originalName: string;
};

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

export type UniverseManifest = {
  counts: { total: number; images: number; videos: number; smallGroups: number };
  smallPlanets: SmallMemoryPlanet[];
  bigPlanets: BigMemoryPlanet[];
};

type ThreeMemoryUniverseProps = {
  exploring: boolean;
  onPreview: (media: UniverseMedia) => void;
  onSmallPlanetOpen?: (planet: SmallMemoryPlanet) => void;
  onDetailClose?: () => void;
  detailOpen?: boolean;
};

const THEME_COLORS: Record<BigMemoryPlanet["theme"], [string, string, string]> = {
  pink: ["#ff8bd8", "#ffd7f2", "#6f255f"],
  cyan: ["#8ee7ff", "#dff8ff", "#1f5c6b"],
  gold: ["#ffd18f", "#fff0c8", "#6b4b1e"],
};

export function ThreeMemoryUniverse({ exploring, onPreview, onSmallPlanetOpen, onDetailClose, detailOpen = false }: ThreeMemoryUniverseProps) {
  const [manifest, setManifest] = useState<UniverseManifest | null>(null);
  const [activePlanetId, setActivePlanetId] = useState<BigMemoryPlanet["id"] | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    fetch("/universe-media/manifest.json").then((res) => res.json()).then(setManifest).catch(() => setManifest(null));
  }, []);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 820 || window.matchMedia("(pointer: coarse)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="absolute inset-0 touch-none">
      <Canvas gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0.28, 10.6]} fov={46} />
        <color attach="background" args={["#05020d"]} />
        <fog attach="fog" args={["#11051e", 7, 24]} />
        <ambientLight intensity={1.16} />
        <pointLight position={[0, 0, 0]} color="#ff91d7" intensity={5.2} distance={13} />
        <pointLight position={[-4.8, 3.4, 3.5]} color="#8ee7ff" intensity={3.2} distance={15} />
        <Stars radius={70} depth={42} count={isMobile ? 620 : 1400} factor={isMobile ? 1.8 : 2.35} saturation={0.8} fade speed={0.035} />
        <SpaceDust compact={isMobile} />
        <CameraControls enabled={exploring && !detailOpen} activePlanetId={activePlanetId} />
        <CameraFly activePlanetId={activePlanetId} />
        {manifest ? (
          <SceneContent
            manifest={manifest}
            exploring={exploring}
            activePlanetId={activePlanetId}
            compact={isMobile}
            onSelectPlanet={(id) => {
              setActivePlanetId(id);
            }}
            onSelectSmallPlanet={(id) => {
              const sp = manifest.smallPlanets.find((p) => p.id === id);
              if (sp && onSmallPlanetOpen) {
                onSmallPlanetOpen(sp);
              }
            }}
            onPreview={onPreview}
          />
        ) : null}
      </Canvas>

      {activePlanetId ? (
        <button
          type="button"
          onClick={() => {
            setActivePlanetId(null);
          }}
          className="absolute left-4 top-5 z-20 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs tracking-[0.14em] text-pink-50 backdrop-blur-md active:scale-95"
        >
          返回宇宙
        </button>
      ) : null}
    </div>
  );
}

function CameraControls({ enabled, activePlanetId }: { enabled: boolean; activePlanetId: string | null }) {
  const controls = useRef<OrbitControlsType | null>(null);
  useFrame(() => {
    if (!controls.current) return;
    controls.current.enabled = enabled;
    controls.current.enableZoom = enabled;
    controls.current.target.lerp(activePlanetId ? new THREE.Vector3(0, 0, -0.35) : new THREE.Vector3(0, 0, 0), 0.06);
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={activePlanetId ? 2.8 : 4.2}
      maxDistance={activePlanetId ? 8 : 14}
      rotateSpeed={0.46}
      zoomSpeed={0.58}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    />
  );
}

function CameraFly({ activePlanetId }: { activePlanetId: string | null }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const previousId = useRef<string | null>(activePlanetId);
  const flyUntil = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (previousId.current !== activePlanetId) {
      previousId.current = activePlanetId;
      flyUntil.current = now + 1250;
    }

    if (now > flyUntil.current) return;

    const pos = activePlanetId ? new THREE.Vector3(0, 0.22, 5.35) : new THREE.Vector3(0, 0.28, 10.6);
    const look = activePlanetId ? new THREE.Vector3(0, 0, -0.8) : new THREE.Vector3(0, 0, 0);
    camera.position.lerp(pos, activePlanetId ? 0.055 : 0.045);
    target.current.lerp(look, 0.065);
    camera.lookAt(target.current);
  });
  return null;
}

function SceneContent({
  manifest,
  exploring,
  activePlanetId,
  compact,
  onSelectPlanet,
  onSelectSmallPlanet,
  onPreview,
}: {
  manifest: UniverseManifest;
  exploring: boolean;
  activePlanetId: BigMemoryPlanet["id"] | null;
  compact: boolean;
  onSelectPlanet: (id: BigMemoryPlanet["id"]) => void;
  onSelectSmallPlanet: (id: string) => void;
  onPreview: (media: UniverseMedia) => void;
}) {
  const activePlanet = manifest.bigPlanets.find((planet) => planet.id === activePlanetId) ?? null;

  return (
    <group scale={exploring ? 1 : 0.72}>
      <CenterMark />
      <BigPlanets planets={manifest.bigPlanets} activePlanetId={activePlanetId} onSelectPlanet={onSelectPlanet} />
      <SmallPlanets items={manifest.smallPlanets} hidden={Boolean(activePlanet)} onSelectSmallPlanet={onSelectSmallPlanet} />
      {activePlanet ? <StarfallGallery memory={activePlanet} compact={compact} onPreview={onPreview} visible /> : null}
    </group>
  );
}

function CenterMark() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * 0.06;
  });
  return (
    <group ref={group} position={[0, -0.08, -0.3]}>
      <mesh scale={[3.2, 0.42, 1.25]}>
        <sphereGeometry args={[1, 32, 14]} />
        <meshBasicMaterial color="#e8c7ff" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Text position={[0, -0.48, 0.12]} fontSize={0.15} anchorX="center" anchorY="middle" color="#ffe9f8" outlineWidth={0.006} outlineColor="#ff8bd8">
        ❤ 鑫鑫
      </Text>
    </group>
  );
}

function BigPlanets({
  planets,
  activePlanetId,
  onSelectPlanet,
}: {
  planets: BigMemoryPlanet[];
  activePlanetId: BigMemoryPlanet["id"] | null;
  onSelectPlanet: (id: BigMemoryPlanet["id"]) => void;
}) {
  const positions: Array<[number, number, number]> = [
    [0, 1.0, -0.4],
    [-2.45, -0.75, 0.25],
    [2.45, -0.7, 0.05],
  ];
  return (
    <group>
      {planets.map((planet, index) => (
        <BigPlanet key={planet.id} planet={planet} position={positions[index]} index={index} faded={Boolean(activePlanetId && activePlanetId !== planet.id)} active={false} hidden={activePlanetId === planet.id} onClick={onSelectPlanet} />
      ))}
    </group>
  );
}

function BigPlanet({
  planet,
  position,
  index,
  faded,
  active,
  hidden,
  onClick,
}: {
  planet: BigMemoryPlanet;
  position: [number, number, number];
  index: number;
  faded: boolean;
  active: boolean;
  hidden: boolean;
  onClick: (id: BigMemoryPlanet["id"]) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const cover = useTexture(planet.cover ?? "/universe-media/thumbs/001.jpg");
  const colors = THEME_COLORS[planet.theme];

  useEffect(() => {
    cover.colorSpace = THREE.SRGBColorSpace;
    cover.anisotropy = 8;
    cover.needsUpdate = true;
  }, [cover]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (0.035 + index * 0.008);
    group.current.rotation.z += delta * (0.018 + index * 0.006);
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.85 + index) * 0.025;
    group.current.scale.setScalar((active ? 1.28 : 1) * breath);
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(planet.id);
  };

  return (
    <group ref={group} position={position} visible={!hidden}>
      {/* Core glow sphere */}
      <mesh scale={2.15}>
        <sphereGeometry args={[0.43, 36, 22]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={faded ? 0.03 : 0.17} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Glass planet body */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[0.62, 42, 28]} />
        <meshPhysicalMaterial color={colors[2]} transparent opacity={faded ? 0.045 : 0.2} transmission={0.5} roughness={0.05} clearcoat={1} emissive={colors[0]} emissiveIntensity={0.06} depthWrite={false} />
      </mesh>
      {/* Atmospheric rim glow (Fresnel-like) */}
      <mesh scale={1.35}>
        <sphereGeometry args={[0.62, 42, 28]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={faded ? 0.01 : 0.08} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
      {/* Cover photo */}
      <Billboard position={[0, 0, 0.26]} follow>
        <mesh onClick={handleClick}>
          <circleGeometry args={[0.38, 56]} />
          <meshBasicMaterial map={cover} transparent opacity={faded ? 0.08 : 0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, -0.01]} scale={1.16}>
          <circleGeometry args={[0.38, 56]} />
          <meshBasicMaterial color={colors[0]} transparent opacity={faded ? 0.02 : 0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
      {/* Orbital ring */}
      <mesh rotation={[0.58, 0.18, index * 0.8]}>
        <ringGeometry args={[0.78, 0.8, 92]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={faded ? 0.035 : 0.34} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      {/* Second thinner ring */}
      <mesh rotation={[0.42, -0.1, index * 0.8 + 0.5]} scale={0.88}>
        <ringGeometry args={[0.72, 0.73, 92]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={faded ? 0.02 : 0.18} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, -0.94, 0.22]} fontSize={0.115} anchorX="center" anchorY="middle" color="#fff7ff" outlineWidth={0.006} outlineColor="#251020" fillOpacity={faded ? 0.25 : 1}>
        {planet.title}
      </Text>
      <Text position={[0, -1.1, 0.22]} fontSize={0.045} anchorX="center" anchorY="middle" color="#ffd9f4" fillOpacity={faded ? 0.12 : 0.66}>
        {planet.subtitle}
      </Text>
    </group>
  );
}

function SmallPlanets({ items, hidden, onSelectSmallPlanet }: { items: SmallMemoryPlanet[]; hidden: boolean; onSelectSmallPlanet: (id: string) => void }) {
  const positions = useMemo(
    () =>
      items.map((_, index) => {
        const angle = index * 2.399;
        const radius = 2.15 + (index % 7) * 0.46;
        return {
          position: [Math.cos(angle) * radius, ((index * 31) % 100) / 100 * 3.4 - 1.7, Math.sin(angle) * radius * 0.48 - 0.8] as [number, number, number],
          size: 0.13 + (index % 4) * 0.018,
          phase: angle,
        };
      }),
    [items],
  );

  return (
    <group>
      {items.map((item, index) => (
        <SmallPlanet key={item.id} item={item} placement={positions[index]} hidden={hidden} index={index} onSelectSmallPlanet={onSelectSmallPlanet} />
      ))}
    </group>
  );
}

function SmallPlanet({ item, placement, hidden, index, onSelectSmallPlanet }: { item: SmallMemoryPlanet; placement: { position: [number, number, number]; size: number; phase: number }; hidden: boolean; index: number; onSelectSmallPlanet: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const texture = useTexture(item.cover ?? "/universe-media/thumbs/001.jpg");
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
  }, [texture]);
  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = placement.position[1] + Math.sin(state.clock.elapsedTime * 0.45 + index) * 0.08;
    group.current.rotation.y = state.clock.elapsedTime * 0.08 + placement.phase;
    group.current.rotation.z = state.clock.elapsedTime * 0.035 + placement.phase;
  });
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelectSmallPlanet(item.id);
  };
  return (
    <group ref={group} position={placement.position} scale={hidden ? 0.4 : 1}>
      <mesh scale={1.95}>
        <sphereGeometry args={[placement.size, 16, 10]} />
        <meshBasicMaterial color={index % 3 === 0 ? "#ff8bd8" : index % 3 === 1 ? "#8ee7ff" : "#ffd18f"} transparent opacity={hidden ? 0.02 : 0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh onClick={handleClick}>
        <sphereGeometry args={[placement.size, 18, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={hidden ? 0.03 : 0.16} depthWrite={false} />
      </mesh>
      <Billboard position={[0, 0, placement.size * 0.34]} follow>
        <mesh onClick={handleClick}>
          <circleGeometry args={[placement.size * 0.72, 24]} />
          <meshBasicMaterial map={texture} transparent opacity={hidden ? 0.05 : 0.8} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}

function FloatingMemoryCloud({ memory, compact, onPreview }: { memory: BigMemoryPlanet | SmallMemoryPlanet; compact: boolean; onPreview: (media: UniverseMedia) => void }) {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => memory.items.slice(0, compact ? 14 : 24), [compact, memory.items]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.025;
  });

  return (
    <group ref={group} position={[0, 0, -1.18]}>
      {items.map((item, index) => (
        <MemoryPlane key={item.id} media={item} index={index} total={items.length} onPreview={onPreview} />
      ))}
    </group>
  );
}

function MemoryPlane({ media, index, total, onPreview }: { media: UniverseMedia; index: number; total: number; onPreview: (media: UniverseMedia) => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const columns = 6;
  const col = index % columns;
  const row = Math.floor(index / columns);
  const colOffset = col - (columns - 1) / 2;
  const rowOffset = row - Math.floor((Math.ceil(total / columns) - 1) / 2);
  const curve = Math.sin((col / (columns - 1)) * Math.PI) * 0.42;
  const position: [number, number, number] = [
    colOffset * 0.58,
    -rowOffset * 0.62,
    curve + row * 0.08,
  ];

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.035;
    mesh.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.32 + index) * 0.045;
  });

  if (media.type === "video") return <VideoMemoryPlane media={media} index={index} position={position} onPreview={onPreview} />;
  return <ImageMemoryPlane media={media} index={index} position={position} meshRef={mesh} onPreview={onPreview} total={total} />;
}

function ImageMemoryPlane({ media, index, position, meshRef, onPreview }: { media: UniverseMedia; index: number; position: [number, number, number]; meshRef: React.RefObject<THREE.Mesh | null>; onPreview: (media: UniverseMedia) => void; total: number }) {
  const texture = useTexture(media.thumb ?? media.url);
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);
  useFrame((state) => {
    if (!group.current) return;
    group.current.quaternion.slerp(camera.quaternion, 0.18);
    group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.035;
  });
  return (
    <Billboard ref={group} position={position} follow>
      <mesh scale={[1.08, 1.08, 1]} position={[0, 0, -0.015]}>
        <planeGeometry args={[0.5, 0.66]} />
        <meshBasicMaterial color="#ffbde9" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh
        ref={meshRef}
        onClick={(event) => {
          event.stopPropagation();
          onPreview(media);
        }}
      >
        <planeGeometry args={[0.44, 0.58]} />
        <meshBasicMaterial map={texture} transparent opacity={0.98} side={THREE.DoubleSide} />
      </mesh>
    </Billboard>
  );
}

function VideoMemoryPlane({ media, index, position, onPreview }: { media: UniverseMedia; index: number; position: [number, number, number]; onPreview: (media: UniverseMedia) => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const texture = useVideoTexture(media.url, { muted: true, loop: true, start: index < 10 });
  useFrame((state) => {
    if (mesh.current) mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.035;
    if (group.current) group.current.quaternion.slerp(camera.quaternion, 0.18);
  });
  return (
    <Billboard ref={group} position={position} follow>
      <mesh scale={[1.08, 1.08, 1]} position={[0, 0, -0.015]}>
        <planeGeometry args={[0.52, 0.66]} />
        <meshBasicMaterial color="#8ee7ff" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh
        ref={mesh}
        onClick={(event) => {
          event.stopPropagation();
          onPreview(media);
        }}
      >
        <planeGeometry args={[0.46, 0.58]} />
        <meshBasicMaterial map={texture} transparent opacity={0.94} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, 0, 0.035]} fontSize={0.09} anchorX="center" anchorY="middle" color="#ffffff" outlineWidth={0.004} outlineColor="#1c0f20">
        ▶
      </Text>
    </Billboard>
  );
}

function SpaceDust({ compact }: { compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const count = compact ? 520 : 1200;
    const arr = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const arm = index % 4;
      const t = index / count;
      const radius = 0.55 + Math.pow(t, 0.65) * 7.8;
      const angle = radius * 1.36 + arm * (Math.PI / 2) + (seed(index, 2) - 0.5) * 0.65;
      arr[index * 3] = Math.cos(angle) * radius;
      arr[index * 3 + 1] = (seed(index, 3) - 0.5) * 1.15;
      arr[index * 3 + 2] = Math.sin(angle) * radius * 0.55 - 0.8;
    }
    return arr;
  }, [compact]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.018;
  });

  return (
    <group ref={group} rotation={[0.12, 0, -0.08]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.032} color="#ffd7f3" transparent opacity={0.64} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

function seed(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
