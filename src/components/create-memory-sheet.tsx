"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, MapPin, Sparkles, Star, Video, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { MemoryTheme } from "@/components/three-memory-universe";
import { createLocalPlanet, type LocalMediaDetail, type LocalPlanetDraft } from "@/data/local-memory-store";

const themes: Array<{ value: MemoryTheme; label: string; color: string }> = [
  { value: "pink", label: "粉色梦境", color: "#ff8bd8" },
  { value: "cyan", label: "青蓝海风", color: "#8ee7ff" },
  { value: "gold", label: "金色日光", color: "#ffd18f" },
  { value: "purple", label: "紫色夜晚", color: "#c4a2ff" },
];

const emptyDetail = (date: string, location: string): LocalMediaDetail => ({ date, location, note: "" });

export function CreateMemorySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [theme, setTheme] = useState<MemoryTheme>("pink");
  const [files, setFiles] = useState<File[]>([]);
  const [mediaDetails, setMediaDetails] = useState<LocalMediaDetail[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [coverIndex, setCoverIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    const available = selected.slice(0, Math.max(0, 30 - files.length));
    if (available.length) {
      setFiles((current) => [...current, ...available]);
      setMediaDetails((current) => [...current, ...available.map(() => emptyDetail(date, location))]);
      setSelectedIndex((current) => current ?? files.length);
    }
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setMediaDetails((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCoverIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
    setSelectedIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
  };

  const updateMediaDetail = (field: keyof LocalMediaDetail, value: string) => {
    if (selectedIndex === null) return;
    setMediaDetails((current) => current.map((detail, index) => index === selectedIndex ? { ...detail, [field]: value } : detail));
  };

  const save = async () => {
    if (!title.trim()) {
      setError("先给这颗星球取一个名字");
      return;
    }
    if (!files.length && !text.trim()) {
      setError("添加至少一张照片、一个视频或一段文字");
      return;
    }
    setSaving(true);
    setError("");
    const draft: LocalPlanetDraft = { title, date, location, description, text, theme, files, mediaDetails, coverIndex };
    try {
      await createLocalPlanet(draft);
      setFiles([]);
      setMediaDetails([]);
      setSelectedIndex(null);
      setCoverIndex(null);
      setTitle("");
      setLocation("");
      setDescription("");
      setText("");
      onCreated();
      onClose();
    } catch {
      setError("保存失败，请检查浏览器是否允许本地存储");
    } finally {
      setSaving(false);
    }
  };

  const selectedFile = selectedIndex === null ? null : files[selectedIndex];
  const selectedDetail = selectedIndex === null ? null : mediaDetails[selectedIndex];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.section className="max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-[26px] border border-white/14 bg-[#13091f]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.56)] sm:p-7" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] tracking-[0.22em] text-pink-200/60">CREATE A MEMORY PLANET</p><h2 className="mt-2 text-xl font-medium tracking-[0.08em] text-white">点亮一颗新星球</h2></div>
              <button type="button" onClick={onClose} aria-label="关闭" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-white/80 active:scale-95"><X size={16} /></button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs text-pink-100/60">星球名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：夏天的海风" className="h-12 w-full rounded-xl border border-white/12 bg-white/7 px-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-pink-200/45" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1.5 block text-xs text-pink-100/60">星球默认日期</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-xl border border-white/12 bg-white/7 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-pink-200/45" /></label>
                <label className="block"><span className="mb-1.5 block text-xs text-pink-100/60">星球默认地点</span><span className="relative block"><MapPin size={15} className="pointer-events-none absolute left-3 top-3.5 text-pink-200/45" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="青岛" className="h-11 w-full rounded-xl border border-white/12 bg-white/7 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-pink-200/45" /></span></label>
              </div>
              <label className="block"><span className="mb-1.5 block text-xs text-pink-100/60">星球简介</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这一组记忆整体在做什么" rows={2} className="w-full resize-none rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/28 focus:border-pink-200/45" /></label>
              <label className="block"><span className="mb-1.5 block text-xs text-pink-100/60">添加一段文字（可选）</span><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="比如：那天风很轻，海也很蓝。" rows={2} className="w-full resize-none rounded-xl border border-white/12 bg-white/7 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/28 focus:border-pink-200/45" /></label>
            </div>

            <div className="mt-5"><p className="mb-2 text-xs text-pink-100/60">星球颜色</p><div className="grid grid-cols-4 gap-2">{themes.map((item) => <button type="button" key={item.value} onClick={() => setTheme(item.value)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border text-[11px] transition active:scale-95 ${theme === item.value ? "border-white/50 bg-white/14 text-white" : "border-white/10 bg-white/5 text-white/55"}`}><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 12px ${item.color}` }} />{item.label}</button>)}</div></div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs text-pink-100/60">照片和视频 <span className="text-white/35">最多 30 个</span></p><button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-pink-100/16 bg-pink-100/10 px-3 text-xs text-pink-50 active:scale-95"><ImagePlus size={15} />添加素材</button><input ref={fileInput} type="file" accept="image/*,video/*" multiple className="hidden" onChange={addFiles} /></div>
              {previews.length ? <div className="grid grid-cols-5 gap-2">{previews.map(({ file, url }, index) => <div key={`${file.name}-${index}`} className={`relative aspect-square overflow-hidden rounded-lg border bg-white/5 ${selectedIndex === index ? "border-pink-200/70" : "border-white/10"}`}><button type="button" onClick={() => setSelectedIndex(index)} className="absolute inset-0 z-0">{file.type.startsWith("video/") ? <><video src={url} muted playsInline className="h-full w-full object-cover" /><span className="pointer-events-none absolute inset-0 grid place-items-center"><span className="grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white"><Video size={13} /></span></span></> : <img src={url} alt="" className="h-full w-full object-cover" />}</button><button type="button" onClick={() => setCoverIndex(index)} aria-label="设为封面" className={`absolute bottom-1 left-1 z-10 grid h-6 w-6 place-items-center rounded-full ${coverIndex === index ? "bg-pink-200 text-[#38132f]" : "bg-black/55 text-white/75"}`}><Star size={12} fill={coverIndex === index ? "currentColor" : "none"} /></button><button type="button" onClick={() => removeFile(index)} aria-label="移除素材" className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white/80"><X size={11} /></button></div>)}</div> : <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-24 w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.035] text-white/42"><ImagePlus size={21} /><span className="mt-2 text-xs">点击选择照片或视频</span></button>}
            </div>

            {selectedFile && selectedDetail ? <div className="mt-4 rounded-xl border border-pink-100/14 bg-pink-100/[0.045] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-pink-50">编辑第 {(selectedIndex ?? 0) + 1} 个素材</p><span className="max-w-[55%] truncate text-[10px] text-white/42">{selectedFile.name}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={selectedDetail.date} onChange={(event) => updateMediaDetail("date", event.target.value)} className="h-10 rounded-lg border border-white/12 bg-white/7 px-2 text-xs text-white outline-none [color-scheme:dark]" /><input value={selectedDetail.location} onChange={(event) => updateMediaDetail("location", event.target.value)} onChangeCapture={() => undefined} placeholder="这张素材在哪里" className="h-10 rounded-lg border border-white/12 bg-white/7 px-3 text-xs text-white outline-none placeholder:text-white/28" /></div><textarea value={selectedDetail.note} onChange={(event) => updateMediaDetail("note", event.target.value)} placeholder="这张素材当天发生了什么" rows={2} className="mt-2 w-full resize-none rounded-lg border border-white/12 bg-white/7 px-3 py-2 text-xs leading-relaxed text-white outline-none placeholder:text-white/28" /><p className="mt-2 text-[10px] text-white/35">点缩略图切换素材；星标表示封面。没有单独填写的字段会继承星球默认信息。</p></div> : null}

            {error ? <p className="mt-4 text-xs text-pink-300">{error}</p> : null}
            <button type="button" disabled={saving} onClick={save} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-pink-100/28 bg-gradient-to-r from-pink-200/22 to-cyan-200/12 text-sm tracking-[0.12em] text-pink-50 shadow-[0_0_28px_rgba(255,139,216,0.15)] transition active:scale-[.98] disabled:opacity-50"><Sparkles size={16} />{saving ? "正在点亮..." : "点亮这颗星球"}</button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
