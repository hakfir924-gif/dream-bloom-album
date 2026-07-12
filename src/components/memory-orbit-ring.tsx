"use client";

import { Billboard, RoundedBox, Text, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { MemoryCollection, MemoryTheme, UniverseMedia } from "@/components/three-memory-universe";
import { getMemoryRecord, type MemoryRecord } from "@/data/memory-records";

const THEME_COLORS: Record<MemoryTheme, [string, string, string]> = {
  pink: ["#ff8bd8", "#ffe2f6", "#7d2b67"],
  cyan: ["#8ee7ff", "#e3fbff", "#1f6271"],
  gold: ["#ffd18f", "#fff1c9", "#7a531e"],
  purple: ["#c4a2ff", "#f0e7ff", "#3f246e"],
};

function seed(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function easeOutCubic(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function memoryWaterfallPosition(index: number, total: number, flow: number, compact: boolean, lane: number, target: THREE.Vector3) {
  const columns = compact ? 3 : 6;
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const column = index % columns;
  const phase = (row + flow + column * 0.17) % rows;
  const xLimit = compact ? 1.1 : 3.32;
  const yTop = compact ? 1.8 : 3.46;
  const yBottom = compact ? -1.8 : -3.52;
  const columnProgress = column / (columns - 1);
  const rowProgress = rows === 1 ? 0.5 : phase / (rows - 1);

  target.set(
    THREE.MathUtils.lerp(-xLimit, xLimit, columnProgress),
    THREE.MathUtils.lerp(yTop, yBottom, rowProgress),
    lane === 0 ? 0.82 : 0.3,
  );
  return target;
}

function isBackRiverSlot(index: number, compact: boolean) {
  return compact ? index % 5 === 1 : index % 5 === 2;
}

export function MemoryOrbitRing({
  memory,
  origin,
  compact,
  expanded,
  onPreview,
}: {
  memory: MemoryCollection;
  origin: [number, number, number];
  compact: boolean;
  expanded: boolean;
  onPreview: (media: UniverseMedia, record?: MemoryRecord) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const release = useRef(0);
  const releaseStartedAt = useRef(0);
  const flowProgress = useRef(0);
  const flowStartedAt = useRef(0);
  const colors = THEME_COLORS[memory.theme];
  const slotCount = Math.min(compact ? 12 : 30, memory.items.length);
  const videoPosters = useMemo(
    () => memory.items.filter((item) => item.type === "image").map((item) => item.thumb ?? item.url),
    [memory.items],
  );

  useEffect(() => {
    release.current = 0;
    releaseStartedAt.current = 0;
    flowProgress.current = 0;
    flowStartedAt.current = 0;
  }, [memory.id]);

  useFrame((state, delta) => {
    if (!group.current) return;
    if (expanded && releaseStartedAt.current === 0) releaseStartedAt.current = performance.now();
    if (!expanded) {
      releaseStartedAt.current = 0;
      flowStartedAt.current = 0;
      flowProgress.current = 0;
    }
    const ready = expanded && performance.now() - releaseStartedAt.current > (compact ? 300 : 420);
    release.current = THREE.MathUtils.lerp(release.current, ready ? 1 : 0, Math.min(1, delta * (ready ? 1.35 : 4.2)));
    if (ready && release.current > 0.88) {
      if (flowStartedAt.current === 0) flowStartedAt.current = performance.now();
      const elapsed = performance.now() - flowStartedAt.current;
      const cellDuration = compact ? 7200 : 6400;
      flowProgress.current = elapsed / cellDuration;
    }
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.08);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.08);
    group.current.position.y = origin[1];
  });

  return (
    <group ref={group} position={origin}>
      <MemoryBandDust colors={colors} compact={compact} progressRef={release} />
      {Array.from({ length: slotCount }, (_, index) => {
        const media = memory.items[index % memory.items.length];
        const posterSource = videoPosters.length > 0 ? videoPosters[(index * 7 + 3) % videoPosters.length] : memory.cover ?? "/universe-media/thumbs/001.jpg";
        return (
          <OrbitMemoryFragment
            key={`${memory.id}-waterfall-slot-${index}`}
            media={media}
            index={index}
            total={slotCount}
            compact={compact}
            colors={colors}
            posterSource={posterSource}
            progressRef={release}
            flowProgressRef={flowProgress}
            record={getMemoryRecord(media, memory.title)}
            onPreview={onPreview}
          />
        );
      })}
    </group>
  );
}

function OrbitMemoryFragment({
  media,
  index,
  total,
  compact,
  colors,
  posterSource,
  progressRef,
  flowProgressRef,
  record,
  onPreview,
}: {
  media: UniverseMedia;
  index: number;
  total: number;
  compact: boolean;
  colors: [string, string, string];
  posterSource: string;
  progressRef: MutableRefObject<number>;
  flowProgressRef: MutableRefObject<number>;
  record: ReturnType<typeof getMemoryRecord>;
  onPreview: (media: UniverseMedia, record?: MemoryRecord) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const imageMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const frameMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const isVideo = media.type === "video";
  const isText = media.type === "text";
  const width = compact ? 0.58 : 0.72;
  const height = compact ? 0.78 : 1.08;
  const layout = useMemo(() => {
    const lane = isBackRiverSlot(index, compact) ? 1 : 0;
    return {
      lane,
      baseQuaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler((seed(index, 5) - 0.5) * 0.1, 0, (seed(index, 9) - 0.5) * 0.12)),
    };
  }, [compact, index]);
  const targetQuaternion = useRef(layout.baseQuaternion.clone());
  const cameraQuaternion = useRef(new THREE.Quaternion());
  const parentQuaternion = useRef(new THREE.Quaternion());
  const lookMatrix = useRef(new THREE.Matrix4());
  const worldPosition = useRef(new THREE.Vector3());
  const orbitPosition = useRef(new THREE.Vector3());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    targetQuaternion.current.copy(layout.baseQuaternion);
  }, [layout]);

  useFrame((state) => {
    if (!group.current) return;
    const releaseProgress = easeOutCubic((progressRef.current - index * 0.022) / 0.56);
    const columns = compact ? 4 : 6;
    const rows = Math.ceil(total / columns);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const travel = (row + flowProgressRef.current + column * 0.17) % rows;
    const streamOpacity = THREE.MathUtils.smoothstep(travel, 0, 0.24) * (1 - THREE.MathUtils.smoothstep(travel, rows - 0.42, rows - 0.04));
    const local = releaseProgress * streamOpacity;
    const float = Math.sin(state.clock.elapsedTime * 0.56 + index) * 0.02 * local;
    memoryWaterfallPosition(index, total, flowProgressRef.current, compact, layout.lane, orbitPosition.current);
    group.current.position.copy(orbitPosition.current).multiplyScalar(releaseProgress);
    group.current.position.y += float;
    group.current.position.z += Math.cos(state.clock.elapsedTime * 0.32 + index * 0.5) * 0.014 * local;

    group.current.getWorldPosition(worldPosition.current);
    lookMatrix.current.lookAt(worldPosition.current, state.camera.position, state.camera.up);
    cameraQuaternion.current.setFromRotationMatrix(lookMatrix.current);
    if (group.current.parent) {
      group.current.parent.getWorldQuaternion(parentQuaternion.current).invert();
      cameraQuaternion.current.premultiply(parentQuaternion.current);
    }
    targetQuaternion.current.copy(cameraQuaternion.current);
    targetQuaternion.current.slerp(layout.baseQuaternion, 0.08);
    group.current.quaternion.slerp(targetQuaternion.current, 0.14);
    const layerScale = layout.lane === 0 ? 1 : 0.78;
    group.current.scale.setScalar((0.08 + local * 0.92) * layerScale * (1 + Math.sin(state.clock.elapsedTime * 0.66 + index) * 0.012));
    group.current.visible = local > 0.01;

    const layerOpacity = layout.lane === 0 ? 1 : 0.64;
    if (glowMaterial.current) glowMaterial.current.opacity = (0.1 + Math.sin(state.clock.elapsedTime * 1.1 + index) * 0.025) * local * layerOpacity;
    if (imageMaterial.current) imageMaterial.current.opacity = local * 0.96 * layerOpacity;
    if (frameMaterial.current) frameMaterial.current.opacity = (isVideo ? 0.26 : isText ? 0.22 : 0.08) * local * layerOpacity;
  });

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onPreview(media, record);
    }, 520);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    clearLongPress();
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onPreview(media, record);
  };

  useEffect(() => clearLongPress, []);

  return (
    <group ref={group}>
      <group>
        <mesh position={[0, 0, -0.035]}>
          <planeGeometry args={[width * 1.08, height * 1.06]} />
          <meshBasicMaterial ref={glowMaterial} color={isVideo ? colors[1] : colors[0]} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <RoundedBox args={[width + 0.036, height + 0.036, 0.014]} radius={0.035} smoothness={3}>
          <meshBasicMaterial color="#fff4fc" transparent opacity={0.14} depthWrite={false} />
        </RoundedBox>
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[width, height]} />
          {isVideo ? <VideoPosterSurface source={media.url} fallback={media.thumb ?? posterSource} materialRef={imageMaterial} compact={compact} /> : isText ? <TextMemorySurface text={media.text ?? ""} colors={colors} compact={compact} /> : <ImageSurface source={media.thumb ?? media.url} materialRef={imageMaterial} compact={compact} />}
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <ringGeometry args={[Math.min(width, height) * 0.48, Math.min(width, height) * 0.495, 48]} />
          <meshBasicMaterial ref={frameMaterial} color={colors[1]} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
        {isVideo ? (
          <group position={[0, 0, 0.034]}>
            <mesh><circleGeometry args={[compact ? 0.105 : 0.13, 28]} /><meshBasicMaterial color="#06020c" transparent opacity={0.48} depthWrite={false} /></mesh>
            <mesh rotation={[0, 0, -Math.PI / 2]} position={[0.012, 0, 0.006]}><coneGeometry args={[0.04, 0.07, 3]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} /></mesh>
          </group>
        ) : null}
        <mesh position={[0, 0, 0.06]} onPointerDown={startLongPress} onPointerUp={clearLongPress} onPointerLeave={clearLongPress} onPointerCancel={clearLongPress} onClick={handleClick}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function TextMemorySurface({ text, colors, compact }: { text: string; colors: [string, string, string]; compact: boolean }) {
  return (
    <group position={[0, 0, 0.012]}>
      <mesh><planeGeometry args={[compact ? 0.72 : 0.88, compact ? 0.96 : 1.15]} /><meshBasicMaterial color={colors[2]} transparent opacity={0.9} depthWrite={false} /></mesh>
      <Text position={[0, compact ? 0.24 : 0.3, 0.014]} fontSize={compact ? 0.055 : 0.07} anchorX="center" anchorY="middle" color={colors[1]}>记忆文字</Text>
      <Text position={[0, -0.02, 0.014]} fontSize={compact ? 0.045 : 0.056} anchorX="center" anchorY="middle" color="#fff7fc" maxWidth={compact ? 0.56 : 0.72} lineHeight={1.35}>{text}</Text>
    </group>
  );
}

