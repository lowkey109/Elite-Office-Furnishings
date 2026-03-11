# The Corporate Desk — WordPress Integration Guide

## Architecture Overview

```
thecorporatedesk.com.au        (WordPress — main website)
app.thecorporatedesk.com.au    (React/Express app — tools & admin)
```

The WordPress site handles marketing content, SEO, and conversion pages.
The React app handles interactive tools, admin, AI features, and the chatbot API.

---

## What Stays in the App vs WordPress

### Keep in the React App (`app.thecorporatedesk.com.au`)

| URL | Tool | Why |
|-----|------|-----|
| `/quote-builder` | Interactive Quote Builder | Multi-step AI form, real-time calculations, OpenAI integration |
| `/finance-your-workspace` | Finance Calculator | Dynamic calculations, sliders |
| `/embed/quote-builder` | Quote Builder (iframe embed) | Embeddable in WordPress, no nav/footer |
| `/embed/finance-your-workspace` | Finance Calculator (iframe embed) | Embeddable in WordPress, no nav/footer |
| `/admin/dashboard` | Admin Dashboard | Sensitive — never embed in WP |
| `/admin/leads` | Lead Intelligence | Sensitive — never embed in WP |
| `/admin/supplier-quotes` | Supplier Quote Management | Sensitive — never embed in WP |
| `/admin/marketing` | Marketing Hub | Sensitive — never embed in WP |
| `/api/*` | All API endpoints | Backend only |

### Rebuild in WordPress (Elementor)

| WordPress Page | Content |
|----------------|---------|
| `/` (Home) | Hero, product teasers, testimonials, CTAs |
| `/about` | Company story, values, timeline |
| `/products` | Product catalog (static or WooCommerce) |
| `/workplace-solutions` | Service options, 3-path funnel |
| `/case-studies` | Project showcase |
| `/testimonials` | Client reviews |
| `/blog` | WordPress native blog |
| `/contact` | Contact form (WPForms/CF7 + Elementor) |
| `/free-office-layout-plan` | Lead capture form (WPForms) |
| `/send-us-your-quote` | Lead capture form (WPForms) |
| `/workplace-strategy` | Lead capture form + booking |

---

## DNS & Subdomain Setup

### Step 1 — Add DNS Record

In your domain registrar (Cloudflare, GoDaddy, etc.), add a CNAME record:

```
Type:   CNAME
Name:   app
Target: <your-replit-deployment-url>.replit.app
TTL:    Auto
```

If using Cloudflare: set the proxy to **DNS only** (grey cloud) initially, then enable proxy after confirming it works.

### Step 2 — Configure Custom Domain in Replit

1. Go to your Repl → **Deployments** tab
2. Click **Custom Domains**
3. Add: `app.thecorporatedesk.com.au`
4. Replit will provision an SSL certificate automatically

### Step 3 — Verify

After DNS propagates (5–60 minutes), visit:
```
https://app.thecorporatedesk.com.au/api/health
```
Should return: `{"status":"ok","timestamp":"...","email":false}`

---

## WordPress Setup Checklist

### Plugins to Install

| Plugin | Purpose |
|--------|---------|
| Elementor Pro | Page builder |
| WPForms or Gravity Forms | Lead capture forms |
| Rank Math or Yoast SEO | SEO |
| WP Rocket | Performance/caching |
| Cloudflare (if applicable) | CDN |

### WordPress Pages to Create

Create these pages in WordPress with the listed slugs:

| Page Title | Slug | Template |
|------------|------|----------|
| Home | `/` | Custom (Elementor) |
| About Us | `/about` | Elementor |
| Products | `/products` | Elementor |
| Workplace Solutions | `/workplace-solutions` | Elementor |
| Quote Builder | `/quote-builder` | Elementor — embeds app |
| Finance Your Workspace | `/finance-your-workspace` | Elementor — embeds app |
| Case Studies | `/case-studies` | Elementor |
| Testimonials | `/testimonials` | Elementor |
| Contact | `/contact` | WPForms |
| Free Layout Plan | `/free-office-layout-plan` | WPForms lead form |
| Send Us Your Quote | `/send-us-your-quote` | WPForms lead form |
| Workplace Strategy | `/workplace-strategy` | WPForms + booking |
| Blog | `/blog` | WordPress Blog |

