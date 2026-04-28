export interface BlogImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface BlogImageSet {
  hero: BlogImage;
  mid: BlogImage;
  bottom: BlogImage;
}

const FALLBACK_IMAGES = [
  "/images/hero-office.png"
] as const;

const CATEGORY_IMAGE_POOLS: Record<string, string[]> = {
  "office fit-out planning": [],
  "office layout design": [],
  "workplace productivity": [],
  "office relocation": [],
  "boardroom furniture": [],
  "reception furniture": [],
  "ergonomics": [],
  "sustainability": [],
  "office trends": [],
  "buying guides": []
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normaliseCategory(category: string) {
  const c = String(category || "").toLowerCase();

  if (c.includes("fit")) return "office fit-out planning";
  if (c.includes("layout") || c.includes("design")) return "office layout design";
  if (c.includes("productivity") || c.includes("wellbeing")) return "workplace productivity";
  if (c.includes("relocation") || c.includes("move")) return "office relocation";
  if (c.includes("boardroom") || c.includes("meeting")) return "boardroom furniture";
  if (c.includes("reception")) return "reception furniture";
  if (c.includes("ergonomic")) return "ergonomics";
  if (c.includes("sustain")) return "sustainability";
  if (c.includes("trend")) return "office trends";
  if (c.includes("buying") || c.includes("guide")) return "buying guides";

  return "office fit-out planning";
}

function pickImage(postId: string | number, category: string, offset: number) {
  const key = normaliseCategory(category);
  const pool = CATEGORY_IMAGE_POOLS[key]?.length ? CATEGORY_IMAGE_POOLS[key] : [...FALLBACK_IMAGES];
  const index = (hashString(String(postId) + ":" + category) + offset) % pool.length;
  return pool[index] || FALLBACK_IMAGES[0] || "/images/hero-office.png";
}

function categoryAlt(category: string, slot: "hero" | "mid" | "bottom") {
  const key = normaliseCategory(category);
  const label = key.replace(/\b\w/g, (m) => m.toUpperCase());

  if (slot === "hero") return `${label} inspiration for Australian workplaces`;
  if (slot === "mid") return `Practical ${label.toLowerCase()} example for office planning`;
  return `Finished workplace concept showing ${label.toLowerCase()} outcomes`;
}

export function getBlogImages(postId: string | number, category: string): BlogImageSet {
  const hero = pickImage(postId, category, 0);
  const mid = pickImage(postId, category, 3);
  const bottom = pickImage(postId, category, 7);

  return {
    hero: {
      src: hero,
      alt: categoryAlt(category, "hero"),
      caption: "Workplace planning image selected to match the article topic."
    },
    mid: {
      src: mid,
      alt: categoryAlt(category, "mid"),
      caption: "Use layout, furniture and delivery planning together instead of treating them as separate decisions."
    },
    bottom: {
      src: bottom,
      alt: categoryAlt(category, "bottom"),
      caption: "The Corporate Desk helps connect planning, procurement, delivery and finance control."
    }
  };
}