function ImageSurface({ source, materialRef, compact }: { source: string; materialRef: MutableRefObject<THREE.MeshBasicMaterial | null>; compact: boolean }) {
  const texture = useTexture(source);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = compact ? 4 : 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
    texture.needsUpdate = true;
  }, [compact, texture]);

  return <meshBasicMaterial ref={materialRef} map={texture} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />;
}

type PosterTask = {
  source: string;
  resolve: (texture: THREE.Texture) => void;
  reject: (error: Error) => void;
};

const posterCache = new Map<string, Promise<THREE.Texture>>();
const posterQueue: PosterTask[] = [];
let activePosterJobs = 0;
const MAX_POSTER_JOBS = 2;

function requestVideoPoster(source: string) {
  const cached = posterCache.get(source);
  if (cached) return cached;

  const pending = new Promise<THREE.Texture>((resolve, reject) => {
    posterQueue.push({ source, resolve, reject });
    processPosterQueue();
  });
  posterCache.set(source, pending);
  return pending;
}

function processPosterQueue() {
  while (activePosterJobs < MAX_POSTER_JOBS && posterQueue.length > 0) {
    const task = posterQueue.shift();
    if (!task) return;
    activePosterJobs += 1;
    const video = document.createElement("video");
    video.src = task.source;
    video.muted = true;
    video.preload = "metadata";
    video.playsInline = true;

    const finish = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      activePosterJobs -= 1;
      processPosterQueue();
    };
    const fail = () => {
      posterCache.delete(task.source);
      task.reject(new Error(`Unable to create poster for ${task.source}`));
      finish();
    };
    const capture = () => {
      const width = Math.min(video.videoWidth || 360, 480);
      const height = Math.max(1, Math.round(width * ((video.videoHeight || 480) / (video.videoWidth || 360))));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = -1;
      texture.offset.x = 1;
      task.resolve(texture);
      finish();
    };
    const seek = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0.25;
      video.currentTime = Math.min(0.25, Math.max(0.03, duration * 0.1));
    };

    video.addEventListener("loadedmetadata", seek, { once: true });
    video.addEventListener("seeked", capture, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.load();
  }
}