---

## Chatbot Widget — Embed in WordPress

### Method: Script Tag (Recommended)

Add this to your WordPress site via **Appearance → Theme Editor → functions.php** or a plugin like **Insert Headers and Footers**:

```php
function tcd_chatbot_widget() {
    echo '<script src="https://app.thecorporatedesk.com.au/chatbot-widget.js" defer></script>';
}
add_action('wp_footer', 'tcd_chatbot_widget');
```

Or directly in Elementor: go to **Elementor → Custom Code** (Elementor Pro) and paste:

```html
<script src="https://app.thecorporatedesk.com.au/chatbot-widget.js" defer></script>
```

The chatbot widget will:
- Show a gold floating chat button (bottom-right)
- Display a branded chat panel with streaming AI responses
- Show an unread badge after 8 seconds to draw attention
- Work on all WordPress pages automatically

---

## Embedding Tools in WordPress via iFrame

### Quote Builder Embed

On your WordPress `/quote-builder` page, add an **HTML widget** in Elementor with this code:

```html
<style>
  .tcd-embed-wrap {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.25);
  }
  .tcd-embed-wrap iframe {
    width: 100%;
    min-height: 900px;
    border: none;
    display: block;
    background: #0a0c11;
  }
</style>

<div class="tcd-embed-wrap">
  <iframe
    src="https://app.thecorporatedesk.com.au/embed/quote-builder"
    title="Office Furniture Quote Builder"
    allow="clipboard-write"
    loading="lazy">
  </iframe>
</div>

<script>
  /* Auto-resize iframe height to fit content */
  window.addEventListener('message', function(e) {
    if (e.origin !== 'https://app.thecorporatedesk.com.au') return;
    if (e.data && e.data.type === 'tcd-resize') {
      var iframe = document.querySelector('.tcd-embed-wrap iframe');
      if (iframe) iframe.style.minHeight = e.data.height + 'px';
    }
  });
</script>
```

### Finance Calculator Embed

On your WordPress `/finance-your-workspace` page:

```html
<style>
  .tcd-finance-embed {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.25);
  }
  .tcd-finance-embed iframe {
    width: 100%;
    min-height: 1100px;
    border: none;
    display: block;
    background: #0a0c11;
  }
</style>

<div class="tcd-finance-embed">
  <iframe
    src="https://app.thecorporatedesk.com.au/embed/finance-your-workspace"
    title="Office Finance Calculator"
    loading="lazy">
  </iframe>
</div>
```

---

## HTML/CSS Blocks for Elementor

Copy and paste these into Elementor's **HTML widget**. They use inline styles to match the TCD brand without requiring a child theme.

---

### BLOCK 1 — Hero Section

