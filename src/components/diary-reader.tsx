"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MapPin, Quote, X } from "lucide-react";
import { useEffect } from "react";
import type { DiaryMood, DiaryWeather, LocalDiaryEntry } from "@/data/local-memory-store";

const moodMeta: Record<DiaryMood, { label: string; color: string; glow: string }> = {
  happy: { label: "开心", color: "#ffb7dc", glow: "rgba(255,142,202,0.24)" },
  calm: { label: "平静", color: "#8ee7ff", glow: "rgba(91,209,242,0.2)" },
  miss: { label: "思念", color: "#c4a2ff", glow: "rgba(180,133,255,0.22)" },
  sad: { label: "难过", color: "#9ab7e5", glow: "rgba(92,126,188,0.22)" },
  excited: { label: "激动", color: "#ffd18f", glow: "rgba(255,186,88,0.22)" },
  tired: { label: "疲惫", color: "#b9aec8", glow: "rgba(145,129,164,0.2)" },
};

const weatherLabels: Record<DiaryWeather, string> = {
  sunny: "晴天",
  cloudy: "多云",
  rainy: "下雨",
  snowy: "下雪",
  windy: "有风",
  night: "夜晚",
};

export function DiaryReader({ entry, onClose }: { entry: LocalDiaryEntry | null; onClose: () => void }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("xinxin-diary-reading", { detail: Boolean(entry) }));
    return () => {
      window.dispatchEvent(new CustomEvent("xinxin-diary-reading", { detail: false }));
    };
  }, [entry]);

  return (
    <AnimatePresence>
      {entry ? <DiaryArticle key={entry.id} entry={entry} onClose={onClose} /> : null}
    </AnimatePresence>
  );
}

function DiaryArticle({ entry, onClose }: { entry: LocalDiaryEntry; onClose: () => void }) {
  const mood = moodMeta[entry.mood];
  return (
    <motion.div className="absolute inset-0 z-[70] overflow-y-auto bg-[#07030e]/90 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(circle at 50% 18%, ${mood.glow}, transparent 42%)` }} />
      <button type="button" onClick={onClose} aria-label="关闭日记" className="fixed right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/16 bg-white/10 text-white backdrop-blur-md active:scale-95"><X size={19} /></button>
      <motion.article className="relative mx-auto min-h-full w-full max-w-3xl px-5 pb-16 pt-20 sm:px-10 sm:pt-24" initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }}>
        <p className="text-[10px] tracking-[0.24em] text-white/42">A LETTER FROM THE UNIVERSE</p>
        <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[0.08em] text-white sm:text-4xl">{entry.title}</h2>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/56">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{entry.date} · {entry.time}</span>
          {entry.location ? <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{entry.location}</span> : null}
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: mood.color, boxShadow: `0 0 10px ${mood.color}` }} />{mood.label}</span>
          <span>{weatherLabels[entry.weather]}</span>
        </div>

        {entry.attachments.length ? <div className={`mt-9 grid gap-2 ${entry.attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{entry.attachments.map((media) => <div key={media.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">{media.type === "video" ? <video src={media.url} controls playsInline className="max-h-[62svh] w-full object-contain" /> : <img src={media.url} alt="" className="max-h-[62svh] w-full object-contain" />}</div>)}</div> : null}

        <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
        <div className="whitespace-pre-wrap py-9 text-[15px] leading-8 text-white/88 sm:text-base sm:leading-9">{entry.body}</div>
        {entry.quote ? <blockquote className="relative mt-2 border-l border-white/18 py-3 pl-6 text-lg leading-8 text-white/76"><Quote size={17} className="absolute -left-2 -top-1 text-white/38" />{entry.quote}</blockquote> : null}
        <p className="mt-12 text-center text-[10px] tracking-[0.22em] text-white/28">THIS DAY IS NOW A STAR</p>
      </motion.article>
    </motion.div>
  );
}
