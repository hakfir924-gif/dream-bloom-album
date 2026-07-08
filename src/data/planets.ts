export interface PlanetMedia {
  type: "image" | "video";
  url: string;
}

export type PlanetTheme = "birthday" | "sea" | "graduation" | "night" | "daily" | "douyin";

export interface Planet {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  cover: string;
  media: PlanetMedia[];
  color: [string, string, string];
  theme: PlanetTheme;
}

function images(folder: string, count: number): PlanetMedia[] {
  return Array.from({ length: count }, (_, index) => ({
    type: "image",
    url: `/xinxin/${folder}/${String(index + 1).padStart(2, "0")}.jpg`,
  }));
}

function planet(
  id: string,
  title: string,
  folder: string,
  count: number,
  color: [string, string, string],
  theme: PlanetTheme,
  description = "这是一颗安静发光的记忆星球，里面收藏着属于鑫鑫宇宙的一小段温柔时光。",
): Planet {
  return {
    id,
    title,
    date: "2026.07.08",
    location: "鑫鑫宇宙",
    description,
    cover: `/xinxin-thumbs/${folder}/01.jpg`,
    media: images(folder, count),
    color,
    theme,
  };
}

export const planets: Planet[] = [
  planet("memory-02", "夏天的海风", "memory-02", 6, ["#8ee7ff", "#b88cff", "#f7f0ff"], "sea"),
  planet("memory-03", "晚霞很好看", "memory-03", 9, ["#ff9bd8", "#9befff", "#fff0fb"], "daily"),
  planet("memory-04", "生日快乐", "memory-04", 9, ["#ffd166", "#ff79c6", "#fff7d6"], "birthday"),
  planet("memory-05", "夜晚的星光", "memory-05", 4, ["#b698ff", "#8ee7ff", "#fff0fb"], "night"),
  planet("memory-06", "甜甜瞬间", "memory-06", 2, ["#ffb3d9", "#ffe08a", "#caa7ff"], "birthday"),
  planet("memory-07", "一起去海边", "memory-07", 1, ["#89e7ff", "#ff93d5", "#f7f0ff"], "sea"),
  planet("memory-08", "发光日常", "memory-08", 2, ["#ff9bd8", "#ffd18f", "#fff0fb"], "daily"),
  planet("memory-09", "安静浅笑", "memory-09", 4, ["#b88cff", "#ff79c6", "#f7f0ff"], "night"),
  planet("memory-10", "毕业那一天", "memory-10", 4, ["#8ee7ff", "#ffd166", "#fff7d6"], "graduation"),
  planet("memory-11", "樱花季", "memory-11", 9, ["#ff93d5", "#9befff", "#fff0fb"], "daily"),
  planet("memory-12", "金色回忆", "memory-12", 4, ["#ffd18f", "#b698ff", "#fff7d6"], "graduation"),
  planet("memory-13", "闪闪发光", "memory-13", 9, ["#ff79c6", "#8ee7ff", "#fff0fb"], "douyin"),
  planet("memory-14", "温柔花束", "memory-14", 9, ["#caa7ff", "#ffd166", "#f7f0ff"], "birthday"),
  planet("daidai-laozhuo", "呆呆老倬", "daidai-laozhuo", 9, ["#ff9bd8", "#b88cff", "#fff0fb"], "daily", "这一组像一颗慢慢发光的小星球，安静、可爱，又带着一点只属于她的温柔。"),
  planet("soft-moments", "闪光瞬间", "soft-moments", 2, ["#8ee7ff", "#ff93d5", "#f7f0ff"], "daily", "两张照片也可以组成一颗星，因为有些瞬间很轻，却会一直停在记忆里发光。"),
  planet("birthday", "生日", "birthday", 9, ["#ffd166", "#ff79c6", "#fff7d6"], "birthday", "生日这颗星装着祝福、灯光和笑意，像宇宙里专门为她点亮的一圈温柔光晕。"),
  planet("cake", "蛋糕", "cake", 7, ["#ffb3d9", "#ffe08a", "#caa7ff"], "birthday", "甜甜的蛋糕、柔软的光，还有被认真记住的时刻，都藏在这颗星里。"),
];