```html
<style>
  .tcd-hero {
    min-height: 100vh;
    background: linear-gradient(135deg, #080b10 0%, #0d1018 60%, #12170f 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 120px 24px 80px;
    position: relative;
    overflow: hidden;
  }
  .tcd-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,168,76,0.07) 0%, transparent 70%);
    pointer-events: none;
  }
  .tcd-hero-eyebrow {
    font-size: 11px;
    letter-spacing: 0.25em;
    color: #C9A84C;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  .tcd-hero-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(42px, 7vw, 84px);
    font-weight: 700;
    color: #ffffff;
    line-height: 1.08;
    margin-bottom: 24px;
    letter-spacing: -0.02em;
  }
  .tcd-hero-title .tcd-gold { color: #C9A84C; }
  .tcd-hero-subtitle {
    font-size: 18px;
    color: rgba(255,255,255,0.55);
    max-width: 560px;
    margin: 0 auto 48px;
    line-height: 1.65;
  }
  .tcd-hero-ctas { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .tcd-btn-primary {
    background: #C9A84C;
    color: #080b10;
    font-weight: 700;
    font-size: 14px;
    padding: 16px 32px;
    border-radius: 6px;
    text-decoration: none;
    letter-spacing: 0.04em;
    transition: background 0.2s;
  }
  .tcd-btn-primary:hover { background: #D4B96A; }
  .tcd-btn-outline {
    background: transparent;
    border: 1px solid rgba(201,168,76,0.35);
    color: rgba(201,168,76,0.9);
    font-weight: 600;
    font-size: 14px;
    padding: 16px 32px;
    border-radius: 6px;
    text-decoration: none;
    letter-spacing: 0.03em;
    transition: border-color 0.2s;
  }
  .tcd-btn-outline:hover { border-color: rgba(201,168,76,0.7); }
  .tcd-hero-badges {
    margin-top: 56px;
    display: flex;
    gap: 32px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .tcd-hero-badge {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tcd-hero-badge strong { color: rgba(201,168,76,0.7); }
</style>

<section class="tcd-hero">
  <div>
    <div class="tcd-hero-eyebrow">Australia's Premium Office Furniture</div>
    <h1 class="tcd-hero-title">
      Where Ambition<br>Meets <span class="tcd-gold">Design</span>
    </h1>
    <p class="tcd-hero-subtitle">
      Commercial office fitouts for Australia's most ambitious businesses.
      From $30K executive suites to $300K+ full fitouts.
    </p>
    <div class="tcd-hero-ctas">
      <a href="/free-office-layout-plan" class="tcd-btn-primary">Get a Free Layout Plan</a>
      <a href="/quote-builder" class="tcd-btn-outline">Build Your Quote</a>
    </div>
    <div class="tcd-hero-badges">
      <span class="tcd-hero-badge"><strong>ISO 9001</strong> Certified</span>
      <span class="tcd-hero-badge"><strong>6-Year</strong> Warranty</span>
      <span class="tcd-hero-badge"><strong>500+</strong> Projects</span>
      <span class="tcd-hero-badge"><strong>100%</strong> Australian Owned</span>
    </div>
  </div>
</section>
```

---

### BLOCK 2 — Why Choose TCD (Features Section)

```html
<style>
  .tcd-features { background: #080b10; padding: 96px 24px; }
  .tcd-features-inner { max-width: 1120px; margin: 0 auto; }
  .tcd-section-eyebrow {
    text-align: center;
    font-size: 11px;
    letter-spacing: 0.25em;
    color: #C9A84C;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .tcd-section-title {
    text-align: center;
    font-family: Georgia, serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 16px;
  }
  .tcd-section-divider {
    width: 48px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #C9A84C, transparent);
    margin: 0 auto 64px;
  }
  .tcd-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
  }
  .tcd-feature-card {
    background: #0d1118;
    border: 1px solid rgba(201,168,76,0.1);
    border-radius: 12px;
    padding: 32px 28px;
    transition: border-color 0.2s;
  }
  .tcd-feature-card:hover { border-color: rgba(201,168,76,0.3); }
  .tcd-feature-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    font-size: 22px;
  }
  .tcd-feature-title {
    font-family: Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 10px;
  }
  .tcd-feature-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    line-height: 1.65;
  }
</style>

<section class="tcd-features">
  <div class="tcd-features-inner">
    <div class="tcd-section-eyebrow">Why The Corporate Desk</div>
    <h2 class="tcd-section-title">Built for Business Leaders</h2>
    <div class="tcd-section-divider"></div>
    <div class="tcd-features-grid">
      <div class="tcd-feature-card">
        <div class="tcd-feature-icon">🏅</div>
        <div class="tcd-feature-title">ISO 9001 Quality</div>
        <p class="tcd-feature-desc">Manufacturer ISO 9001:2015 certified. Every product engineered to AS/NZS Australian standards for commercial use.</p>
      </div>
      <div class="tcd-feature-card">
        <div class="tcd-feature-icon">🛡️</div>
        <div class="tcd-feature-title">6-Year Warranty</div>
        <p class="tcd-feature-desc">Industry-leading 6-year manufacturer's warranty on all furniture. The strongest warranty in the Australian market.</p>
      </div>
      <div class="tcd-feature-card">
        <div class="tcd-feature-icon">🚚</div>
        <div class="tcd-feature-title">National Delivery</div>
        <p class="tcd-feature-desc">Metro delivery included in project pricing. Serving Brisbane, Sydney, Melbourne, and all states nationally.</p>
      </div>
      <div class="tcd-feature-card">
        <div class="tcd-feature-icon">📐</div>
        <div class="tcd-feature-title">Full Project Management</div>
        <p class="tcd-feature-desc">From initial concept to final installation. We manage the entire fitout process so you don't have to.</p>
      </div>
    </div>
  </div>
</section>
```

