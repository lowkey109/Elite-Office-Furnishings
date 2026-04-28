import { strategicPlanningExpansionPosts } from "./strategicPlanningExpansion";
import { buyingGuides } from "./buyingGuides";
import { fitout } from "./fitout";
import { layout } from "./layout";
import { productivity } from "./productivity";
import { relocation } from "./relocation";
import { ergonomics } from "./ergonomics";
import { reception } from "./reception";
import { boardroom } from "./boardroom";
import { trends } from "./trends";
import { sustainability } from "./sustainability";
import type { BlogPost } from "./types";

export const allPosts: BlogPost[] = [
  
  ...strategicPlanningExpansionPosts,
...buyingGuides,
  ...fitout,
  ...layout,
  ...productivity,
  ...relocation,
  ...ergonomics,
  ...reception,
  ...boardroom,
  ...trends,
  ...sustainability,
].sort((a, b) => a.id - b.id);

export const categories = [
  { label: "All Articles", value: "all" },
  { label: "Buying Guides", value: "Buying Guides" },
  { label: "Fitout Planning", value: "Fitout Planning" },
  { label: "Layout Design", value: "Layout Design" },
  { label: "Productivity", value: "Productivity" },
  { label: "Office Relocation", value: "Office Relocation" },
  { label: "Ergonomics", value: "Ergonomics" },
  { label: "Reception Design", value: "Reception Design" },
  { label: "Boardroom Design", value: "Boardroom Design" },
  { label: "Office Design Trends", value: "Office Design Trends" },
  { label: "Sustainable Offices", value: "Sustainable Offices" },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return allPosts.find(p => p.slug === slug);
}

export function getPostsByCategory(category: string): BlogPost[] {
  if (category === "all") return allPosts;
  return allPosts.filter(p => p.category === category);
}

export function getRelatedPosts(post: BlogPost, count = 3): BlogPost[] {
  return allPosts
    .filter(p => p.id !== post.id && p.category === post.category)
    .slice(0, count);
}

export type { BlogPost };
