"use client";

import type { MemoryTheme, UniverseMedia } from "@/components/three-memory-universe";

const DB_NAME = "xinxin-memory-universe";
const DB_VERSION = 2;
const PLANET_STORE = "planets";
const FILE_STORE = "files";
const DIARY_STORE = "diaries";

export type DiaryMood = "happy" | "calm" | "miss" | "sad" | "excited" | "tired";
export type DiaryWeather = "sunny" | "cloudy" | "rainy" | "snowy" | "windy" | "night";

export type LocalDiaryDraft = {
  title: string;
  date: string;
  time: string;
  location: string;
  mood: DiaryMood;
  weather: DiaryWeather;
  body: string;
  quote: string;
  files: File[];
};

type StoredDiaryAttachment = {
  id: string;
  type: "image" | "video";
  blobId: string;
  originalName: string;
};

type StoredDiaryEntry = Omit<LocalDiaryDraft, "files"> & {
  id: string;
  attachments: StoredDiaryAttachment[];
  createdAt: number;
};

export type LocalDiaryEntry = Omit<StoredDiaryEntry, "attachments"> & {
  attachments: UniverseMedia[];
};

export type LocalPlanetDraft = {
  title: string;
  theme: MemoryTheme;
  date: string;
  location: string;
  description: string;
  text: string;
  files: File[];
  mediaDetails: LocalMediaDetail[];
  coverIndex: number | null;
};

export type LocalMediaDetail = {
  date: string;
  location: string;
  note: string;
};

type StoredMedia = {
  id: string;
  type: "image" | "video" | "text";
  blobId?: string;
  originalName: string;
  text?: string;
  date?: string;
  location?: string;
  note?: string;
};

type StoredPlanet = {
  id: string;
  title: string;
  subtitle: string;
  theme: MemoryTheme;
  date: string;
  location: string;
  description: string;
  coverId: string | null;
  items: StoredMedia[];
  createdAt: number;
};