---

### BLOCK 3 — Three-Path Workplace Solutions CTA

```html
<style>
  .tcd-solutions { background: #0a0d14; padding: 96px 24px; }
  .tcd-solutions-inner { max-width: 1120px; margin: 0 auto; }
  .tcd-solutions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    margin-top: 64px;
  }
  .tcd-solution-card {
    background: #0d1118;
    border: 1px solid rgba(201,168,76,0.12);
    border-radius: 14px;
    padding: 36px 32px;
    position: relative;
    transition: border-color 0.2s, transform 0.2s;
    text-decoration: none;
    display: block;
  }
  .tcd-solution-card:hover { border-color: rgba(201,168,76,0.4); transform: translateY(-3px); }
  .tcd-solution-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: rgba(201,168,76,0.12);
    color: #C9A84C;
    border: 1px solid rgba(201,168,76,0.25);
    border-radius: 4px;
    padding: 3px 10px;
    margin-bottom: 18px;
  }
  .tcd-solution-title {
    font-family: Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .tcd-solution-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    line-height: 1.65;
    margin-bottom: 28px;
  }
  .tcd-solution-features { list-style: none; padding: 0; margin: 0 0 28px; }
  .tcd-solution-features li {
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    padding: 5px 0;
    padding-left: 18px;
    position: relative;
  }
  .tcd-solution-features li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: #C9A84C;
    font-size: 12px;
  }
  .tcd-solution-cta {
    font-size: 13px;
    font-weight: 700;
    color: #C9A84C;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tcd-solution-card.tcd-featured { border-color: rgba(201,168,76,0.35); background: rgba(201,168,76,0.04); }
</style>

<section class="tcd-solutions">
  <div class="tcd-solutions-inner">
    <div class="tcd-section-eyebrow">How We Work</div>
    <h2 class="tcd-section-title">Choose Your Starting Point</h2>
    <div class="tcd-section-divider"></div>
    <div class="tcd-solutions-grid">
      <a href="/free-office-layout-plan" class="tcd-solution-card">
        <div class="tcd-solution-badge">Free Service</div>
        <div class="tcd-solution-title">Free Office Layout Plan</div>
        <p class="tcd-solution-desc">Get a professional CAD floor plan tailored to your space — at no cost and no obligation.</p>
        <ul class="tcd-solution-features">
          <li>Expert space planning</li>
          <li>Furniture recommendations</li>
          <li>Delivered within 48–72 hours</li>
        </ul>
        <div class="tcd-solution-cta">Request Free Plan →</div>
      </a>
      <a href="/send-us-your-quote" class="tcd-solution-card tcd-featured">
        <div class="tcd-solution-badge">Most Popular</div>
        <div class="tcd-solution-title">Send Us Your Quote Request</div>
        <p class="tcd-solution-desc">Tell us what you need. We'll match the right products and pricing within 24 business hours.</p>
        <ul class="tcd-solution-features">
          <li>Detailed line-item quotes</li>
          <li>Multiple product options</li>
          <li>Response within 24 hours</li>
        </ul>
        <div class="tcd-solution-cta">Get a Quote →</div>
      </a>
      <a href="/workplace-strategy" class="tcd-solution-card">
        <div class="tcd-solution-badge">For Large Projects</div>
        <div class="tcd-solution-title">Book a Strategy Call</div>
        <p class="tcd-solution-desc">A 30-minute consultation with a senior workplace consultant for complex or large-scale projects.</p>
        <ul class="tcd-solution-features">
          <li>Project roadmap</li>
          <li>Budget scoping</li>
          <li>Tailored recommendations</li>
        </ul>
        <div class="tcd-solution-cta">Book Now →</div>
      </a>
    </div>
  </div>
</section>
```

