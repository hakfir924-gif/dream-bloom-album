"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Cloud, CloudRain, ImagePlus, MapPin, Moon, Snowflake, Sparkles, Sun, Wind, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createLocalDiary, type DiaryMood, type DiaryWeather, type LocalDiaryDraft } from "@/data/local-memory-store";

const moods: Array<{ value: DiaryMood; label: string; color: string }> = [
  { value: "happy", label: "开心", color: "#ffb7dc" },
  { value: "calm", label: "平静", color: "#8ee7ff" },
  { value: "miss", label: "思念", color: "#c4a2ff" },
  { value: "sad", label: "难过", color: "#8aa8d8" },
  { value: "excited", label: "激动", color: "#ffd18f" },
  { value: "tired", label: "疲惫", color: "#aca2bb" },
];

const weatherItems: Array<{ value: DiaryWeather; label: string; icon: typeof Sun }> = [
  { value: "sunny", label: "晴天", icon: Sun },
  { value: "cloudy", label: "多云", icon: Cloud },
  { value: "rainy", label: "下雨", icon: CloudRain },
  { value: "snowy", label: "下雪", icon: Snowflake },
  { value: "windy", label: "有风", icon: Wind },
  { value: "night", label: "夜晚", icon: Moon },
];

function nowTime() {
  const current = new Date();
  return `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
}

function todayDate() {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
}

export function CreateDiarySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayDate);
  const [time, setTime] = useState(nowTime);
  const [location, setLocation] = useState("");
  const [mood, setMood] = useState<DiaryMood>("calm");
  const [weather, setWeather] = useState<DiaryWeather>("sunny");
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    setFiles((current) => [...current, ...selected].slice(0, 9));
    event.target.value = "";
  };

  const save = async () => {
    if (!body.trim()) {
      setError("先写下一点今天发生的事");
      return;
    }
    setSaving(true);
    setError("");
    const draft: LocalDiaryDraft = { title, date, time, location, mood, weather, body, quote, files };
    try {
      await createLocalDiary(draft);
      setTitle("");
      setLocation("");
      setBody("");
      setQuote("");
      setFiles([]);
      onCreated();
      onClose();
    } catch {
      setError("保存失败，请检查浏览器是否允许本地存储");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? <motion.div className="absolute inset-0 z-[65] flex items-end justify-center bg-black/62 p-3 backdrop-blur-md sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.section className="max-h-[94svh] w-full max-w-xl overflow-y-auto rounded-[26px] border border-white/14 bg-[#13091f]/94 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.6)] sm:p-7" initial={{ y: 42, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 28, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] tracking-[0.22em] text-pink-200/60">TODAY IN MY UNIVERSE</p><h2 className="mt-2 text-xl font-medium tracking-[0.08em] text-white">写一封今天的星笺</h2></div><button type="button" onClick={onClose} aria-label="关闭" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-white/80 active:scale-95"><X size={16} /></button></div>

          <div className="mt-6 space-y-4">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="日记标题（不填则为“今天的星笺”）" className="h-12 w-full rounded-xl border border-white/12 bg-white/7 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-pink-200/45" />
            <div className="grid grid-cols-2 gap-3"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-xl border border-white/12 bg-white/7 px-3 text-sm text-white outline-none [color-scheme:dark]" /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-11 rounded-xl border border-white/12 bg-white/7 px-3 text-sm text-white outline-none [color-scheme:dark]" /></div>
            <span className="relative block"><MapPin size={15} className="pointer-events-none absolute left-3 top-3.5 text-pink-200/45" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="今天在哪里" className="h-11 w-full rounded-xl border border-white/12 bg-white/7 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28" /></span>
          </div>

          <div className="mt-5"><p className="mb-2 text-xs text-pink-100/60">今天的心情</p><div className="grid grid-cols-6 gap-1.5">{moods.map((item) => <button key={item.value} type="button" onClick={() => setMood(item.value)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] transition active:scale-95 ${mood === item.value ? "border-white/48 bg-white/14 text-white" : "border-white/9 bg-white/5 text-white/52"}`}><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 12px ${item.color}` }} />{item.label}</button>)}</div></div>

          <div className="mt-5"><p className="mb-2 text-xs text-pink-100/60">天气</p><div className="grid grid-cols-6 gap-1.5">{weatherItems.map((item) => { const Icon = item.icon; return <button key={item.value} type="button" onClick={() => setWeather(item.value)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] transition active:scale-95 ${weather === item.value ? "border-cyan-100/42 bg-cyan-100/12 text-cyan-50" : "border-white/9 bg-white/5 text-white/52"}`}><Icon size={14} />{item.label}</button>; })}</div></div>

          <label className="mt-5 block"><span className="mb-2 block text-xs text-pink-100/60">今天发生了什么</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="不用写得完美，只要把今天留下来。" rows={7} className="w-full resize-none rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/28 focus:border-pink-200/45" /></label>
          <label className="mt-4 block"><span className="mb-2 block text-xs text-pink-100/60">最想留下的一句话（可选）</span><input value={quote} onChange={(event) => setQuote(event.target.value)} placeholder="例如：今天也有认真地生活。" className="h-11 w-full rounded-xl border border-white/12 bg-white/7 px-4 text-sm text-white outline-none placeholder:text-white/28" /></label>

          <div className="mt-5"><div className="mb-2 flex items-center justify-between"><p className="text-xs text-pink-100/60">附上照片或视频 <span className="text-white/35">最多 9 个</span></p><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-pink-100/16 bg-pink-100/10 px-3 text-xs text-pink-50 active:scale-95"><ImagePlus size={15} />添加</button><input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={addFiles} /></div>{previews.length ? <div className="grid grid-cols-5 gap-2">{previews.map(({ file, url }, index) => <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5">{file.type.startsWith("video/") ? <video src={url} muted playsInline className="h-full w-full object-cover" /> : <img src={url} alt="" className="h-full w-full object-cover" />}<button type="button" aria-label="移除附件" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/58 text-white/80"><X size={11} /></button></div>)}</div> : null}</div>

          {error ? <p className="mt-4 text-xs text-pink-300">{error}</p> : null}
          <button type="button" disabled={saving} onClick={save} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-pink-100/28 bg-gradient-to-r from-pink-200/22 to-cyan-200/12 text-sm tracking-[0.12em] text-pink-50 active:scale-[.98] disabled:opacity-50"><Sparkles size={16} />{saving ? "正在放入星海..." : "保存这封星笺"}</button>
        </motion.section>
      </motion.div> : null}
    </AnimatePresence>
  );
}
