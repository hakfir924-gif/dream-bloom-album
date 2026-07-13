"use client";

import { PointMaterial, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

type CinematicGalaxyProps = {
  compact: boolean;
  active: boolean;
  flightRef: MutableRefObject<number>;
  cometRef: MutableRefObject<number>;
};

const PALETTE = [
  new THREE.Color("#ffd9a8"),
  new THREE.Color("#ff9fbd"),
  new THREE.Color("#92dcff"),
  new THREE.Color("#7f8cff"),
];

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function CinematicGalaxy({ compact, active, flightRef, cometRef }: CinematicGalaxyProps) {
  return (
    <group>
      <HorizonAfterglow compact={compact} active={active} flightRef={flightRef} cometRef={cometRef} />
      <SpiralGalaxy compact={compact} active={active} flightRef={flightRef} cometRef={cometRef} />
      <Sparkles
        count={compact ? 18 : 38}
        scale={compact ? [9, 7, 8] : [14, 9, 10]}
        position={[0, 0.25, 1.2]}
        size={compact ? 0.9 : 1.2}
        speed={0.12}
        opacity={0.2}
        color="#fff0e8"
        noise={1.35}
      />
    </group>
  );
}

function SpiralGalaxy({ compact, active, flightRef, cometRef }: CinematicGalaxyProps) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const count = compact ? 900 : 2600;
  const { positions, colors } = useMemo(() => {
    const positionData = new Float32Array(count * 3);
    const colorData = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let index = 0; index < count; index += 1) {
      const arm = index % 5;
      const distance = Math.pow(seeded(index, 11), 0.58) * 8.5;
      const armAngle = arm * (Math.PI * 2 / 5);
      const angle = armAngle + distance * 0.54 + (seeded(index, 12) - 0.5) * (0.3 + distance * 0.055);
      const thickness = (seeded(index, 13) - 0.5) * (0.18 + distance * 0.075);
      const radialJitter = (seeded(index, 14) - 0.5) * 0.44;
      const radius = Math.max(0.08, distance + radialJitter);

      positionData[index * 3] = Math.cos(angle) * radius;
      positionData[index * 3 + 1] = Math.sin(angle) * radius * 0.46 + thickness;
      positionData[index * 3 + 2] = (seeded(index, 17) - 0.5) * (0.2 + distance * 0.16);

      const radialMix = THREE.MathUtils.clamp(radius / 8.5, 0, 1);
      const inner = radialMix < 0.28 ? PALETTE[0] : radialMix < 0.62 ? PALETTE[1] : PALETTE[2];
      const outer = radialMix < 0.5 ? PALETTE[1] : PALETTE[3];
      color.copy(inner).lerp(outer, seeded(index, 15) * 0.42 + radialMix * 0.34);
      color.multiplyScalar(0.76 + seeded(index, 16) * 0.38);
      colorData[index * 3] = color.r;
      colorData[index * 3 + 1] = color.g;
      colorData[index * 3 + 2] = color.b;
    }

    return { positions: positionData, colors: colorData };
  }, [count]);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * (0.006 + flightRef.current * 0.028);
      group.current.rotation.z = -0.12 + Math.sin(state.clock.elapsedTime * 0.025) * 0.018;
      group.current.position.y = -0.48 + Math.sin(state.clock.elapsedTime * 0.04) * 0.08;
    }
    if (material.current) {
      const target = (active ? 0.44 : 0.58) + flightRef.current * 0.1 + cometRef.current * 0.1;
      material.current.opacity = THREE.MathUtils.lerp(material.current.opacity, target, 0.035);
      material.current.size = (compact ? 0.03 : 0.04) * (1 + flightRef.current * 0.42 + cometRef.current * 0.16);
    }
  });

  return (
    <group ref={group} position={[0, -0.38, -4.2]} rotation={[0.08, -0.08, -0.14]}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <PointMaterial
          ref={material}
          size={compact ? 0.03 : 0.04}
          vertexColors
          transparent
          opacity={0.58}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function HorizonAfterglow({ compact, active, flightRef, cometRef }: CinematicGalaxyProps) {
  const group = useRef<THREE.Group>(null);
  const warmMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const coolMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(createGlowTexture, []);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    if (group.current) {
      group.current.position.x = Math.sin(state.clock.elapsedTime * 0.022) * 0.28;
      group.current.position.y = -2.5 + Math.cos(state.clock.elapsedTime * 0.019) * 0.12;
    }
    const pulse = 0.94 + Math.sin(state.clock.elapsedTime * 0.16) * 0.06;
    if (warmMaterial.current) warmMaterial.current.opacity = (active ? 0.19 : 0.28) * pulse * (1 + flightRef.current * 0.28 + cometRef.current * 0.24);
    if (coolMaterial.current) coolMaterial.current.opacity = (active ? 0.12 : 0.18) * pulse;
  });

  return (
    <group ref={group} position={[0, -2.2, -5]}>
      <mesh scale={compact ? [10.5, 4.8, 1] : [17.5, 7.2, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={warmMaterial} map={texture} color="#ffb79d" transparent opacity={0.23} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 1.15, -0.3]} scale={compact ? [12, 6.2, 1] : [20, 8.8, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={coolMaterial} map={texture} color="#4e91ff" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 124);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.42)");
    gradient.addColorStop(0.58, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