export type LocalMemoryPlanet = Omit<StoredPlanet, "coverId" | "items"> & {
  cover: string | null;
  items: UniverseMedia[];
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PLANET_STORE)) database.createObjectStore(PLANET_STORE, { keyPath: "id" });
      if (!database.objectStoreNames.contains(FILE_STORE)) database.createObjectStore(FILE_STORE);
      if (!database.objectStoreNames.contains(DIARY_STORE)) database.createObjectStore(DIARY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function createLocalPlanet(draft: LocalPlanetDraft) {
  const database = await openDatabase();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const files = draft.files.slice(0, 30);
  const media: StoredMedia[] = files.map((file, index) => ({
    id: `${id}-media-${index}`,
    type: file.type.startsWith("video/") ? "video" : "image",
    blobId: `${id}-blob-${index}`,
    originalName: file.name,
    date: draft.mediaDetails[index]?.date || draft.date,
    location: draft.mediaDetails[index]?.location || draft.location.trim(),
    note: draft.mediaDetails[index]?.note || draft.description.trim(),
  }));

  if (draft.text.trim()) {
    media.push({ id: `${id}-note`, type: "text", originalName: "记忆文字", text: draft.text.trim() });
  }

  const requestedCover = draft.coverIndex !== null ? media[draft.coverIndex] : undefined;
  const cover = (requestedCover?.type === "image" ? requestedCover : media.find((item) => item.type === "image"))?.blobId ?? null;
  const planet: StoredPlanet = {
    id,
    title: draft.title.trim(),
    subtitle: `${files.filter((file) => file.type.startsWith("image/")).length} Photos · ${files.filter((file) => file.type.startsWith("video/")).length} Videos`,
    theme: draft.theme,
    date: draft.date,
    location: draft.location.trim(),
    description: draft.description.trim(),
    coverId: cover,
    items: media,
    createdAt: Date.now(),
  };

  const transaction = database.transaction([PLANET_STORE, FILE_STORE], "readwrite");
  transaction.objectStore(PLANET_STORE).put(planet);
  files.forEach((file, index) => transaction.objectStore(FILE_STORE).put(file, `${id}-blob-${index}`));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

export async function createLocalDiary(draft: LocalDiaryDraft) {
  const database = await openDatabase();
  const id = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const files = draft.files.slice(0, 9);
  const attachments: StoredDiaryAttachment[] = files.map((file, index) => ({
    id: `${id}-attachment-${index}`,
    type: file.type.startsWith("video/") ? "video" : "image",
    blobId: `${id}-blob-${index}`,
    originalName: file.name,
  }));
  const entry: StoredDiaryEntry = {
    id,
    title: draft.title.trim() || "今天的星笺",
    date: draft.date,
    time: draft.time,
    location: draft.location.trim(),
    mood: draft.mood,
    weather: draft.weather,
    body: draft.body.trim(),
    quote: draft.quote.trim(),
    attachments,
    createdAt: Date.now(),
  };
  const transaction = database.transaction([DIARY_STORE, FILE_STORE], "readwrite");
  transaction.objectStore(DIARY_STORE).put(entry);
  files.forEach((file, index) => transaction.objectStore(FILE_STORE).put(file, `${id}-blob-${index}`));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

function localDateOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function seedDemoDiaries() {
  if (typeof window === "undefined" || window.localStorage.getItem("xinxin-demo-diaries-seeded")) return;
  const database = await openDatabase();
  const samples: StoredDiaryEntry[] = [
    {
      id: "demo-diary-sea-wind",
      title: "海风经过的下午",
      date: localDateOffset(-1),
      time: "16:28",
      location: "海边",
      mood: "calm",
      weather: "windy",
      body: "下午沿着海边慢慢走了一段路。风把头发吹得有些乱，海面却很安静。\n\n没有发生什么特别的大事，但那一刻觉得，平凡的一天也值得被好好收藏。",
      quote: "风经过的时候，心也变得很轻。",
      attachments: [],
      createdAt: Date.now() - 86_400_000,
    },
    {
      id: "demo-diary-sunset",
      title: "今天被晚霞拥抱了",
      date: localDateOffset(-3),
      time: "18:47",
      location: "回家的路上",
      mood: "happy",
      weather: "cloudy",
      body: "下班回去的时候，天边突然变成了粉金色。大家都在赶路，只有我停下来多看了一会儿。\n\n原来开心有时不需要理由，只是一片晚霞刚好在等你。",
      quote: "生活偷偷奖励了我一场晚霞。",
      attachments: [],
      createdAt: Date.now() - 259_200_000,
    },
    {
      id: "demo-diary-missing",
      title: "一点小小的想念",
      date: localDateOffset(-6),
      time: "23:12",
      location: "房间",
      mood: "miss",
      weather: "night",
      body: "夜里忽然想起一些以前的事情。那些当时觉得普通的对话，现在回忆起来都带着温柔的光。\n\n想念不是难过，只是某段记忆还在心里轻轻发亮。",
      quote: "有些人不在眼前，却一直住在星光里。",
      attachments: [],
      createdAt: Date.now() - 518_400_000,
    },
    {
      id: "demo-diary-rain",
      title: "雨落在窗边",
      date: localDateOffset(-9),
      time: "21:05",
      location: "家里",
      mood: "tired",
      weather: "rainy",
      body: "今天有一点累，索性把灯调暗，听着雨声坐了一会儿。\n\n不用每天都闪闪发光。允许自己慢下来，也是一种认真生活。",
      quote: "今晚不赶路，只听雨。",
      attachments: [],
      createdAt: Date.now() - 777_600_000,
    },
  ];
  const transaction = database.transaction(DIARY_STORE, "readwrite");
  samples.forEach((entry) => transaction.objectStore(DIARY_STORE).put(entry));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
  window.localStorage.setItem("xinxin-demo-diaries-seeded", "1");
}

export async function loadLocalDiaries(): Promise<LocalDiaryEntry[]> {
  const database = await openDatabase();
  const transaction = database.transaction([DIARY_STORE, FILE_STORE], "readonly");
  const entries = (await requestResult(transaction.objectStore(DIARY_STORE).getAll())) as StoredDiaryEntry[];
  const fileStore = transaction.objectStore(FILE_STORE);
  const hydrated = await Promise.all(entries.sort((a, b) => b.createdAt - a.createdAt).map(async (entry) => {
    const attachments = await Promise.all(entry.attachments.map(async (attachment) => {
      const blob = await requestResult(fileStore.get(attachment.blobId)) as Blob | undefined;
      return {
        id: attachment.id,
        type: attachment.type,
        url: blob ? URL.createObjectURL(blob) : "",
        thumb: null,
        originalName: attachment.originalName,
        date: entry.date,
        location: entry.location,
        note: entry.body,
      } satisfies UniverseMedia;
    }));
    return { ...entry, attachments } satisfies LocalDiaryEntry;
  }));
  database.close();
  return hydrated;
}

export async function deleteLocalDiary(id: string) {
  const database = await openDatabase();
  const readTransaction = database.transaction(DIARY_STORE, "readonly");
  const entry = await requestResult(readTransaction.objectStore(DIARY_STORE).get(id)) as StoredDiaryEntry | undefined;
  if (!entry) {
    database.close();
    return;
  }
  const transaction = database.transaction([DIARY_STORE, FILE_STORE], "readwrite");
  transaction.objectStore(DIARY_STORE).delete(id);
  entry.attachments.forEach((attachment) => transaction.objectStore(FILE_STORE).delete(attachment.blobId));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

export async function loadLocalPlanets(): Promise<LocalMemoryPlanet[]> {
  const database = await openDatabase();
  const transaction = database.transaction([PLANET_STORE, FILE_STORE], "readonly");
  const planets = (await requestResult(transaction.objectStore(PLANET_STORE).getAll())) as StoredPlanet[];
  const fileStore = transaction.objectStore(FILE_STORE);

  const hydrated = await Promise.all(
    planets.sort((a, b) => a.createdAt - b.createdAt).map(async (planet) => {
      const urls = new Map<string, string>();
      await Promise.all(
        planet.items.filter((item) => item.blobId).map(async (item) => {
          const blob = await requestResult(fileStore.get(item.blobId!)) as Blob | undefined;
          if (blob && item.blobId) urls.set(item.blobId, URL.createObjectURL(blob));
        }),
      );
      return {
        ...planet,
        cover: planet.coverId ? urls.get(planet.coverId) ?? null : null,
        items: planet.items.map((item) => ({
          id: item.id,
          type: item.type,
          url: item.blobId ? urls.get(item.blobId) ?? "" : "",
          thumb: null,
          originalName: item.originalName,
          text: item.text,
          date: item.date ?? planet.date,
          location: item.location ?? planet.location,
          note: item.note ?? planet.description,
        })),
      } satisfies LocalMemoryPlanet;
    }),
  );
  database.close();
  return hydrated;
}