---

### BLOCK 4 — Case Studies Highlight

```html
<style>
  .tcd-cases { background: #080b10; padding: 96px 24px; }
  .tcd-cases-inner { max-width: 1120px; margin: 0 auto; }
  .tcd-cases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
    margin-top: 64px;
  }
  .tcd-case-card {
    background: #0d1118;
    border: 1px solid rgba(201,168,76,0.1);
    border-radius: 14px;
    padding: 32px 28px;
    transition: border-color 0.2s;
  }
  .tcd-case-card:hover { border-color: rgba(201,168,76,0.3); }
  .tcd-case-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .tcd-tag {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 3px;
  }
  .tcd-tag-industry { background: rgba(201,168,76,0.1); color: #C9A84C; border: 1px solid rgba(201,168,76,0.2); }
  .tcd-tag-series { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.45); border: 1px solid rgba(255,255,255,0.08); }
  .tcd-case-title {
    font-family: Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 6px;
  }
  .tcd-case-location { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 16px; letter-spacing: 0.05em; }
  .tcd-case-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  .tcd-case-stat { background: rgba(201,168,76,0.04); border: 1px solid rgba(201,168,76,0.08); border-radius: 8px; padding: 12px; }
  .tcd-case-stat-value { font-size: 18px; font-weight: 700; color: #C9A84C; }
  .tcd-case-stat-label { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
  .tcd-case-excerpt { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.65; }
</style>

<section class="tcd-cases">
  <div class="tcd-cases-inner">
    <div class="tcd-section-eyebrow">Real Projects. Real Results.</div>
    <h2 class="tcd-section-title">Recent Case Studies</h2>
    <div class="tcd-section-divider"></div>
    <div class="tcd-cases-grid">
      <div class="tcd-case-card">
        <div class="tcd-case-meta">
          <span class="tcd-tag tcd-tag-industry">Legal</span>
          <span class="tcd-tag tcd-tag-series">Aimu Series</span>
        </div>
        <div class="tcd-case-title">Whitmore & Associates</div>
        <div class="tcd-case-location">Brisbane CBD, QLD</div>
        <div class="tcd-case-stats">
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">$240K</div><div class="tcd-case-stat-label">Project Value</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">40</div><div class="tcd-case-stat-label">Staff Fitted</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">9wks</div><div class="tcd-case-stat-label">Completion</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">100%</div><div class="tcd-case-stat-label">On Schedule</div></div>
        </div>
        <p class="tcd-case-excerpt">Complete law firm fitout featuring Aimu executive desks, custom boardroom, and premium reception suite across 5 levels.</p>
      </div>
      <div class="tcd-case-card">
        <div class="tcd-case-meta">
          <span class="tcd-tag tcd-tag-industry">Technology</span>
          <span class="tcd-tag tcd-tag-series">Breeze Series</span>
        </div>
        <div class="tcd-case-title">NovaTech Solutions</div>
        <div class="tcd-case-location">Melbourne Southbank, VIC</div>
        <div class="tcd-case-stats">
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">$290K</div><div class="tcd-case-stat-label">Project Value</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">120</div><div class="tcd-case-stat-label">Staff Fitted</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">12wks</div><div class="tcd-case-stat-label">Completion</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">ABW</div><div class="tcd-case-stat-label">Workspace Model</div></div>
        </div>
        <p class="tcd-case-excerpt">Activity-based workspace transformation with Breeze workstations, acoustic pods, and collaborative breakout zones.</p>
      </div>
      <div class="tcd-case-card">
        <div class="tcd-case-meta">
          <span class="tcd-tag tcd-tag-industry">Finance</span>
          <span class="tcd-tag tcd-tag-series">Aimu Series</span>
        </div>
        <div class="tcd-case-title">Crestfield Capital</div>
        <div class="tcd-case-location">Sydney CBD, NSW</div>
        <div class="tcd-case-stats">
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">$185K</div><div class="tcd-case-stat-label">Project Value</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">28</div><div class="tcd-case-stat-label">Executive Seats</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">7wks</div><div class="tcd-case-stat-label">Completion</div></div>
          <div class="tcd-case-stat"><div class="tcd-case-stat-value">CBD</div><div class="tcd-case-stat-label">Location</div></div>
        </div>
        <p class="tcd-case-excerpt">Executive floor fitout for a boutique investment firm — Aimu desks, premium leather seating, and glass-partitioned boardroom.</p>
      </div>
    </div>
    <div style="text-align:center;margin-top:48px;">
      <a href="/case-studies" style="display:inline-block;border:1px solid rgba(201,168,76,0.3);color:rgba(201,168,76,0.9);font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:0.04em;">View All Case Studies →</a>
    </div>
  </div>
</section>
```

