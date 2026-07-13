"use client";

import { Billboard, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type CelestialDeviceMode = "mobile" | "tablet" | "desktop";

type DistantCelestialLayerProps = {
  deviceMode: CelestialDeviceMode;
  active: boolean;
  flightRef: MutableRefObject<number>;
};

const CELESTIAL_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MOON_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uMoon;
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uTime;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float radius = length(centered);
    float sphereMask = 1.0 - smoothstep(0.88, 1.0, radius);
    float halo = (1.0 - smoothstep(0.9, 1.18, radius)) * 0.24;
    vec3 normal = normalize(vec3(centered, sqrt(max(0.001, 1.0 - min(radius * radius, 0.999)))));
    vec3 lightDirection = normalize(vec3(-0.62, 0.28, 0.74));
    float diffuse = smoothstep(-0.24, 0.72, dot(normal, lightDirection));
    float breath = 0.97 + sin(uTime * 0.15) * 0.03;
    vec3 moon = texture2D(uMoon, vUv).rgb;
    moon = mix(moon * vec3(0.08, 0.11, 0.2), moon * uTint, diffuse);
    float rim = pow(1.0 - max(normal.z, 0.0), 2.4) * sphereMask;
    vec3 color = moon * breath + uTint * rim * 0.34 + vec3(0.32, 0.5, 0.82) * halo;
    float alpha = max(sphereMask, halo) * uOpacity;
    if (radius > 1.19 || alpha < 0.012) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

const SUN_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFlight;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    float turbulence = noise(centered * 3.2 + vec2(uTime * 0.035, -uTime * 0.024));
    float coronaEdge = 0.66 + turbulence * 0.12 + sin(angle * 9.0 + uTime * 0.2) * 0.025;
    float core = 1.0 - smoothstep(0.0, 0.48, radius);
    float surface = 1.0 - smoothstep(coronaEdge - 0.12, coronaEdge, radius);
    float corona = (1.0 - smoothstep(coronaEdge, 1.34, radius)) * (0.26 + turbulence * 0.24);
    float flare = pow(max(0.0, 1.0 - radius / 1.55), 3.0) * 0.34;
    vec3 warm = mix(vec3(1.0, 0.36, 0.2), vec3(1.0, 0.78, 0.48), turbulence);
    vec3 color = warm * surface + vec3(1.0, 0.92, 0.76) * core * 1.45 + vec3(1.0, 0.3, 0.2) * corona + vec3(1.0, 0.55, 0.34) * flare;
    float pulse = 0.94 + sin(uTime * 0.34) * 0.06 + uFlight * 0.08;
    float alpha = max(max(surface, corona), flare) * uOpacity * pulse;
    if (radius > 1.28 || alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function DistantCelestialLayer({ deviceMode, active, flightRef }: DistantCelestialLayerProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const time = state.clock.elapsedTime;
    group.current.rotation.z = Math.sin(time * 0.018) * 0.006;
    group.current.position.y = Math.sin(time * 0.026) * 0.06;
  });

  return (
    <group ref={group}>
      <DreamMoon deviceMode={deviceMode} active={active} flightRef={flightRef} />
      <DistantSun deviceMode={deviceMode} active={active} flightRef={flightRef} />
      <RingedSilhouette deviceMode={deviceMode} active={active} />
      {deviceMode !== "mobile" ? <HiddenPlanet deviceMode={deviceMode} active={active} /> : null}
      <CelestialDust deviceMode={deviceMode} active={active} />
    </group>
  );
}

function DreamMoon({ deviceMode, active, flightRef }: DistantCelestialLayerProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();
  const texture = useTexture("/celestial/moon-nasa-1024.jpg");
  const tabletPortrait = deviceMode === "tablet" && size.height > size.width;
  const config = deviceMode === "mobile"
    ? { position: [-4.65, 7.8, -18] as [number, number, number], scale: 2.2 }
    : deviceMode === "tablet"
      ? tabletPortrait
        ? { position: [-5.3, 8, -18] as [number, number, number], scale: 2.5 }
        : { position: [-11.2, 8.2, -18] as [number, number, number], scale: 2.8 }
      : { position: [-14, 7.8, -18] as [number, number, number], scale: 3.6 };
  const uniforms = useMemo(() => ({
    uMoon: { value: texture },
    uTint: { value: new THREE.Color("#cbe6ff") },
    uOpacity: { value: 0.54 },
    uTime: { value: 0 },
  }), [texture]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = deviceMode === "desktop" ? 4 : 2;
    texture.needsUpdate = true;
  }, [deviceMode, texture]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.z = -0.08 + Math.sin(time * 0.024) * 0.012;
      group.current.scale.setScalar(1 + Math.sin(time * 0.09) * 0.008 + flightRef.current * 0.012);
    }
    if (material.current) {
      material.current.uniforms.uTime.value = time;
      material.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
        material.current.uniforms.uOpacity.value,
        active ? 0.24 : deviceMode === "tablet" ? 0.5 : deviceMode === "mobile" ? 0.42 : 0.46,
        3.6,
        delta,
      );
    }
  });

  return (
    <group ref={group} position={config.position} renderOrder={-20}>
      <Billboard follow>
        <mesh scale={config.scale} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial ref={material} uniforms={uniforms} vertexShader={CELESTIAL_VERTEX_SHADER} fragmentShader={MOON_FRAGMENT_SHADER} transparent depthWrite={false} depthTest fog={false} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

function DistantSun({ deviceMode, active, flightRef }: DistantCelestialLayerProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();
  const tabletPortrait = deviceMode === "tablet" && size.height > size.width;
  const config = deviceMode === "mobile"
    ? { position: [4.55, -7.5, -20] as [number, number, number], scale: 2.4 }
    : deviceMode === "tablet"
      ? tabletPortrait
        ? { position: [5.4, -8.5, -20] as [number, number, number], scale: 3 }
        : { position: [13, -8, -20] as [number, number, number], scale: 3.2 }
      : { position: [16.4, -6.4, -20] as [number, number, number], scale: 4.5 };
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0.5 },
    uFlight: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.z = time * 0.006;
      group.current.scale.setScalar(1 + Math.sin(time * 0.12) * 0.012);
    }
    if (material.current) {
      material.current.uniforms.uTime.value = time;
      material.current.uniforms.uFlight.value = flightRef.current;
      material.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
        material.current.uniforms.uOpacity.value,
        active ? 0.14 : deviceMode === "tablet" ? 0.38 : deviceMode === "mobile" ? 0.3 : 0.34,
        3.4,
        delta,
      );
    }
  });

  return (
    <group ref={group} position={config.position} renderOrder={-21}>
      <Billboard follow>
        <mesh scale={config.scale} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial ref={material} uniforms={uniforms} vertexShader={CELESTIAL_VERTEX_SHADER} fragmentShader={SUN_FRAGMENT_SHADER} transparent depthWrite={false} depthTest fog={false} toneMapped={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
    </group>
  );
}

