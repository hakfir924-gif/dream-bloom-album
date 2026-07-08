"use client";

import { OrbitControls, PerspectiveCamera, Stars, Text, useTexture, useVideoTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import type { Planet, PlanetMedia } from "@/data/planets";

type AlbumSceneProps = {
  planets: Planet[];
  exploring: boolean;
  focusedPlanetId: string | null;
  panelOpen: boolean;
  onSelectPlanet: (planet: Planet) => void;
  onFocusComplete: () => void;
};

type PlanetPlacement = {
  orbitRadius: number;
  y: number;
  depthScale: number;
  radius: number;
  orbitSpeed: number;
  spinSpeed: number;
  floatSpeed: number;
  phase: number;
};

type FarPlanet = {
  position: [number, number, number];
  radius: number;
  color: string;
  speed: number;
  phase: number;
};

export function AlbumScene({
  planets,
  exploring,
  focusedPlanetId,
  panelOpen,
  onSelectPlanet,
  onFocusComplete,
}: AlbumSceneProps) {
  const [isMobile, setIsMobile] = useState(true);
  const visiblePlanets = useMemo(() => (isMobile ? planets.slice(0, 8) : planets), [isMobile, planets]);
  const placements = useMemo(() => createPlacements(visiblePlanets.length), [visiblePlanets.length]);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 820 || window.matchMedia("(pointer: coarse)").matches);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className={`absolute inset-0 touch-none transition duration-700 ${panelOpen ? "brightness-80" : "brightness-100"}`}>
      <Canvas gl={{ antialias: !isMobile, alpha: true, powerPreference: "high-performance" }} dpr={isMobile ? [0.65, 1] : [1, 1.45]}>
        <PerspectiveCamera makeDefault position={[0, 0.35, 12]} fov={44} />
        <SpaceControls exploring={exploring} focusedPlanetId={focusedPlanetId} panelOpen={panelOpen} />
        <CameraRig
          exploring={exploring}
          focusedPlanetId={focusedPlanetId}
          planets={visiblePlanets}
          placements={placements}
          onFocusComplete={onFocusComplete}
        />
        <color attach="background" args={["#05020d"]} />
        <fog attach="fog" args={["#12051e", 7.5, 25]} />
        <ambientLight intensity={1.24} />
        <pointLight position={[0, 0, 0]} color="#ff91d7" intensity={5.8} distance={11} />
        <pointLight position={[-5, 3.8, 4]} color="#89e7ff" intensity={3.4} distance={17} />
        <pointLight position={[5, -2.8, 5]} color="#ffd28f" intensity={2.8} distance={14} />

        <Stars radius={68} depth={44} count={isMobile ? 420 : 1180} factor={isMobile ? 1.75 : 2.25} saturation={0.78} fade speed={0.04} />
        <NebulaVeils exploring={exploring} compact={isMobile} />
        <GalaxyDust exploring={exploring} compact={isMobile} />
        {!isMobile ? <ShootingStars /> : null}
        {!isMobile ? <YearMarkers /> : null}
        <MemoryUniverse
          planets={visiblePlanets}
          placements={placements}
          exploring={exploring}
          focusedPlanetId={focusedPlanetId}
          compact={isMobile}
          onSelectPlanet={onSelectPlanet}
        />
      </Canvas>
    </div>
  );
}

function SpaceControls({
  exploring,
  focusedPlanetId,
  panelOpen,
}: {
  exploring: boolean;
  focusedPlanetId: string | null;
  panelOpen: boolean;
}) {
  const controls = useRef<OrbitControlsType | null>(null);
  const enabled = exploring && !focusedPlanetId && !panelOpen;

  useFrame(() => {
    if (!controls.current) return;
    controls.current.enabled = enabled;
    controls.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.035);
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.075}
      enablePan={false}
      enableZoom={enabled}
      enableRotate={enabled}
      minDistance={3.8}
      maxDistance={16}
      rotateSpeed={0.48}
      zoomSpeed={0.66}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
    />
  );
}