---

### BLOCK 5 — Full-Bleed CTA Banner

```html
<style>
  .tcd-cta-banner {
    background: linear-gradient(135deg, #0a0d14 0%, #0f1319 100%);
    border-top: 1px solid rgba(201,168,76,0.1);
    border-bottom: 1px solid rgba(201,168,76,0.1);
    padding: 96px 24px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tcd-cta-banner::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 80% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%);
  }
  .tcd-cta-banner-inner { position: relative; max-width: 680px; margin: 0 auto; }
  .tcd-cta-label {
    font-size: 11px;
    letter-spacing: 0.25em;
    color: #C9A84C;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 20px;
  }
  .tcd-cta-title {
    font-family: Georgia, serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 700;
    color: #ffffff;
    line-height: 1.1;
    margin-bottom: 18px;
  }
  .tcd-cta-desc {
    font-size: 17px;
    color: rgba(255,255,255,0.5);
    margin-bottom: 44px;
    line-height: 1.6;
  }
  .tcd-cta-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 32px; }
  .tcd-cta-phone {
    font-size: 14px;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.04em;
  }
  .tcd-cta-phone a { color: rgba(201,168,76,0.7); text-decoration: none; font-weight: 600; }
</style>

<section class="tcd-cta-banner">
  <div class="tcd-cta-banner-inner">
    <div class="tcd-cta-label">Ready to Get Started?</div>
    <h2 class="tcd-cta-title">Transform Your Workplace Today</h2>
    <p class="tcd-cta-desc">Join 500+ Australian businesses who've trusted The Corporate Desk to deliver world-class office environments.</p>
    <div class="tcd-cta-actions">
      <a href="/free-office-layout-plan" style="background:#C9A84C;color:#080b10;font-weight:700;font-size:14px;padding:16px 32px;border-radius:6px;text-decoration:none;letter-spacing:0.04em;">Get a Free Layout Plan</a>
      <a href="/quote-builder" style="background:transparent;border:1px solid rgba(201,168,76,0.35);color:rgba(201,168,76,0.9);font-weight:600;font-size:14px;padding:16px 32px;border-radius:6px;text-decoration:none;">Build Your Quote</a>
    </div>
    <div class="tcd-cta-phone">Or call us directly: <a href="tel:1300977607">1300 977 607</a> — Mon–Fri 9am–5pm AEST</div>
  </div>
</section>
```

---

### BLOCK 6 — Stats Bar