function RingedSilhouette({ deviceMode, active }: Pick<DistantCelestialLayerProps, "deviceMode" | "active">) {
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();
  const tabletPortrait = deviceMode === "tablet" && size.height > size.width;
  const config = deviceMode === "mobile"
    ? { position: [3.8, 3.75, -23] as [number, number, number], scale: 0.62 }
    : deviceMode === "tablet"
      ? tabletPortrait
        ? { position: [4.7, 4.6, -24] as [number, number, number], scale: 0.72 }
        : { position: [7.4, 3.4, -24] as [number, number, number], scale: 0.78 }
      : { position: [9.8, 2.2, -25] as [number, number, number], scale: 1.08 };

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.012;
    group.current.rotation.z = -0.34 + Math.sin(state.clock.elapsedTime * 0.04) * 0.018;
    const targetScale = config.scale * (active ? 0.84 : 1);
    const next = THREE.MathUtils.damp(group.current.scale.x, targetScale, 3.2, delta);
    group.current.scale.setScalar(next);
  });

  return (
    <group ref={group} position={config.position} scale={config.scale} rotation={[0.62, 0.18, -0.34]} renderOrder={-22}>
      <mesh>
        <sphereGeometry args={[0.58, deviceMode === "desktop" ? 32 : 20, deviceMode === "desktop" ? 22 : 14]} />
        <meshBasicMaterial color="#746889" transparent opacity={active ? 0.07 : 0.18} depthWrite={false} fog={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1.28, deviceMode === "desktop" ? 72 : 40]} />
        <meshBasicMaterial color="#d8b7ce" transparent opacity={active ? 0.05 : 0.15} depthWrite={false} side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh scale={1.7}>
        <sphereGeometry args={[0.58, 18, 12]} />
        <meshBasicMaterial color="#bfa8dd" transparent opacity={active ? 0.025 : 0.055} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </mesh>
    </group>
  );
}

function HiddenPlanet({ deviceMode, active }: Pick<DistantCelestialLayerProps, "deviceMode" | "active">) {
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();
  const tabletPortrait = deviceMode === "tablet" && size.height > size.width;
  const position: [number, number, number] = deviceMode === "tablet"
    ? tabletPortrait ? [-4.7, -6.5, -25] : [-8, -5, -25]
    : [-11.2, -3.4, -27];
  const scale = deviceMode === "tablet" ? 0.82 : 1.12;

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.01;
    group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.035) * 0.1;
  });

  return (
    <group ref={group} position={position} scale={scale} renderOrder={-23}>
      <mesh rotation={[0.2, -0.4, 0.1]}>
        <sphereGeometry args={[0.72, deviceMode === "desktop" ? 32 : 20, deviceMode === "desktop" ? 22 : 14]} />
        <meshBasicMaterial color="#284b70" transparent opacity={active ? 0.075 : 0.18} depthWrite={false} fog={false} />
      </mesh>
      <mesh scale={1.65}>
        <sphereGeometry args={[0.72, 18, 12]} />
        <meshBasicMaterial color="#5d9ac2" transparent opacity={active ? 0.018 : 0.045} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </mesh>
    </group>
  );
}

function CelestialDust({ deviceMode, active }: Pick<DistantCelestialLayerProps, "deviceMode" | "active">) {
  const points = useRef<THREE.Points>(null);
  const count = deviceMode === "mobile" ? 34 : deviceMode === "tablet" ? 76 : 132;
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = seeded(index, 30) * Math.PI * 2;
      const radius = 7 + seeded(index, 31) * (deviceMode === "mobile" ? 4 : 9);
      values[index * 3] = Math.cos(angle) * radius;
      values[index * 3 + 1] = Math.sin(angle) * radius * 0.46 + (seeded(index, 32) - 0.5) * 2.2;
      values[index * 3 + 2] = -17 - seeded(index, 33) * 9;
    }
    return values;
  }, [count, deviceMode]);

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.z = state.clock.elapsedTime * 0.0024;
    (points.current.material as THREE.PointsMaterial).opacity = active ? 0.12 : deviceMode === "tablet" ? 0.28 : 0.22;
  });

  return (
    <points ref={points} renderOrder={-24}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={deviceMode === "mobile" ? 0.055 : 0.072} color="#ffd9eb" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} sizeAttenuation />
    </points>
  );
}
