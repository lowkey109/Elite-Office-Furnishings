export interface BlogImageSet {
  hero: { src: string; alt: string; caption?: string };
  mid: { src: string; alt: string; caption?: string };
  bottom: { src: string; alt: string; caption?: string };
}

const CATEGORY_IMAGES: Record<string, BlogImageSet[]> = {
  "Office Fit-Out Planning": [
    {
      hero: {
        src: "/images/blog/office-fitout-planning-modern-workspace.png",
        alt: "modern corporate office fitout with premium workstations and floor-to-ceiling glass walls",
        caption: "A premium commercial office fitout in the Australian CBD — where design precision meets workplace performance.",
      },
      mid: {
        src: "/images/blog/office-fitout-construction-planning.png",
        alt: "office layout planning overhead view with workstation clusters and glass meeting rooms",
        caption: "Thoughtful space planning is the foundation of every successful office fitout.",
      },
      bottom: {
        src: "/images/blog/executive-office-design-luxury-interior.png",
        alt: "luxury executive office interior with premium desk and city skyline view",
        caption: "Executive offices that reflect the ambition of the business they serve.",
      },
    },
  ],
  "Fitout Planning": [
    {
      hero: {
        src: "/images/blog/office-fitout-planning-modern-workspace.png",
        alt: "modern corporate office fitout with premium workstations and floor-to-ceiling glass walls",
        caption: "A premium commercial office fitout — where design precision meets workplace performance.",
      },
      mid: {
        src: "/images/blog/office-fitout-construction-planning.png",
        alt: "office layout planning overhead view with workstation clusters and glass meeting rooms",
        caption: "Thoughtful space planning is the foundation of every successful office fitout.",
      },
      bottom: {
        src: "/images/blog/executive-office-design-luxury-interior.png",
        alt: "luxury executive office interior with premium desk and city skyline view",
        caption: "Executive offices that reflect the ambition of the business they serve.",
      },
    },
  ],
  "Office Layout & Design": [
    {
      hero: {
        src: "/images/blog/office-layout-design-open-plan.png",
        alt: "premium open plan office layout design with ergonomic workstations and natural lighting",
        caption: "Modern open-plan office design balances collaboration with focus — a hallmark of high-performance workplaces.",
      },
      mid: {
        src: "/images/blog/executive-office-design-luxury-interior.png",
        alt: "luxury executive private office interior with premium desk and floor-to-ceiling windows",
        caption: "Private executive offices deliver focus, prestige, and the space to lead.",
      },
      bottom: {
        src: "/images/blog/office-fitout-planning-modern-workspace.png",
        alt: "modern corporate office fitout with premium open plan workstations",
        caption: "Every great office layout starts with understanding how your team works.",
      },
    },
  ],
  "Layout Design": [
    {
      hero: {
        src: "/images/blog/office-layout-design-open-plan.png",
        alt: "premium open plan office layout design with ergonomic workstations and natural lighting",
        caption: "Modern open-plan office design balances collaboration with focus.",
      },
      mid: {
        src: "/images/blog/executive-office-design-luxury-interior.png",
        alt: "luxury executive private office interior with premium desk and floor-to-ceiling windows",
        caption: "Private executive offices deliver focus, prestige, and the space to lead.",
      },
      bottom: {
        src: "/images/blog/office-fitout-planning-modern-workspace.png",
        alt: "modern corporate office fitout with premium open plan workstations",
        caption: "Every great office layout starts with understanding how your team works.",
      },
    },
  ],
  "Boardroom & Meeting Rooms": [
    {
      hero: {
        src: "/images/blog/boardroom-luxury-conference-table-setup.png",
        alt: "luxury corporate boardroom with premium conference table, leather executive chairs, and panoramic city skyline view",
        caption: "A world-class boardroom sets the tone for every high-stakes decision made within it.",
      },
      mid: {
        src: "/images/blog/modern-meeting-room-glass-walls.png",
        alt: "modern glass-walled meeting room with oval conference table and acoustic panels",
        caption: "Glass-walled meeting rooms create visual openness while preserving acoustic privacy.",
      },
      bottom: {
        src: "/images/blog/office-layout-design-open-plan.png",
        alt: "premium office layout with collaborative workstations and meeting zones",
        caption: "Integrating meeting rooms with open-plan spaces creates a seamless workplace ecosystem.",
      },
    },
  ],
  "Buying Guides": [
    {
      hero: {
        src: "/images/blog/office-furniture-buying-guide-showroom.png",
        alt: "premium commercial office furniture showroom display with executive desks and ergonomic chairs",
        caption: "Choosing the right commercial furniture is an investment in your team's performance and your company's image.",
      },
      mid: {
        src: "/images/blog/office-chair-buying-guide-ergonomic.png",
        alt: "premium ergonomic office chair selection with mesh back and leather executive seating options",
        caption: "The right chair is the single most impactful furniture investment for long-term employee wellbeing.",
      },
      bottom: {
        src: "/images/blog/executive-office-design-luxury-interior.png",
        alt: "luxury executive office interior showcasing premium commercial furniture selection",
        caption: "Premium commercial furniture elevates your workspace and signals your company's standards.",
      },
    },
  ],
  "Ergonomics & Wellbeing": [
    {
      hero: {
        src: "/images/blog/ergonomic-sit-stand-desk-workplace.png",
        alt: "ergonomic sit-stand adjustable height desk in a premium corporate office with natural lighting",
        caption: "Height-adjustable desks are now a baseline expectation in high-performance workplace design.",
      },
      mid: {
        src: "/images/blog/ergonomic-wellness-office-biophilic.png",
        alt: "wellness-focused biophilic office with living green wall, natural timber, and ergonomic workstations",
        caption: "Biophilic design elements improve focus, reduce stress, and signal a culture that values people.",
      },
      bottom: {
        src: "/images/blog/office-chair-buying-guide-ergonomic.png",
        alt: "premium ergonomic office chairs supporting long-term health and productivity",
        caption: "The ergonomic chair — where health investment and productivity converge.",
      },
    },
  ],
  "Reception & Client Areas": [
    {
      hero: {
        src: "/images/blog/reception-desk-premium-corporate-lobby.png",
        alt: "premium corporate reception desk with dark timber and brushed brass in elegant corporate lobby",
        caption: "Your reception area communicates your brand before a single word is spoken.",
      },
      mid: {
        src: "/images/blog/reception-waiting-lounge-luxury-office.png",
        alt: "executive corporate reception waiting lounge with designer chairs and sophisticated lighting",
        caption: "A considered waiting lounge transforms the client experience from arrival.",
      },
      bottom: {
        src: "/images/blog/boardroom-luxury-conference-table-setup.png",
        alt: "luxury boardroom visible from premium reception area, creating a cohesive client journey",
        caption: "The journey from reception to boardroom should feel intentional at every step.",
      },
    },
  ],
  "Productivity & Culture": [
    {
      hero: {
        src: "/images/blog/productivity-office-design-modern.png",
        alt: "bright modern office designed for productivity with premium hot-desking workstations and natural light",
        caption: "Workplace design is one of the most powerful levers for organisational culture and performance.",
      },
      mid: {
        src: "/images/blog/office-breakout-collaborative-space.png",
        alt: "modern collaborative breakout area with designer lounge furniture and acoustic booths",
        caption: "Breakout spaces are where informal collaboration and creative thinking flourish.",
      },
      bottom: {
        src: "/images/blog/office-layout-design-open-plan.png",
        alt: "premium open plan office design supporting team collaboration and individual focus",
        caption: "The best offices support every work mode — from deep focus to dynamic teamwork.",
      },
    },
  ],
  "Workplace Relocation": [
    {
      hero: {
        src: "/images/blog/office-relocation-new-empty-space.png",
        alt: "empty premium corporate office space ready for fitout with polished concrete and CBD skyline view",
        caption: "A new space is a blank canvas — an opportunity to design a workplace that reflects your next chapter.",
      },
      mid: {
        src: "/images/blog/workplace-relocation-new-office-fitout.png",
        alt: "newly completed premium office fitout ready for move-in with modern workstations and executive desks",
        caption: "Move-in day marks the beginning — the workplace you design today shapes your culture for years.",
      },
      bottom: {
        src: "/images/blog/office-fitout-planning-modern-workspace.png",
        alt: "modern corporate office fitout completed with premium open plan workstations",
        caption: "A well-executed relocation is more than a move — it's a strategic business opportunity.",
      },
    },
  ],
  "Design Trends": [
    {
      hero: {
        src: "/images/blog/office-design-trends-2026-contemporary.png",
        alt: "cutting-edge contemporary office design with curved organic shapes, premium materials and ambient lighting",
        caption: "2026's defining office aesthetic: organic forms, premium tactile materials, and human-centric design.",
      },
      mid: {
        src: "/images/blog/biophilic-office-design-green-wall.png",
        alt: "dramatic living green wall biophilic office design with natural timber furniture and indoor plants",
        caption: "Biophilic design has moved from trend to expectation in premium commercial fitouts.",
      },
      bottom: {
        src: "/images/blog/office-fitout-planning-modern-workspace.png",
        alt: "contemporary office design with premium workstations and architectural design elements",
        caption: "The offices that attract and retain top talent are those that feel exceptional to inhabit.",
      },
    },
  ],
  "Sustainability & Green Offices": [
    {
      hero: {
        src: "/images/blog/sustainable-office-design-green-certified.png",
        alt: "sustainable LEED certified green office with natural materials, living plant wall and energy efficient lighting",
        caption: "Sustainable office design is no longer a differentiator — it's a business imperative.",
      },
      mid: {
        src: "/images/blog/eco-sustainable-office-fitout-natural.png",
        alt: "eco-conscious sustainable office fitout with recycled timber workstations and biophilic design",
        caption: "Material choices communicate your organisation's values long after the fitout is complete.",
      },
      bottom: {
        src: "/images/blog/ergonomic-wellness-office-biophilic.png",
        alt: "wellness-focused biophilic office with green wall and natural materials supporting employee health",
        caption: "Sustainable workplaces improve employee wellbeing, reduce costs, and attract purpose-driven talent.",
      },
    },
  ],
};

const FALLBACK_IMAGES: BlogImageSet = {
  hero: {
    src: "/images/blog/office-fitout-planning-modern-workspace.png",
    alt: "modern premium corporate office interior design with professional workstations",
    caption: "Premium commercial office design for high-performance Australian workplaces.",
  },
  mid: {
    src: "/images/blog/office-layout-design-open-plan.png",
    alt: "contemporary open plan office layout design with premium furniture",
    caption: "Thoughtful office design that supports every dimension of modern work.",
  },
  bottom: {
    src: "/images/blog/executive-office-design-luxury-interior.png",
    alt: "luxury executive office interior with premium furniture and city views",
    caption: "Every workspace should inspire the people who use it.",
  },
};

export function getBlogImages(postId: number, category: string): BlogImageSet {
  const sets = CATEGORY_IMAGES[category];
  if (!sets || sets.length === 0) return FALLBACK_IMAGES;
  return sets[postId % sets.length];
}
