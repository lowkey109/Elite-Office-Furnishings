import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";
import { Clock, ArrowLeft, ArrowRight, ChevronRight, Tag } from "lucide-react";
import { getPostBySlug, getRelatedPosts } from "@/data/blog/index";
import type { BlogPost as BlogPostType } from "@/data/blog/types";
import { getBlogImages } from "@/data/blog/blogImages";
import type { BlogImageSet } from "@/data/blog/blogImages";

function RelatedCard({ post }: { post: BlogPostType }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <div
        data-testid={`card-related-${post.id}`}
        className="group p-5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(201,168,76,0.25)] rounded-xl transition-all cursor-pointer"
      >
        <Badge className="mb-3 bg-[rgba(201,168,76,0.08)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.15)] text-xs">
          {post.category}
        </Badge>
        <h3 className="text-white text-sm font-semibold leading-snug mb-2 group-hover:text-[hsl(43,78%,65%)] transition-colors line-clamp-2">
          {post.title}
        </h3>
        <div className="flex items-center gap-1.5 text-white/30 text-xs">
          <Clock className="w-3 h-3" />
          <span>{post.readTime}</span>
        </div>
      </div>
    </Link>
  );
}

function ArticleImage({ src, alt, caption, testId }: { src: string; alt: string; caption?: string; testId: string }) {
  return (
    <figure data-testid={testId} className="my-8 rounded-xl overflow-hidden">
      <img
        src={src}
        alt={alt}
        className="w-full object-cover rounded-xl"
        style={{ aspectRatio: "16/9" }}
        loading="lazy"
      />
      {caption && (
        <figcaption className="mt-3 text-center text-white/35 text-sm italic leading-relaxed px-4">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function injectImagesIntoContent(html: string, images: BlogImageSet): string {
  const h2Regex = /<h2[\s>]/gi;
  const matches: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = h2Regex.exec(html)) !== null) {
    matches.push(match.index);
  }

  if (matches.length === 0) return html;

  const midImageBlock = `
<figure class="blog-injected-image" style="margin:2rem 0;border-radius:0.75rem;overflow:hidden;">
  <img src="${images.mid.src}" alt="${images.mid.alt}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:0.75rem;" loading="lazy" />
  ${images.mid.caption ? `<figcaption style="margin-top:0.75rem;text-align:center;color:rgba(255,255,255,0.35);font-size:0.875rem;font-style:italic;padding:0 1rem;">${images.mid.caption}</figcaption>` : ""}
</figure>`;

  const bottomImageBlock = `
<figure class="blog-injected-image" style="margin:2rem 0;border-radius:0.75rem;overflow:hidden;">
  <img src="${images.bottom.src}" alt="${images.bottom.alt}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:0.75rem;" loading="lazy" />
  ${images.bottom.caption ? `<figcaption style="margin-top:0.75rem;text-align:center;color:rgba(255,255,255,0.35);font-size:0.875rem;font-style:italic;padding:0 1rem;">${images.bottom.caption}</figcaption>` : ""}
</figure>`;

  const midInsertIdx = matches.length >= 3 ? matches[Math.floor(matches.length / 3)] : matches[0];
  const bottomInsertIdx = matches.length >= 2 ? matches[Math.floor((matches.length * 2) / 3)] : null;

  let result = html;
  let offset = 0;

  const insertAt = (idx: number, block: string) => {
    result = result.slice(0, idx + offset) + block + result.slice(idx + offset);
    offset += block.length;
  };

  insertAt(midInsertIdx, midImageBlock);
  if (bottomInsertIdx && bottomInsertIdx !== midInsertIdx) {
    insertAt(bottomInsertIdx, bottomImageBlock);
  }

  return result;
}

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const post = getPostBySlug(params.slug);

  // Compute images synchronously — needed both for SEO and rendering
  const images = post ? getBlogImages(post.id, post.category) : null;

  // ── Comprehensive SEO: meta tags + JSON-LD Article + BreadcrumbList ───────
  useEffect(() => {
    if (!post) return;
    window.scrollTo(0, 0);

    const BASE = "https://www.thecorporatedesk.com.au";
    const pageUrl = `${BASE}/blog/${post.slug}`;
    const heroImg = images?.hero?.src
      ? (images.hero.src.startsWith("http") ? images.hero.src : `${BASE}${images.hero.src}`)
      : `${BASE}/images/hero-office.png`;
    const desc = (post.metaDescription || post.excerpt || post.title).slice(0, 160);
    const keywords = [post.primaryKeyword, ...(post.secondaryKeywords || []), ...(post.tags || [])].filter(Boolean).join(", ");
    const wordCount = post.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

    // Document title
    document.title = `${post.title} | The Corporate Desk Blog`;

    // Helper: upsert a meta tag
    const setMeta = (attrKey: string, attrVal: string, content: string) => {
      let el = document.querySelector(`meta[${attrKey}="${attrVal}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attrKey, attrVal); document.head.appendChild(el); }
      el.content = content;
    };

    // Standard meta
    setMeta("name", "description", desc);
    setMeta("name", "keywords", keywords);

    // Open Graph
    setMeta("property", "og:type", "article");
    setMeta("property", "og:title", `${post.title} | The Corporate Desk`);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", pageUrl);
    setMeta("property", "og:image", heroImg);
    setMeta("property", "og:image:alt", post.title);
    setMeta("property", "og:site_name", "The Corporate Desk");
    setMeta("property", "og:locale", "en_AU");
    setMeta("property", "article:section", post.category);
    if (post.publishDate) setMeta("property", "article:published_time", post.publishDate);

    // Twitter
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", `${post.title} | The Corporate Desk`);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", heroImg);

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = pageUrl;

    // Article JSON-LD
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": pageUrl,
      headline: post.title,
      description: desc,
      keywords,
      articleSection: post.category,
      wordCount,
      timeRequired: post.readTime,
      ...(post.publishDate ? { datePublished: post.publishDate, dateModified: post.publishDate } : {}),
      image: { "@type": "ImageObject", url: heroImg, caption: post.title },
      url: pageUrl,
      mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
      author: {
        "@type": "Organization",
        name: "The Corporate Desk",
        url: BASE,
      },
      publisher: {
        "@type": "Organization",
        name: "The Corporate Desk",
        url: BASE,
        logo: { "@type": "ImageObject", url: `${BASE}/favicon.png` },
      },
      inLanguage: "en-AU",
      isPartOf: { "@type": "Blog", name: "The Corporate Desk Blog", url: `${BASE}/blog` },
    };

    // Breadcrumb JSON-LD
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: pageUrl },
      ],
    };

    const injectSchema = (id: string, schema: object) => {
      document.getElementById(id)?.remove();
      const script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    };
    injectSchema("blog-jsonld", articleSchema);
    injectSchema("blog-breadcrumb-jsonld", breadcrumbSchema);

    return () => {
      document.getElementById("blog-jsonld")?.remove();
      document.getElementById("blog-breadcrumb-jsonld")?.remove();
      canonical?.remove();
      // Reset og:type back to website when leaving a blog post
      setMeta("property", "og:type", "website");
    };
  }, [post, images]);

  if (!post) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-serif font-bold text-white mb-4">Article Not Found</h1>
            <p className="text-white/50 mb-6">This article doesn't exist or has been moved.</p>
            <Link href="/blog">
              <button className="px-5 py-2.5 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-semibold rounded-lg text-sm">
                Back to Blog
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const related = getRelatedPosts(post, 3);
  const enrichedContent = injectImagesIntoContent(post.content, images!);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Article header */}
        <section className="pt-28 pb-10 bg-[hsl(220,20%,5%)] border-b border-[rgba(201,168,76,0.1)]">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-white/30 text-sm mb-8 flex-wrap">
              <Link href="/"><span className="hover:text-white/60 transition-colors cursor-pointer">Home</span></Link>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              <Link href="/blog"><span className="hover:text-white/60 transition-colors cursor-pointer">Blog</span></Link>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-white/50">{post.category}</span>
            </div>

            <Badge className="mb-5 bg-[rgba(201,168,76,0.1)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)]">
              {post.category}
            </Badge>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white leading-tight mb-6">
              {post.title}
            </h1>

            <p className="text-white/55 text-lg leading-relaxed mb-6 max-w-3xl">
              {post.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/40">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{post.readTime}</span>
              </div>
              <span>·</span>
              <span>Published {new Date(post.publishDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</span>
              <span>·</span>
              <span>The Corporate Desk Editorial Team</span>
            </div>
          </div>
        </section>

        {/* Hero image — below the header, full-width within content column */}
        <div className="bg-[hsl(220,20%,5%)] pb-0">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <ArticleImage
              src={images.hero.src}
              alt={images.hero.alt}
              caption={images.hero.caption}
              testId={`img-hero-${post.id}`}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
            {/* Article body */}
            <article>
              <div
                data-testid="article-content"
                className="prose-blog"
                dangerouslySetInnerHTML={{ __html: enrichedContent }}
              />

              {/* Tags */}
              <div className="mt-10 pt-8 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-white/30" />
                  {post.tags.map(tag => (
                    <Link key={tag} href={`/blog?search=${encodeURIComponent(tag)}`}>
                      <span
                        data-testid={`tag-${tag}`}
                        className="px-3 py-1 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-white/40 text-xs hover:text-white/70 hover:border-[rgba(201,168,76,0.2)] transition-all cursor-pointer"
                      >
                        {tag}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Internal links */}
              {post.internalLinks.length > 0 && (
                <div className="mt-8 p-5 bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.12)] rounded-xl">
                  <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm mb-3">Related Resources</h3>
                  <div className="space-y-2">
                    {post.internalLinks.map(link => (
                      <Link key={link.href} href={link.href}>
                        <div className="flex items-center gap-2 text-white/60 hover:text-white transition-colors cursor-pointer text-sm">
                          <ArrowRight className="w-3.5 h-3.5 text-[hsl(43,78%,52%)] flex-shrink-0" />
                          {link.anchor}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-10 p-8 bg-gradient-to-br from-[rgba(201,168,76,0.08)] to-[rgba(201,168,76,0.03)] border border-[rgba(201,168,76,0.15)] rounded-2xl text-center">
                <h3 className="text-white font-serif font-bold text-xl mb-2">Ready to furnish your workspace?</h3>
                <p className="text-white/50 text-sm mb-5">Speak with our commercial furniture specialists. Free layout planning, competitive quotes, expert guidance.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/free-office-layout-plan">
                    <button data-testid="button-article-cta-layout" className="px-5 py-2.5 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold rounded-lg transition-colors text-sm">
                      Free Layout Plan
                    </button>
                  </Link>
                  <Link href="/send-us-your-quote">
                    <button data-testid="button-article-cta-quote" className="px-5 py-2.5 border border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] font-semibold rounded-lg transition-colors text-sm">
                      Get a Quote
                    </button>
                  </Link>
                </div>
              </div>

              {/* Back link */}
              <div className="mt-8">
                <Link href="/blog">
                  <button data-testid="button-back-to-blog" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
                    <ArrowLeft className="w-4 h-4" />
                    Back to all articles
                  </button>
                </Link>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-8">
              {/* About this article */}
              <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">About This Article</h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-white/35 text-xs uppercase tracking-wide mb-1">Topic</dt>
                    <dd className="text-white/70">{post.category}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35 text-xs uppercase tracking-wide mb-1">Read Time</dt>
                    <dd className="text-white/70">{post.readTime}</dd>
                  </div>
                  <div>
                    <dt className="text-white/35 text-xs uppercase tracking-wide mb-1">Published</dt>
                    <dd className="text-white/70">
                      {new Date(post.publishDate).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/35 text-xs uppercase tracking-wide mb-1">Primary Topic</dt>
                    <dd className="text-white/70 text-xs">{post.primaryKeyword}</dd>
                  </div>
                </dl>
              </div>

              {/* Quick actions */}
              <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.12)] rounded-xl p-5">
                <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm mb-3">Get Expert Help</h3>
                <p className="text-white/45 text-xs mb-4 leading-relaxed">Our team can help you apply these insights to your specific project.</p>
                <div className="space-y-2.5">
                  <Link href="/free-office-layout-plan">
                    <div className="w-full text-left px-3.5 py-2.5 bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold rounded-lg transition-colors text-xs cursor-pointer">
                      Free Layout Plan
                    </div>
                  </Link>
                  <Link href="/workplace-strategy">
                    <div className="w-full text-left px-3.5 py-2.5 border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] font-semibold rounded-lg transition-colors text-xs cursor-pointer">
                      Book a Strategy Call
                    </div>
                  </Link>
                  <Link href="/quote-builder">
                    <div className="w-full text-left px-3.5 py-2.5 border border-[rgba(255,255,255,0.08)] text-white/50 hover:text-white hover:border-[rgba(255,255,255,0.15)] font-semibold rounded-lg transition-colors text-xs cursor-pointer">
                      Quote Builder
                    </div>
                  </Link>
                </div>
              </div>

              {/* Related articles */}
              {related.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-4">Related Articles</h3>
                  <div className="space-y-3">
                    {related.map(r => (
                      <RelatedCard key={r.id} post={r} />
                    ))}
                  </div>
                  <Link href={`/blog?category=${encodeURIComponent(post.category)}`}>
                    <div className="mt-4 flex items-center gap-1.5 text-[hsl(43,78%,65%)] text-xs hover:underline cursor-pointer">
                      More {post.category} articles <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}
