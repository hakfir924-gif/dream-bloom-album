"use client";

import { Billboard, MeshTransmissionMaterial, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { DiaryMood, LocalDiaryEntry } from "@/data/local-memory-store";

const MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

const MOOD_COLORS: Record<DiaryMood, string> = {
  happy: "#ff9fd1",
  calm: "#8ce8ff",
  miss: "#c4a4ff",
  sad: "#83a9e3",
  excited: "#ffd080",
  tired: "#aaa1bd",
};

function seed(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function entryMonth(entry: LocalDiaryEntry) {
  return Number(entry.date.slice(5, 7)) - 1;
}

export function ChroniclePlanet({
  position,
  compact,
  active,
  arrived,
  dimmed,
  entries,
  onSelect,
  onOpenDiary,
}: {
  position: [number, number, number];
  compact: boolean;
  active: boolean;
  arrived: boolean;
  dimmed: boolean;
  entries: LocalDiaryEntry[];
  onSelect: () => void;
  onOpenDiary: (entry: LocalDiaryEntry) => void;
}) {
  const planet = useRef<THREE.Group>(null);
  const cloudShell = useRef<THREE.Mesh>(null);
  const monthOrbit = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Points>(null);
  const [hovered, setHovered] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const year = new Date().getFullYear();
  const radius = compact ? 0.36 : 0.46;

  const monthCounts = useMemo(() => Array.from({ length: 12 }, (_, month) => entries.filter((entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  }).length), [entries, year]);

  const visibleEntries = useMemo(() => entries
    .filter((entry) => entry.date.startsWith(`${year}-${String(selectedMonth + 1).padStart(2, "0")}`))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, compact ? 6 : 9), [compact, entries, selectedMonth, year]);

  const dustPositions = useMemo(() => {
    const count = compact ? 70 : 120;
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = seed(index, 4) * Math.PI * 2;
      const distance = radius * (1.3 + seed(index, 5) * 2.4);
      values[index * 3] = Math.cos(angle) * distance;
      values[index * 3 + 1] = (seed(index, 6) - 0.5) * radius * 3.4;
      values[index * 3 + 2] = Math.sin(angle) * distance * 0.52;
    }
    return values;
  }, [compact, radius]);

  useFrame((state, delta) => {
    if (!planet.current) return;
    const time = state.clock.elapsedTime;
    const targetScale = dimmed ? 0.54 : active ? 1.18 : hovered ? 1.06 : 1;
    const scale = THREE.MathUtils.lerp(planet.current.scale.x, targetScale, 0.07);
    planet.current.scale.setScalar(scale);
    planet.current.position.y = position[1] + Math.sin(time * 0.34 + 1.7) * 0.07;
    planet.current.position.z = THREE.MathUtils.lerp(planet.current.position.z, position[2] + (dimmed ? -2.2 : 0), 0.055);
    if (cloudShell.current) cloudShell.current.rotation.y += delta * 0.055;
    if (dust.current) dust.current.rotation.y -= delta * 0.07;
    if (monthOrbit.current) {
      const orbitScale = arrived ? 1 : active ? 0.52 : 0.34;
      const next = THREE.MathUtils.lerp(monthOrbit.current.scale.x, orbitScale, arrived ? 0.07 : 0.11);
      monthOrbit.current.scale.setScalar(next);
      monthOrbit.current.rotation.z = Math.sin(time * 0.11) * 0.035;
    }
  });

  const selectPlanet = (event: ThreeEvent<MouseEvent>) => {
    if (dimmed || active) return;
    event.stopPropagation();
    onSelect();
  };

  return (
    <group ref={planet} position={position}>
      <mesh scale={1.68}>
        <sphereGeometry args={[radius, 28, 20]} />
        <meshBasicMaterial color="#bdefff" transparent opacity={dimmed ? 0.012 : active ? 0.12 : 0.052} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh position={[0.04, 0.025, -radius * 0.18]} scale={0.58}>
        <sphereGeometry args={[radius, 28, 20]} />
        <meshBasicMaterial color="#fff1c9" transparent opacity={dimmed ? 0.02 : active ? 0.5 : 0.36} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      <mesh position={[-radius * 0.14, radius * 0.12, radius * 0.12]} scale={0.16}>
        <sphereGeometry args={[radius, 20, 14]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={dimmed ? 0.04 : 0.82} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius, 40, 28]} />
        {compact ? (
          <meshPhysicalMaterial color="#d9f5ff" emissive="#75cce8" emissiveIntensity={0.08} transparent opacity={dimmed ? 0.035 : 0.24} roughness={0.14} metalness={0.02} transmission={0.34} thickness={0.22} ior={1.16} clearcoat={0.94} clearcoatRoughness={0.12} depthWrite={false} />
        ) : (
          <MeshTransmissionMaterial color="#dff7ff" transparent opacity={dimmed ? 0.035 : 0.2} samples={2} resolution={96} roughness={0.12} transmission={0.66} thickness={0.28} ior={1.16} chromaticAberration={0.018} anisotropicBlur={0.06} distortion={0.08} distortionScale={0.12} temporalDistortion={0.02} clearcoat={0.96} clearcoatRoughness={0.1} depthWrite={false} />
        )}
      </mesh>

      <mesh ref={cloudShell} rotation={[0.18, 0, -0.12]} scale={0.88}>
        <sphereGeometry args={[radius, 36, 22]} />
        <meshBasicMaterial color="#dff8ff" transparent opacity={dimmed ? 0.012 : 0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh rotation={[1.08, 0.12, -0.26]}>
        <torusGeometry args={[radius * 1.34, radius * 0.012, 7, 96]} />
        <meshBasicMaterial color="#ffe2b8" transparent opacity={dimmed ? 0.03 : 0.38} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <points ref={dust}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[dustPositions, 3]} /></bufferGeometry>
        <pointsMaterial size={compact ? 0.018 : 0.024} color="#d9f8ff" transparent opacity={dimmed ? 0.06 : 0.48} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      <group ref={monthOrbit} visible={!dimmed}>
        {MONTH_NAMES.map((name, month) => {
          const angle = -Math.PI / 2 + month * (Math.PI * 2 / 12);
          const orbitRadius = compact ? 1.12 : 1.36;
          const count = monthCounts[month];
          const selected = selectedMonth === month;
          return (
            <Billboard key={name} position={[Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius * 0.72, Math.sin(angle) * 0.14]} follow>
              <group
                onClick={(event) => { event.stopPropagation(); if (arrived) setSelectedMonth(month); }}
                onPointerOver={() => { if (arrived) document.body.style.cursor = "pointer"; }}
                onPointerOut={() => { document.body.style.cursor = ""; }}
              >
                <mesh scale={selected ? 1.42 : count ? 1.12 : 0.88}>
                  <circleGeometry args={[0.068, 24]} />
                  <meshBasicMaterial color={selected ? "#ffd0a5" : count ? "#bdeeff" : "#7a8aa9"} transparent opacity={arrived ? selected ? 0.94 : count ? 0.72 : 0.28 : 0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
                </mesh>
                {arrived ? <Text position={[0, -0.14, 0]} fontSize={compact ? 0.038 : 0.046} anchorX="center" anchorY="middle" color={selected ? "#fff1dc" : "#e7f8ff"} fillOpacity={selected ? 1 : count ? 0.78 : 0.36}>{name}</Text> : null}
              </group>
            </Billboard>
          );
        })}

        {arrived ? <Billboard position={[0, compact ? 1.62 : 1.92, 0]} follow><Text fontSize={compact ? 0.075 : 0.09} anchorX="center" anchorY="middle" color="#fff4e7">{year} · {MONTH_NAMES[selectedMonth]}</Text></Billboard> : null}

        {arrived && visibleEntries.map((entry, index) => {
          const angle = -Math.PI * 0.82 + (visibleEntries.length === 1 ? 0.82 : index / (visibleEntries.length - 1) * Math.PI * 1.64);
          const orbitRadius = compact ? 0.62 : 2.02;
          const color = MOOD_COLORS[entry.mood];
          return (
            <Billboard key={entry.id} position={[Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius * (compact ? 0.76 : 0.62) - 0.08, compact ? 0.72 : 0.28 + Math.sin(angle) * 0.08]} follow>
              <group
                onClick={(event) => { event.stopPropagation(); onOpenDiary(entry); }}
                onPointerOver={() => { document.body.style.cursor = "pointer"; }}
                onPointerOut={() => { document.body.style.cursor = ""; }}
              >
                <mesh scale={compact ? 1.75 : 2.5}><circleGeometry args={[0.1, 22]} /><meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
                <mesh><circleGeometry args={[0.062, 22]} /><meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
                <Text position={[0, -0.15, 0]} fontSize={compact ? 0.04 : 0.048} anchorX="center" anchorY="middle" color="#fff7fb">{Number(entry.date.slice(8, 10))}日</Text>
                <Text position={[0, -0.25, 0]} fontSize={compact ? 0.026 : 0.032} anchorX="center" anchorY="middle" color="#dcefff" maxWidth={0.62} fillOpacity={0.66}>{entry.title}</Text>
              </group>
            </Billboard>
          );
        })}

        {arrived && visibleEntries.length === 0 ? <Billboard position={[0, -1.65, 0]} follow><Text fontSize={0.045} anchorX="center" anchorY="middle" color="#c8dcf0" fillOpacity={0.56}>这个月还没有写下记忆</Text></Billboard> : null}
      </group>

      <mesh scale={2.8} onClick={selectPlanet} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <sphereGeometry args={[radius, 18, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, -radius * 2.45, 0]} follow>
        <Text fontSize={compact ? 0.06 : 0.075} anchorX="center" anchorY="middle" color="#eefaff" outlineWidth={0.003} outlineColor="#112848" fillOpacity={dimmed ? 0.12 : 0.9}>时序星</Text>
        <Text position={[0, -0.12, 0]} fontSize={compact ? 0.028 : 0.034} anchorX="center" anchorY="middle" color="#ffd9b8" fillOpacity={dimmed ? 0.06 : 0.58}>CHRONICLE PLANET</Text>
      </Billboard>
    </group>
  );
}
