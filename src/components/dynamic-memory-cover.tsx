"use client";

import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { UniverseMedia } from "@/components/three-memory-universe";

const COVER_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The two-texture/progress structure follows the small, composable pattern used
// by MIT-licensed GL Transitions, tuned here as a soft memory dissolve.
const COVER_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uTextureA;
  uniform sampler2D uTextureB;
  uniform vec3 uTint;
  uniform float uMix;
  uniform float uOpacity;
  uniform float uTime;

  float random(vec2 value) {
    return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float wave = sin(vUv.y * 18.0 + uTime * 0.72) * 0.004;
    float transitionNoise = (random(floor(vUv * 34.0)) - 0.5) * 0.18;
    float blend = smoothstep(0.08, 0.92, uMix + transitionNoise);
    vec4 fromColor = texture2D(uTextureA, vUv + vec2(wave * uMix, 0.0));
    vec4 toColor = texture2D(uTextureB, vUv - vec2(wave * (1.0 - uMix), 0.0));
    vec4 color = mix(fromColor, toColor, blend);
    float memoryLight = 0.94 + sin((vUv.x + vUv.y) * 8.0 + uTime * 0.32) * 0.025;
    color.rgb = color.rgb * memoryLight + uTint * 0.035;
    gl_FragColor = vec4(color.rgb, color.a * uOpacity);
  }
`;

export function memoryCoverSources(cover: string | null, items: UniverseMedia[], limit: number) {
  const sources = [
    cover,
    ...items.map((item) => item.thumb ?? (item.type === "image" ? item.url : null)),
  ].filter((source): source is string => Boolean(source));

  return Array.from(new Set(sources)).slice(0, Math.max(1, limit));
}

export function DynamicMemoryCoverMaterial({
  sources,
  tint,
  opacity,
  active,
  phase = 0,
  side = THREE.FrontSide,
}: {
  sources: string[];
  tint: string;
  opacity: number;
  active: boolean;
  phase?: number;
  side?: THREE.Side;
}) {
  const sourceKey = sources.join("|");
  const urls = useMemo(
    () => (sourceKey ? sourceKey.split("|") : ["/universe-media/thumbs/001.jpg"]),
    [sourceKey],
  );
  const textures = useTexture(urls) as THREE.Texture[];
  const material = useRef<THREE.ShaderMaterial>(null);
  const currentIndex = useRef(0);
  const nextIndex = useRef(textures.length > 1 ? 1 : 0);
  const transitionStartedAt = useRef<number | null>(null);
  const lastSwapAt = useRef(0);
  const uniforms = useMemo(() => ({
    uTextureA: { value: textures[0] },
    uTextureB: { value: textures[Math.min(1, textures.length - 1)] },
    uTint: { value: new THREE.Color(tint) },
    uMix: { value: 0 },
    uOpacity: { value: opacity },
    uTime: { value: 0 },
  }), [textures, tint]);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 2;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      texture.offset.set(0, 0);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    });
    currentIndex.current = 0;
    nextIndex.current = textures.length > 1 ? 1 : 0;
    transitionStartedAt.current = null;
    lastSwapAt.current = 0;
    if (material.current) {
      material.current.uniforms.uTextureA.value = textures[0];
      material.current.uniforms.uTextureB.value = textures[Math.min(1, textures.length - 1)];
      material.current.uniforms.uMix.value = 0;
    }
  }, [textures]);

  useFrame((state, delta) => {
    if (!material.current) return;
    const time = state.clock.elapsedTime;
    material.current.uniforms.uTime.value = time;
    material.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
      material.current.uniforms.uOpacity.value,
      opacity,
      5.5,
      delta,
    );
    if (textures.length < 2) return;

    const holdDuration = active ? 3.8 + phase * 0.35 : 5.6 + phase * 0.45;
    if (lastSwapAt.current === 0) lastSwapAt.current = time;
    if (transitionStartedAt.current === null && time - lastSwapAt.current >= holdDuration) {
      transitionStartedAt.current = time;
      nextIndex.current = (currentIndex.current + 1) % textures.length;
      material.current.uniforms.uTextureB.value = textures[nextIndex.current];
    }

    if (transitionStartedAt.current !== null) {
      const progress = THREE.MathUtils.clamp((time - transitionStartedAt.current) / 1.18, 0, 1);
      material.current.uniforms.uMix.value = progress * progress * (3 - 2 * progress);
      if (progress >= 1) {
        currentIndex.current = nextIndex.current;
        material.current.uniforms.uTextureA.value = textures[currentIndex.current];
        material.current.uniforms.uTextureB.value = textures[(currentIndex.current + 1) % textures.length];
        material.current.uniforms.uMix.value = 0;
        transitionStartedAt.current = null;
        lastSwapAt.current = time;
      }
    }
  });

  return (
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      vertexShader={COVER_VERTEX_SHADER}
      fragmentShader={COVER_FRAGMENT_SHADER}
      transparent
      depthWrite={false}
      side={side}
      toneMapped={false}
    />
  );
}