function CameraRig({
  exploring,
  focusedPlanetId,
  planets,
  placements,
  onFocusComplete,
}: {
  exploring: boolean;
  focusedPlanetId: string | null;
  planets: Planet[];
  placements: PlanetPlacement[];
  onFocusComplete: () => void;
}) {
  const { camera } = useThree();
  const completedFocus = useRef<string | null>(null);
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));
  const introComplete = useRef(false);
  const introStarted = useRef(false);

  useFrame((state) => {
    const intro = new THREE.Vector3(0, 0.34, 12);
    const universe = new THREE.Vector3(0.22, 0.08, 8.2);
    let targetPosition = exploring ? universe : intro;
    let targetLookAt = new THREE.Vector3(0, 0, 0);
    const shouldDriveCamera = !exploring || (exploring && introStarted.current && !introComplete.current) || Boolean(focusedPlanetId);

    if (exploring && !introStarted.current) introStarted.current = true;

    if (focusedPlanetId) {
      const index = planets.findIndex((planet) => planet.id === focusedPlanetId);
      if (index >= 0) {
        const livePosition = getLivePlanetPosition(placements[index], index, state.clock.elapsedTime);
        targetLookAt = livePosition.clone().add(new THREE.Vector3(0.34, 0.02, 0.12));
        targetPosition = livePosition.clone().add(new THREE.Vector3(index % 2 ? -0.2 : 0.2, 0.16, 1.26));
      }
    } else {
      completedFocus.current = null;
    }

    if (shouldDriveCamera) {
      camera.position.lerp(targetPosition, focusedPlanetId ? 0.078 : 0.036);
      lookTarget.current.lerp(targetLookAt, focusedPlanetId ? 0.095 : 0.06);
      camera.lookAt(lookTarget.current);
    }

    if (exploring && !focusedPlanetId && camera.position.distanceTo(universe) < 0.16) introComplete.current = true;
    if (!exploring) {
      introComplete.current = false;
      introStarted.current = false;
    }

    if (focusedPlanetId && completedFocus.current !== focusedPlanetId && camera.position.distanceTo(targetPosition) < 0.48) {
      completedFocus.current = focusedPlanetId;
      onFocusComplete();
    }
  });

  return null;
}

function MemoryUniverse({
  planets,
  placements,
  exploring,
  focusedPlanetId,
  compact,
  onSelectPlanet,
}: {
  planets: Planet[];
  placements: PlanetPlacement[];
  exploring: boolean;
  focusedPlanetId: string | null;
  compact: boolean;
  onSelectPlanet: (planet: Planet) => void;
}) {
  return (
    <group scale={exploring ? 1 : 0.72}>
      <CenterHeart exploring={exploring} />
      {planets.map((planet, index) => (
        <GlassMemoryPlanet
          key={planet.id}
          planet={planet}
          index={index}
          placement={placements[index]}
          disabled={!exploring}
          focused={focusedPlanetId === planet.id}
          faded={Boolean(focusedPlanetId && focusedPlanetId !== planet.id)}
          compact={compact}
          onSelectPlanet={onSelectPlanet}
        />
      ))}
    </group>
  );
}