```html
<style>
  .tcd-stats {
    background: #080b10;
    border-top: 1px solid rgba(201,168,76,0.08);
    border-bottom: 1px solid rgba(201,168,76,0.08);
    padding: 32px 24px;
  }
  .tcd-stats-inner {
    max-width: 1120px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0;
  }
  .tcd-stat-item {
    text-align: center;
    padding: 16px;
    border-right: 1px solid rgba(201,168,76,0.08);
  }
  .tcd-stat-item:last-child { border-right: none; }
  .tcd-stat-value {
    font-family: Georgia, serif;
    font-size: 36px;
    font-weight: 700;
    color: #C9A84C;
    line-height: 1;
    margin-bottom: 6px;
  }
  .tcd-stat-label { font-size: 12px; color: rgba(255,255,255,0.35); letter-spacing: 0.06em; text-transform: uppercase; }
</style>

<section class="tcd-stats">
  <div class="tcd-stats-inner">
    <div class="tcd-stat-item">
      <div class="tcd-stat-value">500+</div>
      <div class="tcd-stat-label">Projects Delivered</div>
    </div>
    <div class="tcd-stat-item">
      <div class="tcd-stat-value">6yr</div>
      <div class="tcd-stat-label">Manufacturer Warranty</div>
    </div>
    <div class="tcd-stat-item">
      <div class="tcd-stat-value">3</div>
      <div class="tcd-stat-label">Capital Cities Served</div>
    </div>
    <div class="tcd-stat-item">
      <div class="tcd-stat-value">100%</div>
      <div class="tcd-stat-label">Australian Owned</div>
    </div>
  </div>
</section>
```

---

### BLOCK 7 — Testimonials

```html
<style>
  .tcd-testimonials { background: #0a0d14; padding: 96px 24px; }
  .tcd-testimonials-inner { max-width: 1120px; margin: 0 auto; }
  .tcd-testimonials-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    margin-top: 64px;
  }
  .tcd-testimonial-card {
    background: #0d1118;
    border: 1px solid rgba(201,168,76,0.1);
    border-radius: 14px;
    padding: 32px 28px;
  }
  .tcd-testimonial-stars { color: #C9A84C; font-size: 16px; margin-bottom: 18px; letter-spacing: 2px; }
  .tcd-testimonial-quote {
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    line-height: 1.7;
    font-style: italic;
    margin-bottom: 24px;
  }
  .tcd-testimonial-divider { width: 32px; height: 1px; background: rgba(201,168,76,0.25); margin-bottom: 16px; }
  .tcd-testimonial-author { font-size: 14px; font-weight: 700; color: #ffffff; }
  .tcd-testimonial-company { font-size: 12px; color: rgba(201,168,76,0.6); margin-top: 3px; }
</style>

<section class="tcd-testimonials">
  <div class="tcd-testimonials-inner">
    <div class="tcd-section-eyebrow">Client Feedback</div>
    <h2 class="tcd-section-title">What Our Clients Say</h2>
    <div class="tcd-section-divider"></div>
    <div class="tcd-testimonials-grid">
      <div class="tcd-testimonial-card">
        <div class="tcd-testimonial-stars">★★★★★</div>
        <p class="tcd-testimonial-quote">"The Corporate Desk delivered on every promise. The quality of the Aimu executive desks exceeded expectations — our partners were genuinely impressed when they walked in."</p>
        <div class="tcd-testimonial-divider"></div>
        <div class="tcd-testimonial-author">James R.</div>
        <div class="tcd-testimonial-company">Managing Partner, Brisbane Financial Group</div>
      </div>
      <div class="tcd-testimonial-card">
        <div class="tcd-testimonial-stars">★★★★★</div>
        <p class="tcd-testimonial-quote">"We needed to fit out 3 floors in 8 weeks. The team managed the entire project — space planning, ordering, delivery, and installation — without a single issue."</p>
        <div class="tcd-testimonial-divider"></div>
        <div class="tcd-testimonial-author">Sarah K.</div>
        <div class="tcd-testimonial-company">COO, Sydney Technology Partners</div>
      </div>
      <div class="tcd-testimonial-card">
        <div class="tcd-testimonial-stars">★★★★★</div>
        <p class="tcd-testimonial-quote">"The free layout plan was incredibly detailed. Within 48 hours we had a professional CAD plan and a clear budget. No other supplier offered anything close to this."</p>
        <div class="tcd-testimonial-divider"></div>
        <div class="tcd-testimonial-author">Michael T.</div>
        <div class="tcd-testimonial-company">Director, Melbourne Capital Advisors</div>
      </div>
    </div>
  </div>
</section>
```

