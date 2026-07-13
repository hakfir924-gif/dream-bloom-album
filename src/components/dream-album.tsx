"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Images, Play, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThreeMemoryUniverse, type MemoryCollection, type SmallMemoryPlanet, type UniverseMedia } from "@/components/three-memory-universe";
import { getMemoryRecord, type MemoryRecord } from "@/data/memory-records";

const COPY = {
  heart: "\u2764",
  brand: "\u946b\u946b\u5b87\u5b99",
  start: "\u5f00\u59cb\u63a2\u7d22",
  closePreview: "\u5173\u95ed\u9884\u89c8",
  closeDetail: "\u5173\u95ed\u8be6\u60c5",
  photos: "PHOTOS",
  videos: "VIDEOS",
};

export function DreamAlbum() {
  const [exploring, setExploring] = useState(false);
  const [preview, setPreview] = useState<{ media: UniverseMedia; record: MemoryRecord } | null>(null);
  const [collection, setCollection] = useState<MemoryCollection | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const floaters = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        id: index,
        left: `${(index * 37 + 9) % 100}%`,
        delay: (index % 8) * 0.72,
        duration: 11 + (index % 6),
        size: 5 + (index % 4) * 2,
        type: index % 5,
      })),
    [],
  );

  /* Background music – start on first explore */
  useEffect(() => {
    if (exploring && !bgmRef.current) {
      const audio = new Audio("/audio/bgm.mp3");
      audio.loop = true;
      audio.volume = 0.35;
      audio.play().catch(() => {});
      bgmRef.current = audio;
    }
  }, [exploring]);

  useEffect(() => {
    const updateVolume = (event: Event) => {
      if (!bgmRef.current) return;
      bgmRef.current.volume = (event as CustomEvent<boolean>).detail ? 0.12 : 0.35;
    };
    window.addEventListener("xinxin-diary-reading", updateVolume);
    return () => window.removeEventListener("xinxin-diary-reading", updateVolume);
  }, []);

  return (
    <main className="universe-vignette relative h-[100svh] w-screen overflow-hidden text-white">
      <ThreeMemoryUniverse exploring={exploring} onPreview={(media, record) => setPreview({ media, record: record ?? getMemoryRecord(media, "记忆星球") })} onOpenCollection={setCollection} />
      <CinematicSkyBackdrop exploring={exploring} />
      <FloatingAtmosphere floaters={floaters} dimmed={exploring} />

      <AnimatePresence>
        {!exploring ? (
          <IntroHero key="intro" onStart={() => setExploring(true)} />
        ) : (
          <motion.div
            key="hint"
            className="pointer-events-none absolute inset-x-0 bottom-6 z-10 px-5 text-center text-[10px] tracking-[0.18em] text-pink-50/60 sm:text-[11px]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: preview ? 0 : 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            DRAG · PINCH · TAP STAR
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{collection ? <CollectionPreview collection={collection} onClose={() => setCollection(null)} onPreview={(media) => { setCollection(null); setPreview({ media, record: getMemoryRecord(media, collection.title) }); }} /> : null}</AnimatePresence>
      <AnimatePresence>{preview ? <MediaPreview media={preview.media} record={preview.record} onClose={() => setPreview(null)} /> : null}</AnimatePresence>
    </main>
  );
}

function CinematicSkyBackdrop({ exploring }: { exploring: boolean }) {
  return (
    <motion.div
      className="cinematic-sky-layer pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      initial={false}
      animate={exploring
        ? { opacity: [1, 0.96, 0.34, 0], scale: [1, 1.08, 1.26, 1.4], filter: ["blur(0px) saturate(108%)", "blur(2px) saturate(118%)", "blur(9px) saturate(126%)", "blur(16px) saturate(118%)"] }
        : { opacity: 1, scale: 1, filter: "blur(0px) saturate(108%)" }}
      transition={{ duration: exploring ? 2.8 : 1.2, times: exploring ? [0, 0.34, 0.76, 1] : undefined, ease: [0.2, 0.72, 0.24, 1] }}
    >
      <motion.div
        className="cinematic-sky-image absolute inset-[-3%]"
        animate={{ scale: [1.01, 1.045, 1.01], x: ["-0.6%", "0.6%", "-0.6%"], y: ["0%", "-0.7%", "0%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="cinematic-cloud-glow absolute inset-0"
        animate={{ opacity: [0.44, 0.72, 0.44], scale: [1, 1.05, 1] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="cinematic-sky-shade absolute inset-0" />
      {[
        { top: "7%", right: "-2%", delay: 0.8, duration: 1.55, repeatDelay: 7.2 },
        { top: "24%", right: "6%", delay: 4.2, duration: 1.3, repeatDelay: 8.6 },
      ].map((meteor, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{ top: meteor.top, right: meteor.right }}
          animate={{ x: ["0vw", "-72vw"], y: ["0vh", "42vh"], opacity: [0, 1, 0], scale: [0.78, 1, 0.9] }}
          transition={{ duration: meteor.duration, times: [0, 0.16, 1], delay: meteor.delay, repeat: Infinity, repeatDelay: meteor.repeatDelay, ease: [0.2, 0.7, 0.24, 1] }}
        >
          <span className="cinematic-meteor" />
        </motion.div>
      ))}
      <div className="cinematic-horizon-bloom absolute inset-x-0 bottom-0 h-[32%]" />
      <motion.div
        className="absolute bottom-[-14vh] left-1/2 h-[42vh] w-[72vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,244,214,0.92)_0%,rgba(255,170,170,0.46)_28%,rgba(104,170,255,0.12)_58%,transparent_74%)] blur-xl"
        initial={false}
        animate={exploring ? { opacity: [0, 0.88, 0.42, 0], scale: [0.55, 1.08, 1.72, 2.3], y: [0, -28, -82, -138] } : { opacity: 0, scale: 0.55, y: 0 }}
        transition={{ duration: 2.65, times: [0, 0.32, 0.7, 1], ease: [0.18, 0.72, 0.22, 1] }}
      />
    </motion.div>
  );
}

function FloatingAtmosphere({ floaters, dimmed }: { floaters: Array<{ id: number; left: string; delay: number; duration: number; size: number; type: number }>; dimmed: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-[8] transition-opacity duration-1000 ${dimmed ? "opacity-24" : "opacity-58"}`}>
      {floaters.map((item) => (
        <motion.span
          key={item.id}
          className="absolute bottom-[-8vh]"
          style={{ left: item.left }}
          animate={{
            y: ["0vh", "-112vh"],
            x: [0, item.id % 2 ? 22 : -18, item.id % 3 ? -8 : 12],
            rotate: [0, item.type === 0 ? 35 : 160],
            opacity: [0, 0.56, 0],
          }}
          transition={{ duration: item.duration, delay: item.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {item.type === 0 ? (
            <i className="heart-shape block text-pink-300 drop-shadow-[0_0_12px_rgba(255,109,190,0.85)]" style={{ width: item.size, height: item.size }} />
          ) : (
            <i
              className="block rounded-full bg-pink-100/75 shadow-[0_0_18px_rgba(255,202,239,0.8)]"
              style={{
                width: item.type === 1 ? item.size / 1.7 : item.size,
                height: item.type === 1 ? item.size / 1.7 : item.size * 1.35,
                borderRadius: item.type === 1 ? 999 : "999px 999px 999px 0",
              }}
            />
          )}
        </motion.span>
      ))}
    </div>
  );
}

function IntroHero({ onStart }: { onStart: () => void }) {
  const [launching, setLaunching] = useState(false);

  const launch = () => {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(onStart, 620);
  };

  return (
    <motion.section
      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pb-[4vh] text-center"
      initial={{ opacity: 0 }}
      animate={launching ? { opacity: 0.9, scale: 1.025 } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.12, filter: "blur(12px)" }}
      transition={{ duration: 0.9, ease: [0.2, 0.72, 0.24, 1] }}
    >
      <motion.div
        className="mb-5 text-2xl text-white drop-shadow-[0_0_18px_rgba(141,215,255,0.95)]"
        animate={{ scale: launching ? [1, 1.8, 0.4] : [1, 1.14, 1], opacity: launching ? [1, 1, 0] : [0.72, 1, 0.72] }}
        transition={{ duration: launching ? 0.7 : 3.4, repeat: launching ? 0 : Infinity, ease: "easeInOut" }}
      >
        {COPY.heart}
      </motion.div>
      <div className="relative">
        <motion.div
          className="absolute inset-0 -z-10 blur-3xl"
          animate={{ opacity: [0.3, 0.62, 0.3], scale: [0.94, 1.06, 0.94] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-5xl font-semibold tracking-[0.18em] text-cyan-100/60 sm:text-7xl">
            {COPY.brand}
          </span>
        </motion.div>
        <motion.h1
          className="cinematic-title text-5xl font-semibold tracking-[0.18em] text-white sm:text-7xl"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.8 }}
        >
          {COPY.brand}
        </motion.h1>
        <motion.span
          className="pointer-events-none absolute -right-6 -top-2 text-amber-100/80 sm:-right-8 sm:-top-3"
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <Sparkles size={16} />
        </motion.span>
        <motion.span
          className="pointer-events-none absolute -left-5 bottom-0 text-cyan-100/70 sm:-left-7"
          animate={{ scale: [1, 0.7, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <Sparkles size={12} />
        </motion.span>
      </div>
      <motion.p
        className="cinematic-subtitle mt-4 text-[11px] font-medium uppercase tracking-[0.34em] text-white/84 sm:text-xs"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.24, duration: 0.8 }}
      >
        Every Star Is A Memory
      </motion.p>
      <motion.button
        type="button"
        onClick={launch}
        disabled={launching}
        className="group mt-10 flex flex-col items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-white/90 disabled:pointer-events-none"
        initial={{ y: 20, opacity: 0 }}
        animate={launching ? { y: -12, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ delay: 0.38, duration: 0.8 }}
      >
        <span className="cinematic-start-orb relative grid h-16 w-16 place-items-center rounded-full border border-white/55 bg-white/12 text-white shadow-[0_0_42px_rgba(125,211,252,0.5)] backdrop-blur-md transition duration-500 group-hover:scale-105 group-hover:bg-white/20 group-active:scale-95">
          <ArrowRight size={19} strokeWidth={1.6} />
        </span>
        <span>{COPY.start}</span>
      </motion.button>
    </motion.section>
  );
}

function CollectionPreview({ collection, onClose, onPreview }: { collection: MemoryCollection; onClose: () => void; onPreview: (media: UniverseMedia) => void }) {
  const items = collection.items;

  return (
    <motion.div className="absolute inset-0 z-[55] bg-[#05010b]/95 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="mx-auto flex h-[100svh] w-full max-w-5xl flex-col" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
        <header className="flex shrink-0 items-start justify-between border-b border-white/10 px-4 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-pink-100/55"><Images size={13} /> MEMORY COLLECTION</p>
            <h2 className="mt-1 truncate text-xl tracking-[0.08em] text-white sm:text-2xl">{collection.title}</h2>
            <p className="mt-1 text-xs text-pink-100/48">{collection.subtitle} · {items.length} 个记忆片段</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭整组预览" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-white/80 active:scale-95"><X size={17} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
          <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3 sm:gap-4">
            {items.map((item, index) => (
              <button key={item.id} type="button" onClick={() => onPreview(item)} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-[#160b20] text-left shadow-[0_10px_32px_rgba(0,0,0,0.32)] transition active:scale-[0.98] sm:rounded-2xl">
                {item.type === "image" ? <Image src={item.url} alt={`记忆 ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /> : item.type === "video" ? <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(255,174,224,0.22),_transparent_62%)] px-5 text-center text-sm leading-7 text-pink-50">{item.text}</span>}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="pointer-events-none absolute bottom-3 left-3 text-[10px] tracking-[0.14em] text-white/80">{item.type === "video" ? "VIDEO" : item.type === "text" ? "NOTE" : `MEMORY ${String(index + 1).padStart(2, "0")}`}</span>
                {item.type === "video" ? <span className="pointer-events-none absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-sm"><Play size={13} fill="currentColor" /></span> : null}
              </button>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function MediaPreview({ media, record, onClose }: { media: UniverseMedia; record: MemoryRecord; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/16 bg-white/12 text-white" aria-label={COPY.closePreview}>
        <X size={19} />
      </button>
      <motion.div className="relative w-full max-w-3xl overflow-hidden rounded-[22px] border border-white/12 bg-[#150a20]/86 shadow-[0_22px_80px_rgba(0,0,0,0.52)]" initial={{ scale: 0.94, y: 22 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} onClick={(event) => event.stopPropagation()}>
        <div className="max-h-[64svh] bg-black/45">
          {media.type === "image" ? (
            <Image src={media.url} alt="" width={1200} height={1600} className="max-h-[64svh] w-full object-contain" />
          ) : media.type === "video" ? (
            <div className="relative"><video src={media.url} className="max-h-[64svh] w-full bg-black" controls autoPlay playsInline /><span className="pointer-events-none absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/16 text-white backdrop-blur-md"><Play size={17} fill="currentColor" /></span></div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center px-8 py-12 text-center text-lg leading-relaxed text-pink-50">{media.text}</div>
          )}
        </div>
        <div className="border-t border-white/10 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4"><p className="text-sm font-medium tracking-[0.08em] text-pink-50">{media.type === "video" ? "动态记忆" : "记忆片段"}</p><p className="text-xs tracking-[0.12em] text-pink-200/78">{record.date}</p></div>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{record.activity}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-pink-100/62 sm:text-sm">{record.note}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PlanetDetailPanel({ planet, onClose, onPreview }: { planet: SmallMemoryPlanet; onClose: () => void; onPreview: (media: UniverseMedia) => void }) {
  const imageCount = planet.items.filter((m) => m.type === "image").length;
  const videoCount = planet.items.filter((m) => m.type === "video").length;

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      onClick={onClose}
    >
      {/* Orbit ring decoration */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        <svg className="absolute h-[120%] w-[120%] max-w-[600px] max-h-[600px]" viewBox="0 0 400 400" fill="none">
          <ellipse cx="200" cy="200" rx="180" ry="60" stroke="url(#orbitGrad)" strokeWidth="0.5" strokeDasharray="6 8" opacity="0.3" transform="rotate(-15 200 200)" />
          <ellipse cx="200" cy="200" rx="160" ry="50" stroke="url(#orbitGrad)" strokeWidth="0.3" strokeDasharray="4 12" opacity="0.15" transform="rotate(25 200 200)" />
          <circle cx="200" cy="200" r="140" stroke="url(#orbitGrad2)" strokeWidth="0.4" strokeDasharray="3 6" opacity="0.12" />
          <defs>
            <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff8bd8" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#8ee7ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ffd18f" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="orbitGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff8bd8" stopOpacity="0" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ff8bd8" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      <motion.div
        className="glass-panel relative flex max-h-[88svh] w-full max-w-xl flex-col overflow-hidden rounded-[24px]"
        initial={{ scale: 0.88, y: 32, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 24, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/40 to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_6px_rgba(255,139,216,0.8)]" />
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-pink-300/80 sm:text-[11px]">
                {imageCount} {COPY.photos}{videoCount > 0 ? ` · ${videoCount} ${COPY.videos}` : ""}
              </span>
            </div>
            <h2 className="truncate text-lg font-semibold tracking-wide text-white sm:text-xl">{planet.title}</h2>
            <p className="mt-1 text-[11px] tracking-[0.12em] text-pink-200/60 sm:text-xs">
              2026-07-08 · 鑫鑫宇宙
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-pink-200/80 backdrop-blur-md transition hover:bg-white/14 active:scale-92"
            aria-label={COPY.closeDetail}
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        {planet.subtitle ? (
          <p className="px-5 pb-3 text-xs leading-relaxed text-pink-100/50 sm:px-6 sm:text-[13px]">
            {planet.subtitle}
          </p>
        ) : null}

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent sm:mx-6" />

        {/* Photo Grid */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {planet.items.map((media, index) => (
              <motion.button
                key={media.id}
                type="button"
                className="group relative aspect-[3/4] overflow-hidden rounded-[12px] sm:rounded-[14px]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + index * 0.04, duration: 0.4 }}
                onClick={() => onPreview(media)}
              >
                {media.type === "video" ? (
                  <>
                    <video src={media.url} className="h-full w-full object-cover" muted preload="metadata" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/18">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition group-hover:bg-white/30">
                        <Play size={14} fill="white" className="text-white" />
                      </span>
                    </span>
                  </>
                ) : (
                  <Image src={media.thumb ?? media.url} alt="" fill className="object-cover transition group-hover:scale-105" sizes="(max-width: 640px) 33vw, 200px" />
                )}
                {/* Shimmer border */}
                <span className="pointer-events-none absolute inset-0 rounded-[12px] sm:rounded-[14px] ring-1 ring-white/8" />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
      </motion.div>
    </motion.div>
  );
}
