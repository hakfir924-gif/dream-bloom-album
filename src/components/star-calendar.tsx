"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, ImageIcon, MapPin, Play, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DiaryMood, LocalDiaryEntry } from "@/data/local-memory-store";

const moodColors: Record<DiaryMood, string> = {
  happy: "#ff9fd1",
  calm: "#85e8ff",
  miss: "#bd9cff",
  sad: "#789bd1",
  excited: "#ffc36f",
  tired: "#aaa0bd",
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  return `${value.getMonth() + 1}月${value.getDate()}日`;
}

export function StarCalendar({ open, entries, onClose, onOpenEntry, onDeleteEntry }: {
  open: boolean;
  entries: LocalDiaryEntry[];
  onClose: () => void;
  onOpenEntry: (entry: LocalDiaryEntry) => void;
  onDeleteEntry: (id: string) => Promise<void>;
}) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const monthEntries = useMemo(() => entries
    .filter((entry) => entry.date.startsWith(monthKey(month)))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)), [entries, month]);

  const moveMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setPendingDelete(null);
  };

  const remove = async (id: string) => {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    await onDeleteEntry(id);
    setPendingDelete(null);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="absolute inset-0 z-[64] flex items-end justify-center bg-[#030107]/76 p-3 backdrop-blur-md sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.section className="flex max-h-[95svh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[#090312]/94 shadow-[0_26px_100px_rgba(0,0,0,0.72)]" initial={{ y: 38, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
            <header className="flex shrink-0 items-start justify-between px-5 pb-3 pt-5 sm:px-7 sm:pt-7">
              <div><p className="text-[10px] tracking-[0.24em] text-cyan-100/44">MEMORY STREAM</p><h2 className="mt-2 text-xl font-medium tracking-[0.16em] text-white">星河手札</h2><p className="mt-2 text-xs text-white/35">沿着记忆向下滑，不必一天一天寻找</p></div>
              <button type="button" onClick={onClose} aria-label="关闭星河手札" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/7 text-white/72 active:scale-95"><X size={16} /></button>
            </header>

            <div className="flex shrink-0 items-center justify-between border-y border-white/7 px-4 py-2 sm:px-6">
              <button type="button" onClick={() => moveMonth(-1)} aria-label="上个月" className="grid h-10 w-10 place-items-center rounded-full text-white/52 transition hover:bg-white/7 active:scale-95"><ChevronLeft size={19} /></button>
              <div className="text-center"><p className="text-sm tracking-[0.18em] text-pink-50">{month.getFullYear()} · {month.getMonth() + 1}月</p><p className="mt-1 text-[9px] tracking-[0.16em] text-white/28">{monthEntries.length ? `${monthEntries.length} 篇记忆` : "这片星河还很安静"}</p></div>
              <button type="button" onClick={() => moveMonth(1)} aria-label="下个月" className="grid h-10 w-10 place-items-center rounded-full text-white/52 transition hover:bg-white/7 active:scale-95"><ChevronRight size={19} /></button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5 sm:px-7">
              <div className="pointer-events-none absolute bottom-0 left-[35px] top-0 w-px bg-gradient-to-b from-transparent via-pink-200/18 to-transparent sm:left-[47px]" />
              {monthEntries.length ? (
                <div className="space-y-4">
                  {monthEntries.map((entry, index) => {
                    const media = entry.attachments[0];
                    const color = moodColors[entry.mood];
                    return (
                      <motion.article key={entry.id} className="relative flex gap-4 pl-1 sm:gap-5" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.045, 0.35) }}>
                        <div className="relative z-10 mt-5 grid h-7 w-7 shrink-0 place-items-center">
                          <i className="absolute h-5 w-px" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
                          <i className="absolute h-px w-5" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
                          <i className="h-2.5 w-2.5 rotate-45" style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 20px ${color}` }} />
                        </div>
                        <button type="button" onClick={() => onOpenEntry(entry)} className="min-w-0 flex-1 overflow-hidden rounded-xl border border-white/9 bg-white/[0.045] text-left transition active:scale-[0.99]">
                          {media?.url ? <div className="relative h-28 overflow-hidden sm:h-36">{media.type === "video" ? <video src={media.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={media.thumb || media.url} alt="" className="h-full w-full object-cover" />}<div className="absolute inset-0 bg-gradient-to-t from-[#100717]/75 via-transparent to-transparent" />{media.type === "video" ? <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/35 text-white"><Play size={13} fill="currentColor" /></span> : null}</div> : null}
                          <div className="p-4"><div className="flex items-center gap-2 text-[10px] text-white/34"><CalendarDays size={12} /><span>{formatDate(entry.date)}{entry.time ? ` · ${entry.time}` : ""}</span>{entry.location ? <><MapPin size={12} className="ml-1" /><span className="truncate">{entry.location}</span></> : null}</div><h3 className="mt-2 text-base text-white/92">{entry.title}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-white/48">{entry.body}</p>{entry.attachments.length ? <p className="mt-3 flex items-center gap-1.5 text-[10px] text-pink-100/45">{entry.attachments.some((item) => item.type === "video") ? <Play size={11} /> : <ImageIcon size={11} />}{entry.attachments.length} 个记忆片段</p> : null}</div>
                        </button>
                        <button type="button" onClick={() => remove(entry.id)} className={`mt-4 grid h-9 shrink-0 place-items-center rounded-lg px-2 text-[10px] transition active:scale-95 ${pendingDelete === entry.id ? "bg-red-400/16 text-red-200" : "text-white/22"}`} aria-label={pendingDelete === entry.id ? "确认删除" : "删除日记"}>{pendingDelete === entry.id ? "确认" : <Trash2 size={14} />}</button>
                      </motion.article>
                    );
                  })}
                </div>
              ) : <div className="flex min-h-56 flex-col items-center justify-center text-white/24"><CalendarDays size={22} /><p className="mt-3 text-xs">这个月还没有写下记忆</p></div>}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