---

## WordPress Lead Forms (WPForms Setup)

### Free Layout Plan Form Fields

Create a WPForms form with these fields and email notifications to `service@thecorporatedesk.com.au`:

| Field Label | Field Type | Required |
|------------|------------|----------|
| Full Name | Single Line Text | Yes |
| Company Name | Single Line Text | Yes |
| Email Address | Email | Yes |
| Phone Number | Phone | Yes |
| Office Location (City) | Dropdown (Brisbane/Sydney/Melbourne/Other) | No |
| Approximate Office Size (m²) | Single Line Text | No |
| Number of Staff | Single Line Text | No |
| Budget Range | Dropdown | No |
| Target Move / Completion Date | Date | No |
| Additional Information | Paragraph Text | No |

After form submission, redirect to a "Thank You" page.

---

## WordPress Navigation Menu

Set up menus in **Appearance → Menus**:

### Main Menu
```
Home                → /
Products            → /products
Workplace Solutions → /workplace-solutions (dropdown):
  ├ Free Layout Plan    → /free-office-layout-plan
  ├ Request a Quote     → /send-us-your-quote
  └ Strategy Call       → /workplace-strategy
Case Studies        → /case-studies
Quote Builder       → /quote-builder
Blog                → /blog
About               → /about
Contact             → /contact
```

### Header CTA Button (Elementor Header)
- **Label:** Get a Free Quote
- **URL:** /free-office-layout-plan
- **Style:** Gold background (#C9A84C), dark text (#080b10), font-weight 700

---

## Final Handoff Summary

### Subdomain Deployment

1. Deploy the React app via Replit Deployments
2. Add DNS CNAME: `app` → `<replit-deployment>.replit.app`
3. Add custom domain `app.thecorporatedesk.com.au` in Replit
4. Confirm SSL auto-provisions

### URLs in Production

| What | URL |
|------|-----|
| Main website | `https://thecorporatedesk.com.au` |
| App (tools) | `https://app.thecorporatedesk.com.au` |
| Quote Builder embed | `https://app.thecorporatedesk.com.au/embed/quote-builder` |
| Finance embed | `https://app.thecorporatedesk.com.au/embed/finance-your-workspace` |
| Chatbot widget script | `https://app.thecorporatedesk.com.au/chatbot-widget.js` |
| Admin dashboard | `https://app.thecorporatedesk.com.au/admin/dashboard` |
| Health check | `https://app.thecorporatedesk.com.au/api/health` |

### WordPress Buttons to Add

Add links to the React app from WordPress wherever relevant:

| Button Label | Link To |
|-------------|---------|
| Build Your Quote | `https://app.thecorporatedesk.com.au/quote-builder` |
| Finance Calculator | `https://app.thecorporatedesk.com.au/finance-your-workspace` |

Or use the iframe embed blocks above to keep users on the WordPress domain.

### Known Limitations

| Limitation | Detail |
|-----------|--------|
| Blog | The app's 200-article blog is on `app.` — migrate articles to WordPress for better SEO |
| Lead forms | WPForms won't auto-sync to the app's admin dashboard — use WPForms email notifications |
| Chatbot on iPhone | iOS Safari may block cross-origin cookies; widget uses no cookies so this is fine |
| iframe height | iframes need a fixed `min-height` — auto-resize requires the postMessage listener in the embed code above |
| Admin security | Admin at `/admin/dashboard` is password-protected client-side only — keep the URL private or add HTTP Basic Auth |

### Environment Variables Required for Production

Already set by Replit — no action needed:
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

Optional (for email notifications from the app):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