function VideoPosterSurface({
  source,
  fallback,
  materialRef,
  compact,
}: {
  source: string;
  fallback: string;
  materialRef: MutableRefObject<THREE.MeshBasicMaterial | null>;
  compact: boolean;
}) {
  const fallbackTexture = useTexture(fallback);
  const [poster, setPoster] = useState<THREE.Texture | null>(null);
  const texture = poster ?? fallbackTexture;

  useEffect(() => {
    fallbackTexture.colorSpace = THREE.SRGBColorSpace;
    fallbackTexture.anisotropy = compact ? 4 : 8;
    fallbackTexture.wrapS = THREE.RepeatWrapping;
    fallbackTexture.repeat.x = -1;
    fallbackTexture.offset.x = 1;
    fallbackTexture.needsUpdate = true;
  }, [compact, fallbackTexture]);

  useEffect(() => {
    let mounted = true;
    setPoster(null);
    requestVideoPoster(source)
      .then((value) => {
        if (mounted) setPoster(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [source]);

  return <meshBasicMaterial ref={materialRef} map={texture} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />;
}

function MemoryBandDust({ colors, compact, progressRef }: { colors: [string, string, string]; compact: boolean; progressRef: MutableRefObject<number> }) {
  const points = useRef<THREE.Points>(null);
  const count = compact ? 150 : 240;
  const wallSlots = compact ? 20 : 30;
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const lane = index % 2;
      const jitter = (seed(index, 24) - 0.5) * (compact ? 0.12 : 0.18);
      const position = memoryWaterfallPosition(index % wallSlots, wallSlots, 0, compact, lane, new THREE.Vector3());
      data[index * 3] = position.x + jitter;
      data[index * 3 + 1] = position.y + (seed(index, 25) - 0.5) * 0.13;
      data[index * 3 + 2] = position.z + (seed(index, 26) - 0.5) * 0.12;
    }
    return data;
  }, [compact, count, wallSlots]);

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.012;
    (points.current.material as THREE.PointsMaterial).opacity = 0.06 + progressRef.current * 0.3;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={compact ? 0.022 : 0.028} color={colors[1]} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