function GlassMemoryPlanet({
  planet,
  index,
  placement,
  disabled,
  focused,
  faded,
  compact,
  onSelectPlanet,
}: {
  planet: Planet;
  index: number;
  placement: PlanetPlacement;
  disabled: boolean;
  focused: boolean;
  faded: boolean;
  compact: boolean;
  onSelectPlanet: (planet: Planet) => void;
}) {
  const orb = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const texture = useTexture(planet.cover);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = compact ? 1 : 4;
    texture.needsUpdate = true;
  }, [compact, texture]);

  useFrame((state) => {
    if (!orb.current) return;

    const livePosition = getLivePlanetPosition(placement, index, state.clock.elapsedTime);
    orb.current.position.lerp(livePosition, 0.08);
    orb.current.quaternion.slerp(camera.quaternion, 0.16);
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.82 + index * 1.7) * 0.03;
    orb.current.scale.setScalar((focused ? 1.2 : 1) * breath);
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!disabled && !faded) onSelectPlanet(planet);
  };

  return (
    <group ref={orb} position={getLivePlanetPosition(placement, index, 0)}>
      <MemoryAura color={planet.color[0]} radius={placement.radius} faded={disabled || faded} />
      <MemoryCore color={planet.color[1]} radius={placement.radius} seed={index} faded={disabled || faded} />
      <CoverImageInside texture={texture} radius={placement.radius} faded={disabled || faded} />
      <GlassShell planet={planet} radius={placement.radius} faded={disabled || faded} compact={compact} onClick={handleSelect} />
      <OrbitRings planet={planet} radius={placement.radius} seed={index} faded={disabled || faded} compact={compact} onClick={handleSelect} />
      <MemoryFragments planet={planet} radius={placement.radius} seed={index} faded={disabled || faded} compact={compact} />
      <mesh visible={false} onClick={handleSelect}>
        <sphereGeometry args={[placement.radius * 2.4, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {!disabled ? <PlanetLabel planet={planet} radius={placement.radius} faded={faded} compact={compact} /> : null}
    </group>
  );
}

function themeAccent(theme: Planet["theme"], fallback: string) {
  const map: Record<Planet["theme"], string> = {
    birthday: "#ffd166",
    sea: "#8ee7ff",
    graduation: "#fff3c4",
    night: "#d8d4ff",
    daily: "#ffe6f7",
    douyin: "#9befff",
  };
  return map[theme] ?? fallback;
}

function MemoryAura({ color, radius, faded }: { color: string; radius: number; faded: boolean }) {
  return (
    <mesh scale={1.82}>
      <sphereGeometry args={[radius, 32, 20]} />
      <meshBasicMaterial color={color} transparent opacity={faded ? 0.01 : 0.13} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function MemoryCore({ color, radius, seed, faded }: { color: string; radius: number; seed: number; faded: boolean }) {
  const core = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!core.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.35 + seed) * 0.12;
    core.current.scale.setScalar(pulse);
  });

  return (
    <group ref={core} position={[0, 0, -radius * 0.42]}>
      <mesh>
        <sphereGeometry args={[radius * 0.24, 24, 16]} />
        <meshBasicMaterial color={color} transparent opacity={faded ? 0.04 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={[1.22, 1.22, 1]}>
        <ringGeometry args={[radius * 0.48, radius * 0.76, 64]} />
        <meshBasicMaterial color={color} transparent opacity={faded ? 0.035 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CoverImageInside({ texture, radius, faded }: { texture: THREE.Texture; radius: number; faded: boolean }) {
  return (
    <mesh position={[0, 0, radius * 0.1]} scale={0.96} renderOrder={2}>
      <circleGeometry args={[radius * 0.8, 56]} />
      <meshBasicMaterial map={texture} transparent opacity={faded ? 0.12 : 0.78} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function GlassShell({
  planet,
  radius,
  faded,
  compact,
  onClick,
}: {
  planet: Planet;
  radius: number;
  faded: boolean;
  compact: boolean;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <>
      <mesh onClick={onClick}>
        <sphereGeometry args={[radius, compact ? 20 : 36, compact ? 14 : 28]} />
        <meshPhysicalMaterial
          color={planet.color[2]}
          transparent
          opacity={faded ? 0.025 : 0.12}
          roughness={0.06}
          metalness={0}
          transmission={0.58}
          thickness={0.72}
          ior={1.32}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive={planet.color[0]}
          emissiveIntensity={faded ? 0.015 : 0.03}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-radius * 0.22, radius * 0.28, radius * 0.54]} rotation={[0, 0, -0.42]} scale={[0.44, 0.15, 1]}>
        <circleGeometry args={[radius * 0.38, compact ? 14 : 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={faded ? 0.04 : 0.22} depthWrite={false} />
      </mesh>
    </>
  );
}

function OrbitRings({
  planet,
  radius,
  seed,
  faded,
  compact,
  onClick,
}: {
  planet: Planet;
  radius: number;
  seed: number;
  faded: boolean;
  compact: boolean;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const rings = useRef<THREE.Group>(null);
  const accent = themeAccent(planet.theme, planet.color[1]);

  useFrame((_, delta) => {
    if (!rings.current) return;
    rings.current.rotation.z += delta * (0.12 + seed * 0.008);
  });

  return (
    <group ref={rings} rotation={[0.35, 0.15, seed * 0.72]} onClick={onClick}>
      <mesh scale={[1.28, 0.58, 1]}>
        <ringGeometry args={[radius * 1.1, radius * 1.14, compact ? 36 : 80]} />
        <meshBasicMaterial color={accent} transparent opacity={faded ? 0.02 : 0.18} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      {!compact ? (
        <mesh scale={[1.05, 0.48, 1]} rotation={[0, 0, 1.2]}>
          <ringGeometry args={[radius * 1.26, radius * 1.285, 80]} />
          <meshBasicMaterial color={planet.color[0]} transparent opacity={faded ? 0.014 : 0.09} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

function MemoryFragments({ planet, radius, seed, faded, compact }: { planet: Planet; radius: number; seed: number; faded: boolean; compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  const accent = themeAccent(planet.theme, planet.color[1]);
  const count = compact ? 2 + (seed % 2) : 3 + (seed % 5);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * (0.08 + seed * 0.006);
  });

  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, item) => {
        const angle = seed * 0.8 + item * ((Math.PI * 2) / count);
        const distance = radius * (1.32 + (item % 3) * 0.22);
        const isPhoto = item % 4 === 0;
        return (
          <group key={item} position={[Math.cos(angle) * distance, Math.sin(angle) * distance * 0.72, 0.04]}>
            {isPhoto ? (
              <mesh rotation={[0, 0, angle * 0.25]} scale={[1, 1.2, 1]}>
                <planeGeometry args={[radius * 0.18, radius * 0.22]} />
                <meshBasicMaterial color="#fff3fb" transparent opacity={faded ? 0.06 : 0.68} depthWrite={false} />
              </mesh>
            ) : (
              <mesh>
                <sphereGeometry args={[radius * (0.035 + item * 0.004), compact ? 6 : 10, compact ? 5 : 8]} />
                <meshBasicMaterial color={item % 2 ? accent : planet.color[0]} transparent opacity={faded ? 0.04 : 0.58} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            )}
            {planet.theme === "birthday" && item === 1 ? (
              <Text fontSize={radius * 0.16} anchorX="center" anchorY="middle" color="#ffd6ef" fillOpacity={faded ? 0.04 : 0.68}>
                ❤
              </Text>
            ) : null}
            {planet.theme === "douyin" && item === 2 ? (
              <Text fontSize={radius * 0.16} anchorX="center" anchorY="middle" color="#ffffff" fillOpacity={faded ? 0.04 : 0.78}>
                ▶
              </Text>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function PlanetLabel({ planet, radius, faded, compact }: { planet: Planet; radius: number; faded: boolean; compact: boolean }) {
  const plateWidth = Math.max(0.5, planet.title.length * 0.09);

  return (
    <group position={[0, -radius * 2.65, 0.14]}>
      <mesh position={[0, -0.04, -0.018]}>
        <planeGeometry args={[plateWidth, 0.2]} />
        <meshBasicMaterial color="#08050d" transparent opacity={faded ? 0.04 : 0.62} depthWrite={false} />
      </mesh>
      <Text
        fontSize={0.052}
        anchorX="center"
        anchorY="middle"
        color="#ffffff"
        outlineWidth={0.004}
        outlineColor="#2b0f2a"
        fillOpacity={faded ? 0.14 : 1}
        outlineOpacity={faded ? 0.04 : 0.95}
      >
        {planet.title}
      </Text>
      {!compact ? (
        <Text position={[0, -0.08, 0]} fontSize={0.032} anchorX="center" anchorY="middle" color="#ffd9f2" fillOpacity={faded ? 0.08 : 0.56}>
          {`${planet.media.length} Photos`}
        </Text>
      ) : null}
    </group>
  );
}

function MemoryGallery3D({ planet, color, onBack }: { planet: Planet; color: string; onBack: () => void }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const media = useMemo(() => planet.media.slice(0, 9), [planet.media]);

  useFrame((state) => {
    if (!group.current) return;
    group.current.quaternion.slerp(camera.quaternion, 0.1);
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.025;
  });

  return (
    <group ref={group} position={[0.92, 0.1, 0.46]}>
      <Text position={[0, 0.86, 0.02]} fontSize={0.12} anchorX="center" anchorY="middle" color="#fff8ff" outlineWidth={0.006} outlineColor={color}>
        {planet.title}
      </Text>
      <Text position={[0, 0.69, 0.02]} fontSize={0.058} anchorX="center" anchorY="middle" color="#ffd9f2">
        {`${planet.date} · ${planet.location}`}
      </Text>
      {media.map((item, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = (col - 1) * 0.46;
        const y = 0.35 - row * 0.4;
        const z = (row % 2) * -0.08 + (col - 1) * 0.025;
        return <MemoryMediaPlane key={`${item.url}-${index}`} media={item} position={[x, y, z]} index={index} color={color} />;
      })}
      <Text
        position={[0, -0.98, 0.04]}
        fontSize={0.072}
        anchorX="center"
        anchorY="middle"
        color="#ffe6f7"
        outlineWidth={0.004}
        outlineColor="#ff8bd8"
        onClick={(event) => {
          event.stopPropagation();
          onBack();
        }}
      >
        返回宇宙
      </Text>
    </group>
  );
}

function MemoryMediaPlane({
  media,
  position,
  index,
  color,
}: {
  media: PlanetMedia;
  position: [number, number, number];
  index: number;
  color: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = media.type === "video" ? useVideoTexture(media.url) : useTexture(media.url);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.z = Math.sin(state.clock.elapsedTime * 0.7 + index) * 0.018;
    mesh.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.36 + index) * 0.025;
  });

  return (
    <group position={position} rotation={[0.04 * (index % 2 ? 1 : -1), 0.08 * (index % 3 - 1), 0]}>
      <mesh scale={[1.02, 1.02, 1]} position={[0, 0, -0.012]}>
        <planeGeometry args={[0.38, 0.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={mesh}>
        <planeGeometry args={[0.34, 0.46]} />
        <meshBasicMaterial map={texture} transparent opacity={0.98} side={THREE.DoubleSide} />
      </mesh>
      {media.type === "video" ? (
        <Text position={[0, 0, 0.035]} fontSize={0.08} anchorX="center" anchorY="middle" color="#ffffff">
          ▶
        </Text>
      ) : null}
    </group>
  );
}

function TinyMoons({ color, radius, seed, faded }: { color: string; radius: number; seed: number; faded: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.z += delta * (0.18 + seed * 0.018);
  });

  return (
    <group ref={group} rotation={[0, 0, seed * 0.9]}>
      {[0, 1, 2].map((item) => {
        const angle = seed + item * 2.1;
        const distance = radius * (1.44 + item * 0.16);
        return (
          <mesh key={item} position={[Math.cos(angle) * distance, Math.sin(angle) * distance * 0.62, 0.03]}>
            <sphereGeometry args={[radius * (0.045 + item * 0.012), 10, 8]} />
            <meshBasicMaterial color={color} transparent opacity={faded ? 0.025 : 0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
}

function CenterHeart({ exploring }: { exploring: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * 0.08;
    group.current.scale.setScalar((exploring ? 0.76 : 0.86) + Math.sin(state.clock.elapsedTime * 1.12) * 0.035);
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.34, 32, 24]} />
        <meshBasicMaterial color="#fff6ff" transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={[4.8, 1.08, 2.15]} rotation={[0.12, 0, -0.08]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#d9c7ff" transparent opacity={exploring ? 0.09 : 0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Text position={[0, -0.68, 0.1]} fontSize={0.18} anchorX="center" anchorY="middle" color="#ffe9f8" outlineWidth={0.008} outlineColor="#2b0f2a">
        ❤
      </Text>
      <Text position={[0, -0.9, 0.1]} fontSize={0.12} anchorX="center" anchorY="middle" color="#ffffff" outlineWidth={0.005} outlineColor="#2b0f2a">
        鑫鑫
      </Text>
      <Text position={[0, -0.68, 0.08]} fontSize={0.18} anchorX="center" anchorY="middle" color="#ffe9f8" outlineWidth={0.008} outlineColor="#2b0f2a" fillOpacity={0} outlineOpacity={0}>
        ❤
      </Text>
      <Text position={[0, -0.9, 0.08]} fontSize={0.12} anchorX="center" anchorY="middle" color="#ffffff" outlineWidth={0.005} outlineColor="#2b0f2a" fillOpacity={0} outlineOpacity={0}>
        鑫鑫
      </Text>
      <Text position={[0, -0.68, 0.06]} fontSize={0.18} anchorX="center" anchorY="middle" color="#ffe9f8" outlineWidth={0.008} outlineColor="#ff6fc1" fillOpacity={0} outlineOpacity={0}>
        ❤
      </Text>
      <Text position={[0, -0.9, 0.06]} fontSize={0.12} anchorX="center" anchorY="middle" color="#ffffff" outlineWidth={0.005} outlineColor="#ff8bd8" fillOpacity={0} outlineOpacity={0}>
        鑫鑫
      </Text>
    </group>
  );
}

function YearMarkers() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.06;
  });

  return (
    <group ref={group}>
      {[
        { year: "2023", position: [-4.15, 1.15, -2.8] },
        { year: "2024", position: [-1.3, -1.55, -4.6] },
        { year: "2025", position: [2.2, 1.55, -5.8] },
        { year: "2026", position: [4.2, -0.68, -3.6] },
      ].map((item) => (
        <group key={item.year} position={item.position as [number, number, number]}>
          <Text fontSize={0.24} anchorX="center" anchorY="middle" color="#f5f1ff" fillOpacity={0.72} outlineWidth={0.006} outlineColor="#111021">
            {item.year}
          </Text>
          <Text position={[0, -0.22, 0]} fontSize={0.07} anchorX="center" anchorY="middle" color="#d8ccff" fillOpacity={0.48}>
            MEMORY FIELD
          </Text>
        </group>
      ))}
    </group>
  );
}

function FarMemoryPlanets({ exploring }: { exploring: boolean }) {
  const group = useRef<THREE.Group>(null);
  const planets = useMemo<FarPlanet[]>(() => {
    const palette = ["#ff9bd8", "#b698ff", "#89e7ff", "#ffd18f", "#f8d9ff", "#ff7fbf"];
    return Array.from({ length: 58 }, (_, index) => {
      const ring = index % 7;
      const angle = index * 2.399;
      const distance = 4.8 + ring * 0.78 + seeded(index, 1) * 2.1;
      return {
        position: [
          Math.cos(angle) * distance,
          (seeded(index, 2) - 0.5) * 5.6,
          Math.sin(angle) * distance * 0.62 - 1.5 - seeded(index, 3) * 4.5,
        ],
        radius: 0.035 + seeded(index, 4) * 0.07,
        color: palette[index % palette.length],
        speed: 0.015 + seeded(index, 5) * 0.025,
        phase: angle,
      };
    });
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.01;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.025;
  });

  return (
    <group ref={group} scale={exploring ? 1 : 0.78}>
      {planets.map((planet, index) => (
        <FarPlanetDot key={index} planet={planet} index={index} />
      ))}
    </group>
  );
}

function FarPlanetDot({ planet, index }: { planet: FarPlanet; index: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * (0.6 + planet.speed * 8) + planet.phase) * 0.18;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref} position={planet.position}>
      <sphereGeometry args={[planet.radius, 12, 8]} />
      <meshBasicMaterial color={planet.color} transparent opacity={0.52 + (index % 3) * 0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function GalaxyDust({ exploring, compact }: { exploring: boolean; compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { positions, colors } = useMemo(() => {
    const count = compact ? 520 : 1320;
    const positionArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    const pink = new THREE.Color("#ff8bd8");
    const pearl = new THREE.Color("#fff1fb");
    const violet = new THREE.Color("#a991ff");
    const blue = new THREE.Color("#9befff");
    const gold = new THREE.Color("#ffd18f");

    for (let index = 0; index < count; index += 1) {
      const arm = index % 4;
      const t = index / count;
      const radius = 0.5 + Math.pow(t, 0.66) * 8.2;
      const angle = radius * 1.35 + arm * ((Math.PI * 2) / 4) + (seeded(index, 7) - 0.5) * 0.62;
      const spread = (seeded(index, 8) - 0.5) * (0.2 + radius * 0.065);

      positionArray[index * 3] = Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * spread;
      positionArray[index * 3 + 1] = (seeded(index, 9) - 0.5) * 1.05 + Math.sin(radius * 1.2) * 0.12;
      positionArray[index * 3 + 2] = (Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * spread) * 0.56 - 0.6;

      const target = arm === 0 ? pearl : arm === 1 ? violet : arm === 2 ? blue : gold;
      const color = pink.clone().lerp(target, seeded(index, 10) * 0.78);
      colorArray[index * 3] = color.r;
      colorArray[index * 3 + 1] = color.g;
      colorArray[index * 3 + 2] = color.b;
    }

    return { positions: positionArray, colors: colorArray };
  }, [compact]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.022;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.12) * 0.035;
  });

  return (
    <group ref={group} scale={exploring ? 1 : 0.76} rotation={[0.12, 0, -0.1]}>
      <mesh scale={[2.7, 0.24, 1.18]}>
        <sphereGeometry args={[1, 28, 14]} />
        <meshBasicMaterial color="#f0c8ff" transparent opacity={exploring ? 0.028 : 0.022} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.036} vertexColors transparent opacity={exploring ? 0.82 : 0.56} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

function NebulaVeils({ exploring, compact }: { exploring: boolean; compact: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.006;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.16) * 0.08;
  });

  return (
    <group ref={group}>
      {(compact
        ? [
            { position: [-3.8, 1.7, -7.2], scale: [3.4, 0.34, 0.8], color: "#ff9bd8", opacity: 0.02 },
            { position: [0.4, 2.8, -9.4], scale: [5.2, 0.42, 0.92], color: "#b99bff", opacity: 0.02 },
          ]
        : [
        { position: [-3.8, 1.7, -7.2], scale: [3.4, 0.34, 0.8], color: "#ff9bd8", opacity: 0.026 },
        { position: [3.4, -1.3, -6.5], scale: [3.1, 0.3, 0.78], color: "#8feaff", opacity: 0.022 },
        { position: [0.4, 2.8, -9.4], scale: [5.2, 0.42, 0.92], color: "#b99bff", opacity: 0.025 },
        { position: [-0.9, -2.8, -8.4], scale: [4.2, 0.28, 0.82], color: "#ffd18f", opacity: 0.018 },
          ]).map((veil) => (
        <mesh key={veil.color} position={veil.position as [number, number, number]} scale={veil.scale as [number, number, number]}>
          <sphereGeometry args={[1, compact ? 14 : 24, compact ? 8 : 12]} />
          <meshBasicMaterial color={veil.color} transparent opacity={exploring ? veil.opacity : veil.opacity * 0.72} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function ShootingStars() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((child, index) => {
      const cycle = (state.clock.elapsedTime * 0.12 + index * 0.34) % 1;
      child.position.x = -7 + cycle * 14;
      child.position.y = 3.6 - cycle * 3.8 + index * 0.52;
      child.position.z = -8 - index * 1.2;
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} rotation={[0, 0, -0.56]} scale={[0.8 + index * 0.18, 0.018, 1]}>
          <planeGeometry args={[1.8, 1]} />
          <meshBasicMaterial color={index === 1 ? "#ffb7e7" : "#dfefff"} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function getLivePlanetPosition(placement: PlanetPlacement, index: number, time: number) {
  const angle = placement.phase + time * placement.orbitSpeed;
  const drift = Math.sin(time * placement.floatSpeed + index) * 0.08;
  return new THREE.Vector3(
    Math.cos(angle) * placement.orbitRadius + drift,
    placement.y + Math.sin(time * (placement.floatSpeed * 0.72) + index) * 0.16,
    Math.sin(angle) * placement.orbitRadius * placement.depthScale,
  );
}

function createPlacements(count: number): PlanetPlacement[] {
  return Array.from({ length: count }, (_, index) => {
    const ring = index % 6;
    const phase = index * 2.399 + (index % 3) * 0.22;
    const orbitRadius = 1.65 + ring * 0.58 + Math.floor(index / 6) * 0.34;
    return {
      orbitRadius,
      y: ((index * 37) % 100) / 100 * 3.6 - 1.8,
      depthScale: 0.48 + (index % 4) * 0.055,
      radius: 0.105 + (index % 5) * 0.018,
      orbitSpeed: 0.018 + (index % 5) * 0.003,
      spinSpeed: 0.06 + (index % 5) * 0.014,
      floatSpeed: 0.075 + (index % 4) * 0.012,
      phase,
    };
  });
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
