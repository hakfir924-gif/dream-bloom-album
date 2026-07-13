"use client";

import { Billboard, MeshTransmissionMaterial, Text, Trail } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { MemoryNode, MemoryTheme } from "@/components/three-memory-universe";
import { DynamicMemoryCoverMaterial, memoryCoverSources } from "@/components/dynamic-memory-cover";

const THEME_COLORS: Record<MemoryTheme, [string, string, string]> = {
  pink: ["#ff8bd8", "#ffe2f6", "#6f295f"],
  cyan: ["#82e6ff", "#e6fbff", "#1a6071"],
  gold: ["#ffd18f", "#fff2ce", "#765022"],
  purple: ["#c6a5ff", "#f1eaff", "#42256d"],
};

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  uniform float uOpacity;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.35);
    float shimmer = 0.82 + sin(vWorldPosition.y * 18.0 + uTime * 0.75) * 0.18;
    vec3 color = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vWorldPosition.y * 8.0 + uTime * 0.22));
    gl_FragColor = vec4(color, rim * shimmer * uOpacity);
  }
`;

function seed(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function MemoryPlanetGroup({
  node,
  index,
  active,
  arrived,
  dimmed,
  onSelectMemory,
  onOpenCollection,
}: {
  node: MemoryNode;
  index: number;
  active: boolean;
  arrived: boolean;
  dimmed: boolean;
  onSelectMemory: (id: string) => void;
  onOpenCollection?: (memory: MemoryNode) => void;
}) {
  const planet = useRef<THREE.Group>(null);
  const shell = useRef<THREE.MeshPhysicalMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { size } = useThree();
  const compact = size.width < 820;
  const radius = node.size * 2.12;
  const colors = THEME_COLORS[node.theme];
  const coverSources = useMemo(() => memoryCoverSources(node.cover, node.items, compact ? 2 : 3), [compact, node.cover, node.items]);

  useFrame((state, delta) => {
    if (!planet.current) return;
    const t = state.clock.elapsedTime;
    const float = Math.sin(t * 0.42 + node.phase) * 0.075;
    const desiredScale = dimmed ? 0.5 : active ? (arrived ? 1.2 : 1.14) : hovered ? 1.06 : 1;
    planet.current.position.y = node.position[1] + float;
    planet.current.position.z = THREE.MathUtils.lerp(planet.current.position.z, node.position[2] + (dimmed ? -2.1 : 0), 0.055);
    const nextScale = THREE.MathUtils.lerp(planet.current.scale.x, desiredScale, 0.075);
    planet.current.scale.setScalar(nextScale);

    if (ringA.current) ringA.current.rotation.z += delta * 0.16;
    if (shell.current) shell.current.opacity = THREE.MathUtils.lerp(shell.current.opacity, dimmed ? 0.02 : active ? 0.22 : hovered ? 0.19 : 0.13, 0.07);
    if (halo.current) halo.current.opacity = THREE.MathUtils.lerp(halo.current.opacity, dimmed ? 0.01 : active ? 0.16 : hovered ? 0.13 : 0.075, 0.07);
  });

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (dimmed) return;
    if (active && arrived) onOpenCollection?.(node);
    else onSelectMemory(node.id);
  };

  const enter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (dimmed) return;
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const leave = () => {
    setHovered(false);
    document.body.style.cursor = "";
  };

  return (
    <group ref={planet} position={node.position}>
      <mesh scale={1.58}>
        <sphereGeometry args={[radius, 28, 18]} />
        <meshBasicMaterial ref={halo} color={colors[0]} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <MemoryCore radius={radius} colors={colors} active={active || hovered} />
      <InnerMemoryMist radius={radius} colors={colors} index={index} dimmed={dimmed} />
      <PlanetCloudBands radius={radius} colors={colors} index={index} dimmed={dimmed} />
      <InnerCover sources={coverSources} radius={radius} colors={colors} dimmed={dimmed} active={active} arrived={arrived} phase={node.phase} onOpen={onOpenCollection ? () => onOpenCollection(node) : undefined} />

      <mesh>
        <sphereGeometry args={[radius, 32, 20]} />
        {node.important && !compact ? (
          <MeshTransmissionMaterial
            ref={(material) => { shell.current = material as THREE.MeshPhysicalMaterial | null; }}
            color={colors[1]}
            transparent
            opacity={0.13}
            samples={2}
            resolution={128}
            roughness={0.14}
            transmission={0.72}
            thickness={0.34}
            ior={1.18}
            chromaticAberration={0.025}
            anisotropicBlur={0.08}
            distortion={0.12}
            distortionScale={0.18}
            temporalDistortion={0.035}
            clearcoat={0.92}
            clearcoatRoughness={0.14}
            depthWrite={false}
          />
        ) : (
          <meshPhysicalMaterial
            ref={shell}
            color={colors[1]}
            transparent
            opacity={0.13}
            roughness={0.16}
            metalness={0.02}
            transmission={0.28}
            thickness={0.24}
            ior={1.16}
            clearcoat={0.95}
            clearcoatRoughness={0.12}
            depthWrite={false}
          />
        )}
      </mesh>

      <DreamAtmosphere radius={radius} colors={colors} dimmed={dimmed} active={active || hovered} />

      <mesh ref={ringA} rotation={[0.76, 0.18, node.phase]}>
        <torusGeometry args={[radius * 1.48, radius * 0.018, 7, 96]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={dimmed ? 0.04 : 0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {node.important ? <PlanetCometTrail radius={radius} colors={colors} phase={node.phase} dimmed={dimmed} /> : <CometTrail radius={radius} colors={colors} phase={node.phase} dimmed={dimmed} />}

      <MemoryFragments radius={radius} colors={colors} index={index} dimmed={dimmed} />

      <mesh onClick={select} onPointerOver={enter} onPointerOut={leave} scale={1.72}>
        <sphereGeometry args={[radius, 18, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, -radius * 2.25, 0]} follow>
        <Text
          fontSize={0.09}
          anchorX="center"
          anchorY="middle"
          color="#fff5fc"
          outlineWidth={0.004}
          outlineColor="#160813"
          fillOpacity={dimmed ? 0.12 : hovered || active ? 1 : 0.82}
        >
          {node.title}
        </Text>
        <Text position={[0, -0.14, 0]} fontSize={0.042} anchorX="center" anchorY="middle" color={colors[1]} fillOpacity={dimmed ? 0.07 : 0.56}>
          {node.subtitle}
        </Text>
      </Billboard>
    </group>
  );
}

function DreamAtmosphere({ radius, colors, dimmed, active }: { radius: number; colors: [string, string, string]; dimmed: boolean; active: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uColorA: { value: new THREE.Color(colors[0]) },
    uColorB: { value: new THREE.Color(colors[1]) },
    uTime: { value: 0 },
    uOpacity: { value: 0.74 },
  }), [colors]);

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    const target = dimmed ? 0.08 : active ? 1.0 : 0.72;
    material.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(material.current.uniforms.uOpacity.value, target, 0.06);
  });

  return (
    <mesh scale={1.08}>
      <sphereGeometry args={[radius, 28, 20]} />
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={ATMOSPHERE_VERTEX_SHADER} fragmentShader={ATMOSPHERE_FRAGMENT_SHADER} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.FrontSide} />
    </mesh>
  );
}

function InnerMemoryMist({ radius, colors, index, dimmed }: { radius: number; colors: [string, string, string]; index: number; dimmed: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 42;
    const data = new Float32Array(count * 3);
    for (let item = 0; item < count; item += 1) {
      const angle = seed(index * 100 + item, 14) * Math.PI * 2;
      const polar = Math.acos(2 * seed(item, 15) - 1);
      const distance = radius * (0.18 + seed(item, 16) * 0.62);
      data[item * 3] = Math.sin(polar) * Math.cos(angle) * distance;
      data[item * 3 + 1] = Math.cos(polar) * distance;
      data[item * 3 + 2] = Math.sin(polar) * Math.sin(angle) * distance;
    }
    return data;
  }, [index, radius]);

  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.16;
    points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22 + index) * 0.16;
    const material = points.current.material as THREE.PointsMaterial;
    material.opacity = dimmed ? 0.05 : 0.42 + Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.1;
  });

  return (
    <points ref={points}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={radius * 0.08} color={colors[1]} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function MemoryCore({ radius, colors, active }: { radius: number; colors: [string, string, string]; active: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.05) * 0.075 + (active ? 0.08 : 0);
    group.current.scale.setScalar(pulse);
    group.current.rotation.y = state.clock.elapsedTime * 0.09;
  });

  return (
    <group ref={group} position={[0, 0, -radius * 0.18]}>
      <mesh scale={[1.22, 0.96, 1]}>
        <sphereGeometry args={[radius * 0.5, 24, 16]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={active ? 0.24 : 0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 0.27, 22, 16]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={active ? 0.38 : 0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function PlanetCloudBands({ radius, colors, index, dimmed }: { radius: number; colors: [string, string, string]; index: number; dimmed: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 118;
    const values = new Float32Array(count * 3);
    for (let item = 0; item < count; item += 1) {
      const band = item % 4;
      const angle = item / count * Math.PI * 8 + seed(item + index * 9, 24) * 0.18;
      const latitude = (band - 1.5) * radius * 0.24 + (seed(item, 25) - 0.5) * radius * 0.1;
      const ringRadius = Math.sqrt(Math.max(0.01, radius * radius * 0.72 - latitude * latitude));
      values[item * 3] = Math.cos(angle) * ringRadius;
      values[item * 3 + 1] = latitude;
      values[item * 3 + 2] = Math.sin(angle) * ringRadius;
    }
    return values;
  }, [index, radius]);

  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.055;
    points.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.13 + index) * 0.12;
  });

  return (
    <points ref={points} rotation={[0.08, 0, -0.12]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={radius * 0.07} color={colors[1]} transparent opacity={dimmed ? 0.025 : 0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function PlanetCometTrail({ radius, colors, phase, dimmed }: { radius: number; colors: [string, string, string]; phase: number; dimmed: boolean }) {
  const orbit = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!orbit.current) return;
    orbit.current.rotation.z += delta * 0.18;
    orbit.current.rotation.x = 0.68 + Math.sin(state.clock.elapsedTime * 0.12 + phase) * 0.08;
  });

  return (
    <group ref={orbit} rotation={[0.68, 0.24, phase]}>
      <Trail
        width={radius * 0.18}
        length={compactTrailLength(radius)}
        decay={1.35}
        color={colors[1]}
        attenuation={(value) => value * value}
      >
        <mesh position={[radius * 1.72, 0, 0]}>
          <sphereGeometry args={[radius * 0.05, 12, 8]} />
          <meshBasicMaterial color="#fff7ed" transparent opacity={dimmed ? 0.05 : 0.92} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Trail>
    </group>
  );
}

function compactTrailLength(radius: number) {
  return Math.max(3, Math.round(5 + radius * 4));
}

function CometTrail({ radius, colors, phase, dimmed }: { radius: number; colors: [string, string, string]; phase: number; dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const curve = useMemo(() => {
    const points = Array.from({ length: 13 }, (_, index) => {
      const angle = -0.72 + index / 12 * Math.PI * 1.52;
      return new THREE.Vector3(Math.cos(angle) * radius * 1.82, Math.sin(angle) * radius * 0.72, Math.sin(angle + phase) * radius * 0.35);
    });
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.42);
  }, [phase, radius]);
  const head = useMemo(() => curve.getPoint(0.98), [curve]);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.12 + phase) * 0.08;
  });

  return (
    <group ref={group} rotation={[0.48, -0.2, phase * 0.22]}>
      <mesh>
        <tubeGeometry args={[curve, 72, radius * 0.012, 6, false]} />
        <meshBasicMaterial color={colors[1]} transparent opacity={dimmed ? 0.03 : 0.34} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={head}>
        <sphereGeometry args={[radius * 0.055, 14, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={dimmed ? 0.06 : 0.92} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function InnerCover({ sources, radius, colors, dimmed, active, arrived, phase, onOpen }: { sources: string[]; radius: number; colors: [string, string, string]; dimmed: boolean; active: boolean; arrived: boolean; phase: number; onOpen?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!group.current) return;
    group.current.quaternion.copy(camera.quaternion);
    group.current.rotateZ(-0.05);
  });

  return (
    <group ref={group} position={[0.01, 0.01, radius * 0.48]}>
      <mesh scale={[1.28, 1.48, 1]}>
        <circleGeometry args={[radius * 0.62, 64]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={dimmed ? 0.015 : active ? 0.16 : 0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0, radius * 0.026]} scale={[1, 1.18, 1]} onClick={(event) => { if (!arrived || !onOpen) return; event.stopPropagation(); onOpen(); }}>
        <circleGeometry args={[radius * 0.56, 64]} />
        <DynamicMemoryCoverMaterial
          sources={sources}
          tint={colors[0]}
          opacity={dimmed ? 0.025 : active ? 0.62 : 0.28}
          active={active}
          phase={phase}
        />
      </mesh>
    </group>
  );
}

function MemoryFragments({
  radius,
  colors,
  index,
  dimmed,
}: {
  radius: number;
  colors: [string, string, string];
  index: number;
  dimmed: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const dust = useMemo(() => {
    const count = 36;
    const positions = new Float32Array(count * 3);
    for (let item = 0; item < count; item += 1) {
      const angle = seed(index * 10 + item, 1) * Math.PI * 2;
      const distance = radius * (1.5 + seed(item, 2) * 1.75);
      positions[item * 3] = Math.cos(angle) * distance;
      positions[item * 3 + 1] = (seed(item, 3) - 0.5) * radius * 2.7;
      positions[item * 3 + 2] = Math.sin(angle) * distance * 0.68;
    }
    return positions;
  }, [index, radius]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.22;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18 + index) * 0.08;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dust, 3]} />
        </bufferGeometry>
        <pointsMaterial size={radius * 0.12} color={colors[1]} transparent opacity={dimmed ? 0.08 : 0.58} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {[0, 1, 2, 3].map((item) => {
        const angle = index * 0.8 + item * (Math.PI / 2);
        const distance = radius * (1.65 + (item % 2) * 0.22);
        return (
          <mesh key={item} position={[Math.cos(angle) * distance, Math.sin(angle * 1.7) * radius * 0.76, Math.sin(angle) * distance * 0.46]}>
            <sphereGeometry args={[radius * (0.075 + item * 0.012), 10, 8]} />
            <meshBasicMaterial color={item % 2 ? colors[0] : colors[1]} transparent opacity={dimmed ? 0.08 : 0.64} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
}
