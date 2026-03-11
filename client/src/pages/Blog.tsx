import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { Search, Clock, ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import { allPosts, categories } from "@/data/blog/index";
import type { BlogPost } from "@/data/blog/types";

const POSTS_PER_PAGE = 12;

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article
        data-testid={`card-blog-${post.id}`}
        className="group bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.25)] rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer h-full flex flex-col"
      >
        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] text-xs">
              {post.category}
            </Badge>
          </div>
          <h2 className="text-white font-serif font-semibold text-lg leading-snug mb-3 group-hover:text-[hsl(43,78%,65%)] transition-colors line-clamp-2">
            {post.title}
          </h2>
          <p className="text-white/45 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
            {post.excerpt}
          </p>
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-1.5 text-white/30 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{post.readTime}</span>
            </div>
            <span className="flex items-center gap-1 text-[hsl(43,78%,65%)] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Read article <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function Blog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Office Furniture Blog — Expert Guides & Insights | The Corporate Desk";
  }, []);

  const filtered = useMemo(() => {
    let posts = allPosts;
    if (category !== "all") posts = posts.filter(p => p.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      posts = posts.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.primaryKeyword.toLowerCase().includes(q)
      );
    }
    return posts;
  }, [search, category]);

  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  function handleCategory(val: string) {
    setCategory(val);
    setPage(1);
  }

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="pt-32 pb-16 bg-[hsl(220,20%,5%)] border-b border-[rgba(201,168,76,0.1)]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center gap-2 text-white/30 text-sm mb-6">
              <Link href="/"><span className="hover:text-white/60 transition-colors cursor-pointer">Home</span></Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white/60">Blog</span>
            </div>
            <div className="max-w-3xl">
              <Badge className="mb-4 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Expert Knowledge Base
              </Badge>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
                Office Furniture<br />
                <span className="gold-text">Guides & Insights</span>
              </h1>
              <p className="text-white/55 text-lg leading-relaxed">
                200 in-depth articles covering every aspect of commercial office furniture, fitout planning, ergonomics, and workplace design for Australian organisations.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/40">
              <span>{allPosts.length} articles</span>
              <span>·</span>
              <span>10 topic clusters</span>
              <span>·</span>
              <span>Expert guidance for commercial fitouts</span>
            </div>
          </div>
        </section>

        <section className="py-10 bg-[hsl(220,20%,6%)] border-b border-[rgba(255,255,255,0.05)] sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            {/* Search */}
            <div className="relative mb-6 max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                data-testid="input-blog-search"
                placeholder="Search articles..."
                className="w-full pl-10 pr-4 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-white text-sm focus:outline-none focus:border-[rgba(201,168,76,0.4)] placeholder:text-white/25"
              />
            </div>
            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => handleCategory(cat.value)}
                  data-testid={`filter-${cat.value.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    category === cat.value
                      ? "bg-[rgba(201,168,76,0.15)] border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)]"
                      : "border-[rgba(255,255,255,0.07)] text-white/45 hover:text-white/70 hover:border-[rgba(255,255,255,0.15)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            {/* Result count */}
            <p className="text-white/35 text-sm mb-8">
              {filtered.length === allPosts.length
                ? `Showing all ${allPosts.length} articles`
                : `${filtered.length} article${filtered.length !== 1 ? "s" : ""} found`}
              {category !== "all" && ` in ${categories.find(c => c.value === category)?.label}`}
              {search && ` for "${search}"`}
            </p>

            {paginated.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="w-12 h-12 text-white/15 mx-auto mb-4" />
                <p className="text-white/35 text-lg mb-2">No articles found</p>
                <p className="text-white/25 text-sm">Try a different search term or category</p>
                <button
                  onClick={() => { setSearch(""); setCategory("all"); setPage(1); }}
                  className="mt-4 text-[hsl(43,78%,65%)] text-sm hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginated.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                  className="px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.08)] text-white/50 text-sm disabled:opacity-30 hover:border-[rgba(201,168,76,0.3)] hover:text-white transition-all"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      data-testid={`button-page-${pageNum}`}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                        page === pageNum
                          ? "bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)]"
                          : "border border-[rgba(255,255,255,0.08)] text-white/50 hover:border-[rgba(201,168,76,0.3)] hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="button-next-page"
                  className="px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.08)] text-white/50 text-sm disabled:opacity-30 hover:border-[rgba(201,168,76,0.3)] hover:text-white transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[hsl(220,20%,5%)] border-t border-[rgba(201,168,76,0.08)]">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-serif font-bold text-white mb-4">Ready to furnish your workspace?</h2>
            <p className="text-white/50 mb-8">Talk to our specialists — free office layout planning, competitive quotes, and expert advice.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/free-office-layout-plan">
                <button data-testid="button-cta-layout-plan" className="px-6 py-3 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold rounded-lg transition-colors text-sm">
                  Get a Free Layout Plan
                </button>
              </Link>
              <Link href="/send-us-your-quote">
                <button data-testid="button-cta-quote" className="px-6 py-3 border border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] font-semibold rounded-lg transition-colors text-sm">
                  Send Us Your Quote
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
