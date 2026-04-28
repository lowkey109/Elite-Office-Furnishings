export interface BlogPost {
  id: number;
  slug: string;
  category: string;
  title: string;
  author?: string;
  date?: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  readTime: string;
  publishDate: string;
  excerpt: string;
  content: string;
  internalLinks: Array<{ anchor: string; href: string }>;
  tags: string[];
}
