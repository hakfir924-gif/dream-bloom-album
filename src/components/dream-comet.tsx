"use client";

import { Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { CelestialDeviceMode } from "@/components/distant-celestial-layer";

type DreamCometProps = {
  deviceMode: CelestialDeviceMode;
  enabled: boolean;
  active: boolean;
  intensityRef: MutableRefObject<number>;
};

const TAIL_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TAIL_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform float uTime;
  void main() {
    float distanceFromCenter = abs(vUv.y - 0.5) * 2.0;
    float width = mix(0.025, 0.7, pow(vUv.x, 1.3));
    float body = 1.0 - smoothstep(width * 0.52, width, distanceFromCenter);
    float filament = 1.0 - smoothstep(0.02, 0.12, distanceFromCenter);
    float lengthFade = smoothstep(0.0, 0.14, vUv.x) * pow(vUv.x, 1.45);
    float shimmer = 0.92 + sin(vUv.x * 24.0 - uTime * 1.6) * 0.08;
    vec3 color = mix(vec3(1.0, 0.32, 0.66), vec3(0.58, 0.9, 1.0), pow(vUv.x, 0.72));
    float alpha = (body * 0.62 + filament * 0.46) * lengthFade * shimmer * uOpacity;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function DreamComet({ deviceMode, enabled, active, intensityRef }: DreamCometProps) {
  const mover = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Points>(null);
  const tail = useRef<THREE.Mesh>(null);
  const tailMaterial = useRef<THREE.ShaderMaterial>(null);
  const fragments = useRef<THREE.Points>(null);
  const secondCore = useRef<THREE.Mesh>(null);
  const coreMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const dustMaterial = useRef<THREE.PointsMaterial>(null);
  const fragmentMaterial = useRef<THREE.PointsMaterial>(null);
  const period = deviceMode === "mobile" ? 32 : deviceMode === "tablet" ? 29 : 26;
  const duration = deviceMode === "mobile" ? 5.4 : deviceMode === "tablet" ? 6.1 : 6.6;
  const firstDelay = 2.4;
  const dustCount = deviceMode === "mobile" ? 6 : deviceMode === "tablet" ? 12 : 18;
  const fragmentCount = deviceMode === "mobile" ? 8 : deviceMode === "tablet" ? 14 : 20;
  const curve = useMemo(() => {
    const points = deviceMode === "mobile"
      ? [new THREE.Vector3(-4.6, 5.2, -8.5), new THREE.Vector3(-2.1, 4.8, -9.2), new THREE.Vector3(1.2, 3.4, -10.2), new THREE.Vector3(4.5, 1.4, -11.2)]
      : deviceMode === "tablet"
        ? [new THREE.Vector3(-7.8, 5.8, -8.6), new THREE.Vector3(-3.7, 5.3, -9.3), new THREE.Vector3(2.5, 3.5, -10.5), new THREE.Vector3(8, 0.7, -11.8)]
        : [new THREE.Vector3(-11, 6.1, -8.6), new THREE.Vector3(-5.1, 5.7, -9.4), new THREE.Vector3(3, 3.6, -10.7), new THREE.Vector3(11, 0.3, -12.2)];
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.52);
  }, [deviceMode]);
  const dustSeeds = useMemo(() => Array.from({ length: dustCount }, (_, index) => ({
    side: seeded(index, 11) - 0.5,
    lift: seeded(index, 12) - 0.5,
    depth: seeded(index, 13) - 0.5,
    size: 0.72 + seeded(index, 14) * 0.58,
  })), [dustCount]);
  const dustPositions = useMemo(() => new Float32Array(dustCount * 3), [dustCount]);
  const fragmentPositions = useMemo(() => {
    const values = new Float32Array(fragmentCount * 3);
    for (let index = 0; index < fragmentCount; index += 1) {
      const angle = seeded(index, 21) * Math.PI * 2;
      const distance = 0.12 + seeded(index, 22) * (deviceMode === "mobile" ? 0.42 : 0.68);
      values[index * 3] = -0.08 - seeded(index, 23) * 0.46;
      values[index * 3 + 1] = Math.cos(angle) * distance;
      values[index * 3 + 2] = Math.sin(angle) * distance;
    }
    return values;
  }, [deviceMode, fragmentCount]);
  const position = useRef(new THREE.Vector3());
  const tangent = useRef(new THREE.Vector3());
  const enabledAt = useRef<number | null>(null);
  const tailUniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    if (!mover.current) return;
    const time = state.clock.elapsedTime;
    if (!enabled) {
      enabledAt.current = null;
      mover.current.visible = false;
      intensityRef.current = THREE.MathUtils.lerp(intensityRef.current, 0, 0.12);
      return;
    }
    if (enabledAt.current === null) enabledAt.current = time;
    const elapsed = time - enabledAt.current;
    const localTime = ((elapsed - firstDelay) % period + period) % period;
    const visible = elapsed >= firstDelay && localTime < duration;
    mover.current.visible = visible;
    if (!visible) {
      intensityRef.current = THREE.MathUtils.lerp(intensityRef.current, 0, 0.12);
      return;
    }

    const progress = THREE.MathUtils.clamp(localTime / duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    curve.getPoint(eased, position.current);
    curve.getTangent(eased, tangent.current).normalize();
    mover.current.position.copy(position.current);
    mover.current.rotation.z = -0.1 + Math.sin(time * 0.52) * 0.025;
    const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.08);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.82, 1);
    const visibility = fadeIn * fadeOut * (active ? 0.34 : 1);
    intensityRef.current = Math.sin(progress * Math.PI) * visibility;

    if (tail.current) {
      const tailLength = deviceMode === "mobile" ? 2.9 : deviceMode === "tablet" ? 4.2 : 5.4;
      const tailWidth = deviceMode === "mobile" ? 0.5 : deviceMode === "tablet" ? 0.72 : 0.92;
      tail.current.position.copy(tangent.current).multiplyScalar(-tailLength * 0.5);
      tail.current.rotation.z = Math.atan2(tangent.current.y, tangent.current.x);
      tail.current.scale.set(tailLength, tailWidth, 1);
    }
    if (tailMaterial.current) {
      tailMaterial.current.uniforms.uTime.value = time;
      tailMaterial.current.uniforms.uOpacity.value = visibility * 0.82;
    }

    const dustAttribute = dust.current?.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (dustAttribute) {
      const tailLength = deviceMode === "mobile" ? 2.2 : deviceMode === "tablet" ? 3.5 : 4.6;
      dustSeeds.forEach((item, index) => {
        const ratio = (index + 1) / dustCount;
        const spread = 0.04 + ratio * (deviceMode === "mobile" ? 0.22 : 0.38);
        const shimmer = Math.sin(time * (0.9 + item.size * 0.25) + index) * 0.04;
        dustAttribute.setXYZ(
          index,
          -tangent.current.x * ratio * tailLength + item.depth * spread,
          -tangent.current.y * ratio * tailLength + item.side * spread + shimmer,
          -tangent.current.z * ratio * tailLength + item.lift * spread,
        );
      });
      dustAttribute.needsUpdate = true;
    }

    const split = THREE.MathUtils.smoothstep(progress, 0.44, 0.66);
    if (secondCore.current) {
      secondCore.current.visible = split > 0.01;
      secondCore.current.position.set(-split * 0.28, split * (deviceMode === "mobile" ? 0.3 : deviceMode === "tablet" ? 0.48 : 0.58), -split * 0.12);
      secondCore.current.scale.setScalar(0.72 - split * 0.16);
    }
    if (fragments.current) {
      fragments.current.visible = split > 0.01;
      fragments.current.scale.setScalar(0.35 + split * 1.25);
      fragments.current.rotation.x = time * 0.18;
      fragments.current.rotation.z = time * 0.1;
    }
    if (coreMaterial.current) coreMaterial.current.opacity = 0.96 * visibility;
    if (haloMaterial.current) haloMaterial.current.opacity = 0.22 * visibility;
    if (dustMaterial.current) dustMaterial.current.opacity = 0.62 * visibility;
    if (fragmentMaterial.current) fragmentMaterial.current.opacity = split * 0.72 * visibility;
  });

  return (
    <group ref={mover} visible={false} renderOrder={-4}>
      <mesh ref={tail} renderOrder={-5}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial ref={tailMaterial} uniforms={tailUniforms} vertexShader={TAIL_VERTEX_SHADER} fragmentShader={TAIL_FRAGMENT_SHADER} transparent depthWrite={false} depthTest fog={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <Trail
        width={deviceMode === "mobile" ? 0.11 : deviceMode === "tablet" ? 0.16 : 0.2}
        length={deviceMode === "mobile" ? 6 : deviceMode === "tablet" ? 10 : 14}
        decay={1.35}
        color="#bdefff"
        attenuation={(value) => value * value}
      >
        <group>
          <mesh>
            <sphereGeometry args={[deviceMode === "mobile" ? 0.07 : deviceMode === "tablet" ? 0.095 : 0.11, 14, 10]} />
            <meshBasicMaterial ref={coreMaterial} color="#ffffff" transparent opacity={0.96} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
          </mesh>
          <mesh scale={2.05}>
            <sphereGeometry args={[deviceMode === "mobile" ? 0.07 : deviceMode === "tablet" ? 0.095 : 0.11, 14, 10]} />
            <meshBasicMaterial ref={haloMaterial} color="#7bdcff" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
          </mesh>
          <mesh ref={secondCore} visible={false}>
            <sphereGeometry args={[deviceMode === "mobile" ? 0.055 : 0.078, 12, 8]} />
            <meshBasicMaterial color="#ffd0ec" transparent opacity={0.86} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
          </mesh>
        </group>
      </Trail>

      <points ref={dust}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[dustPositions, 3]} /></bufferGeometry>
        <pointsMaterial ref={dustMaterial} size={deviceMode === "mobile" ? 0.06 : deviceMode === "tablet" ? 0.085 : 0.1} color="#ffafd7" transparent opacity={0.62} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} sizeAttenuation />
      </points>

      <points ref={fragments} visible={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[fragmentPositions, 3]} /></bufferGeometry>
        <pointsMaterial ref={fragmentMaterial} size={deviceMode === "mobile" ? 0.035 : 0.052} color="#ffdca8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} sizeAttenuation />
      </points>
    </group>
  );
}
