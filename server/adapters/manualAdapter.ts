import type { LeadSignalAdapter } from "./types";

const passThrough = async (input: string) => ({ text: input });

export const adapters: LeadSignalAdapter[] = [
  {
    id: "manual",
    name: "General Signals",
    sourceType: "manual",
    description: "Paste any company intelligence — funding news, growth announcements, relocation hints",
    placeholder: `Example:\n\nCompany: NovaPay Financial\n- Announced $25M Series B (TechCrunch, March 2026)\n- Hiring 40+ staff in Brisbane including Office Manager\n- Team grew from 35 to 80 in 6 months\n- Moving from River City Labs coworking to private offices in Fortitude Valley\n- CEO: "building a world-class Brisbane HQ"`,
    urlLabel: null,
    status: "live",
    fetchContent: passThrough,
  },
  {
    id: "job_ad",
    name: "Job Advertisement",
    sourceType: "job_ad",
    description: "Paste job ad text to identify hiring signals and office needs",
    placeholder: "Paste the full job advertisement text here...\n\nExample: Office Manager, Brisbane CBD — We are a fast-growing fintech scaling to 80 staff. You'll manage our new 500sqm Fortitude Valley office...",
    urlLabel: "Job Ad URL (optional)",
    status: "live",
    fetchContent: passThrough,
  },
  {
    id: "linkedin",
    name: "LinkedIn Post",
    sourceType: "linkedin",
    description: "Paste LinkedIn posts, company updates, or profile text",
    placeholder: "Paste LinkedIn post or company profile content here...\n\nExample: Excited to announce we've signed a lease on our new Brisbane HQ — 1,200sqm in the heart of the CBD. We're growing fast and our team of 80+ is ready to move in Q2...",
    urlLabel: "LinkedIn URL (optional)",
    status: "live",
    fetchContent: passThrough,
  },
  {
    id: "hiring_page",
    name: "Hiring / Careers Page",
    sourceType: "hiring_page",
    description: "Paste the text from a company's careers or jobs page",
    placeholder: "Paste the careers page content here...\n\nExample: We're hiring across all departments as we prepare to open our new Sydney HQ. Roles include: Executive Assistant, Office Coordinator, IT Manager, 15+ Engineering roles...",
    urlLabel: "Careers Page URL (optional)",
    status: "live",
    fetchContent: passThrough,
  },
  {
    id: "announcement",
    name: "Announcement",
    sourceType: "announcement",
    description: "Paste funding announcements, expansion news, or press releases",
    placeholder: "Paste the announcement or press release text here...\n\nExample: ACME Corp today announced a $40M Series C funding round led by Blackbird Ventures. The Brisbane-based company plans to triple headcount to 150 and secure a new headquarters...",
    urlLabel: "Announcement URL (optional)",
    status: "live",
    fetchContent: passThrough,
  },
  {
    id: "article",
    name: "News Article",
    sourceType: "article",
    description: "Paste a news article or blog post about a company's growth",
    placeholder: "Paste the news article or blog post text here...\n\nExample: Brisbane startup closes $15M raise as it prepares for national expansion. The company, which employs 45 staff across two floors of a Fortitude Valley coworking space, is searching for a permanent HQ...",
    urlLabel: "Article URL (optional)",
    status: "live",
    fetchContent: passThrough,
  },
  {
    id: "website",
    name: "Company Website",
    sourceType: "website",
    description: "Paste website URL + any visible text from About/Team/Contact pages",
    placeholder: "Paste the company website URL and any relevant text from their About, Team, or Contact pages...",
    urlLabel: "Website URL",
    status: "manual_only",
    fetchContent: passThrough,
  },
];

export function getAdapter(id: string): LeadSignalAdapter | undefined {
  return adapters.find(a => a.id === id);
}

export function getAdaptersMeta() {
  return adapters.map(({ fetchContent: _fn, ...rest }) => rest);
}
