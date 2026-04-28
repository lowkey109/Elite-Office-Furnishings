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

const BLOG_IMAGES = [
  "/images/blog/5-1774166138986.jpg",
  "/images/blog/6-1774166138986.jpg",
  "/images/blog/7-1774166138986.jpg",
  "/images/blog/8-1774166138986.jpg",
  "/images/blog/9-1774166138986.jpg",
  "/images/blog/10-1774166138986.jpg",
  "/images/blog/12-1774166138986.jpg",
  "/images/blog/13-1774166138986.jpg",
  "/images/blog/14-1774166138986.jpg",
  "/images/blog/15-1774166138986.jpg",
  "/images/blog/tcd-of-001.png",
  "/images/blog/tcd-of-002.png",
  "/images/blog/tcd-of-003.png",
  "/images/blog/tcd-of-004.jpg",
  "/images/blog/tcd-of-005.jpg",
  "/images/blog/tcd-rs-001.png",
  "/images/blog/tcd-rs-002.png",
  "/images/blog/tcd-rs-003.jpg",
  "/images/blog/tcd-ts-001.jpg",
  "/images/blog/tcd-ts-002.jpg"
] as const;

const CATEGORY_IMAGE_POOLS: Record<string, string[]> = {
  "office fit-out planning": BLOG_IMAGES.slice(0, 10),
  "office layout design": BLOG_IMAGES.slice(2, 14),
  "workplace productivity": BLOG_IMAGES.slice(4, 16),
  "office relocation": BLOG_IMAGES.slice(0, 12),
  "boardroom furniture": BLOG_IMAGES.slice(10, 20),
  "reception furniture": BLOG_IMAGES.slice(14, 20),
  "ergonomics": BLOG_IMAGES.slice(8, 18),
  "sustainability": BLOG_IMAGES.slice(2, 16),
  "office trends": BLOG_IMAGES.slice(0, 20),
  "buying guides": BLOG_IMAGES.slice(10, 20)
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
  const pool = CATEGORY_IMAGE_POOLS[key]?.length ? CATEGORY_IMAGE_POOLS[key] : [...BLOG_IMAGES];
  const index = (hashString(String(postId) + ":" + category) + offset) % pool.length;
  return pool[index] || BLOG_IMAGES[0] || "/images/blog/tcd-of-001.png";
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
  const mid = pickImage(postId, category, 5);
  const bottom = pickImage(postId, category, 11);

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
