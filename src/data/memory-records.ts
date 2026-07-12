import type { UniverseMedia } from "@/components/three-memory-universe";

export type MemoryRecord = {
  date: string;
  activity: string;
  note: string;
};

const CUSTOM_RECORDS: Record<string, Partial<MemoryRecord>> = {};

function dateFromFilename(filename: string) {
  const match = filename.match(/(20\d{2})[-_.年]?(\d{2})[-_.月]?(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : "未标记日期";
}

export function getMemoryRecord(media: UniverseMedia, planetTitle: string): MemoryRecord {
  const custom = CUSTOM_RECORDS[media.id];
  const typeLabel = media.type === "video" ? "记录了一段会动的时光" : media.type === "text" ? "写下了一段想留下的话" : "收藏了这一瞬间的光";
  return {
    date: custom?.date ?? media.date ?? dateFromFilename(media.originalName),
    activity: custom?.activity ?? media.note ?? `在「${planetTitle}」里，${typeLabel}`,
    note: custom?.note ?? (media.location ? `地点：${media.location}` : "轻触查看这张记忆的完整记录。"),
  };
}
