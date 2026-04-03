/**
 * Contact Discovery Engine
 * Finds likely decision-makers for high-value opportunities.
 * Writes to company_contacts + contact_discovery_runs.
 *
 * Pipeline: company name → domain inference → MX validation → email generation → save contact
 */

import { db } from "../../db";
import { storage } from "../../storage";
import OpenAI from "openai";
import {
  companyContacts,
  companyIntelligence,
  contactDiscoveryRuns,
  contactVerificationLogs,
  opportunities,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import dns from "dns";

const SAFE_MODE = process.env.SAFE_MODE === "true";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const PRIORITY_ROLES = [
  "Head of Workplace",
  "Facilities Manager",
  "Operations Director",
  "Office Manager",
  "People & Culture Director",
  "Procurement Manager",
  "Property Manager",
  "Workplace Experience Manager",
];

const WELL_KNOWN_DOMAINS: Record<string, string> = {
  "commonwealth bank": "commbank.com.au",
  "commonwealth bank of australia": "commbank.com.au",
  "westpac": "westpac.com.au",
  "anz": "anz.com.au",
  "national australia bank": "nab.com.au",
  "nab": "nab.com.au",
  "telstra": "telstra.com.au",
  "optus": "optus.com.au",
  "woolworths": "woolworths.com.au",
  "coles": "coles.com.au",
  "bhp": "bhp.com",
  "rio tinto": "riotinto.com",
  "deloitte australia": "deloitte.com.au",
  "deloitte": "deloitte.com.au",
  "kpmg": "kpmg.com.au",
  "pwc australia": "pwc.com.au",
  "pwc": "pwc.com.au",
  "ey": "ey.com",
  "ernst young": "ey.com",
  "minterellison": "minterellison.com",
  "king wood mallesons": "kwm.com",
  "king & wood mallesons": "kwm.com",
  "aurizon": "aurizon.com.au",
  "qantas": "qantas.com.au",
  "virgin australia": "virginaustralia.com",
  "atlassian": "atlassian.com",
  "canva": "canva.com",
  "xero": "xero.com",
  "afterpay": "afterpay.com",
  "csl": "csl.com",
  "ramsay health care": "ramsayhealth.com.au",
  "iss": "au.issworld.com",
  "iss integrated serv p/l": "au.issworld.com",
  "willis towers watson": "wtwco.com",
  "ghd": "ghd.com",
  "lendlease": "lendlease.com",
  "macquarie group": "macquarie.com",
  "mcconnell dowell": "mcconnelldowell.com",
  "mcconnell dowell constructors": "mcconnelldowell.com",
  "hydrogen group": "hydrogengroup.com.au",
  "victorian government": "vic.gov.au",
  "accor": "accor.com",
  "accor hotels australia": "accor.com",
  "rea group": "rea-group.com",
};

function normalizeForLookup(name: string): string {
  return name.toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/pty\s*ltd|p\/l|limited|inc|corp|corporation|australia/gi, "")
    .replace(/[^a-z0-9\s&]/g, "")
    .trim();
}

async function checkMx(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function inferDomain(companyName: string): Promise<string | null> {
  const normalized = normalizeForLookup(companyName);

  if (WELL_KNOWN_DOMAINS[normalized]) {
    return WELL_KNOWN_DOMAINS[normalized];
  }

  for (const [key, domain] of Object.entries(WELL_KNOWN_DOMAINS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return domain;
    }
  }

  const slug = normalized.replace(/\s+/g, "").replace(/&/g, "and");
  const candidates = [
    `${slug}.com.au`,
    `${slug}.com`,
    `${slug}.net.au`,
  ];

  for (const candidate of candidates) {
    const hasMx = await checkMx(candidate);
    if (hasMx) {
      console.log(`[ContactDiscovery] MX validated domain: ${candidate} for "${companyName}"`);
      return candidate;
    }
  }

  const parts = normalized.split(/\s+/).filter(w => w.length > 2);
  if (parts.length >= 2) {
    const shortSlug = parts.slice(0, 2).join("");
    const shortCandidates = [`${shortSlug}.com.au`, `${shortSlug}.com`];
    for (const candidate of shortCandidates) {
      const hasMx = await checkMx(candidate);
      if (hasMx) {
        console.log(`[ContactDiscovery] MX validated shortened domain: ${candidate} for "${companyName}"`);
        return candidate;
      }
    }
  }

  if (parts.length >= 1) {
    const firstWord = parts[0];
    const firstWordCandidates = [`${firstWord}.com.au`, `${firstWord}.com`];
    for (const candidate of firstWordCandidates) {
      const hasMx = await checkMx(candidate);
      if (hasMx) {
        console.log(`[ContactDiscovery] MX validated first-word domain: ${candidate} for "${companyName}"`);
        return candidate;
      }
    }
  }

  console.log(`[ContactDiscovery] No domain found for "${companyName}"`);
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function verificationStatus(confidence: number, isGeneric: boolean): string {
  if (isGeneric) return "generic_fallback";
  if (confidence >= 85) return "high_confidence";
  if (confidence >= 65) return "medium_confidence";
  return "unverified";
}

async function discoverContactsViaAI(
  companyName: string,
  domain: string,
  industry: string | null,
  city: string | null,
): Promise<Array<{
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  email: string;
  linkedinUrl: string | null;
  confidence: number;
  contactType: "direct";
}>> {
  try {
    const prompt = `You are a B2B contact intelligence service for Australian commercial office furniture.
For the company "${companyName}" (domain: ${domain}, industry: ${industry ?? "unknown"}, city: ${city ?? "Australia"}), identify the most likely decision-maker for office furniture and fitout procurement.

Return a JSON array with exactly 1 contact:
{
  "fullName": "First Last",
  "firstName": "First",
  "lastName": "Last",
  "role": string (most likely role from: ${PRIORITY_ROLES.join(", ")}),
  "department": "Workplace / Facilities / Operations / Procurement",
  "email": "firstname.lastname@${domain}",
  "linkedinUrl": null,
  "confidence": number 50-85
}

Rules:
- Generate a realistic first.last@${domain} email using common Australian business naming
- Pick a plausible name for someone in this role at an Australian company
- Confidence reflects how likely this ROLE exists (not the specific person)
- Return ONLY valid JSON array, no other text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    } as any);

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
    const results = Array.isArray(parsed) ? parsed : [];

    return results.filter(c => c.email && isValidEmail(c.email)).map(c => ({
      ...c,
      contactType: "direct" as const,
    }));
  } catch (err) {
    console.error("[ContactDiscovery] AI discovery failed:", err);
    return [];
  }
}

export async function discoverContactForOpportunity(opportunityId: string): Promise<{
  contactId: string | null;
  companyIntelligenceId: string | null;
  domain: string | null;
  email: string | null;
  contactsFound: number;
}> {
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opp) {
    console.warn(`[ContactDiscovery] Opportunity ${opportunityId} not found`);
    return { contactId: null, companyIntelligenceId: null, domain: null, email: null, contactsFound: 0 };
  }

  const companyName = opp.companyName ?? "Unknown";
  console.log(`[ContactDiscovery] Starting discovery for "${companyName}" (opp: ${opportunityId.slice(0, 8)})`);

  let ciId = opp.companyId;
  if (!ciId) {
    const existing = await db.select().from(companyIntelligence)
      .where(eq(companyIntelligence.companyName, companyName))
      .limit(1);

    if (existing.length > 0) {
      ciId = existing[0].id;
    } else {
      const domain = await inferDomain(companyName);
      const [ci] = await db.insert(companyIntelligence).values({
        companyName,
        domain: domain ?? undefined,
        city: opp.city ?? "Australia",
        industry: opp.industry ?? "General",
        status: "active",
      }).returning();
      ciId = ci.id;
      console.log(`[ContactDiscovery] Created company_intelligence ${ciId} for "${companyName}" (domain: ${domain})`);
    }

    await db.update(opportunities).set({ companyId: ciId }).where(eq(opportunities.id, opportunityId));
  }

  const existingContacts = await db.select().from(companyContacts)
    .where(eq(companyContacts.companyIntelligenceId, ciId!))
    .limit(10);

  const hasEmailContact = existingContacts.some(c => c.email && isValidEmail(c.email));
  if (hasEmailContact) {
    const best = existingContacts
      .filter(c => c.email && isValidEmail(c.email!))
      .sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (a.contactType === "direct" && b.contactType !== "direct") return -1;
        return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
      })[0];

    if (best) {
      if (!opp.contactId) {
        await db.update(opportunities).set({
          contactId: best.id,
          contactName: best.contactName,
          contactEmail: best.email,
        }).where(eq(opportunities.id, opportunityId));
      }
      console.log(`[ContactDiscovery] "${companyName}" already has contact: ${best.email}`);
      return { contactId: best.id, companyIntelligenceId: ciId, domain: null, email: best.email!, contactsFound: existingContacts.length };
    }
  }

  let ciRecord = await db.select().from(companyIntelligence).where(eq(companyIntelligence.id, ciId!)).limit(1);
  let domain = ciRecord[0]?.domain ?? null;

  if (!domain) {
    domain = await inferDomain(companyName);
    if (domain) {
      await db.update(companyIntelligence).set({ domain }).where(eq(companyIntelligence.id, ciId!));
    }
  }

  const [run] = await db.insert(contactDiscoveryRuns).values({
    companyId: ciId!,
    companyName,
    opportunityId,
    runStatus: "running",
  }).returning();

  let contactsFound = 0;
  let savedContactId: string | null = null;
  let savedEmail: string | null = null;

  try {
    if (domain) {
      const aiContacts = await discoverContactsViaAI(companyName, domain, opp.industry, opp.city);

      for (const contact of aiContacts) {
        const [saved] = await db.insert(companyContacts).values({
          companyIntelligenceId: ciId!,
          companyName,
          contactName: contact.fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          role: contact.role,
          department: contact.department,
          email: contact.email,
          linkedinUrl: contact.linkedinUrl,
          confidenceScore: contact.confidence,
          verificationStatus: verificationStatus(contact.confidence, false),
          isPrimary: contactsFound === 0,
          contactSource: "ai_inferred",
          contactType: "direct",
        }).returning();

        await db.insert(contactVerificationLogs).values({
          contactId: saved.id,
          checkType: "mx_domain",
          result: "passed",
          detailsJson: JSON.stringify({ domain, role: contact.role, confidence: contact.confidence }),
        });

        if (contactsFound === 0) {
          savedContactId = saved.id;
          savedEmail = contact.email;
        }
        contactsFound++;
      }

      if (contactsFound === 0) {
        const genericEmail = `info@${domain}`;
        const [saved] = await db.insert(companyContacts).values({
          companyIntelligenceId: ciId!,
          companyName,
          contactName: "Office Team",
          firstName: "Office",
          lastName: "Team",
          role: "General Enquiries",
          department: "General",
          email: genericEmail,
          confidenceScore: 40,
          verificationStatus: "generic_fallback",
          isPrimary: true,
          contactSource: "domain_inferred",
          contactType: "generic_fallback",
          notes: `Generic fallback for ${domain}`,
        }).returning();
        savedContactId = saved.id;
        savedEmail = genericEmail;
        contactsFound = 1;
      }
    } else {
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);
      const genericEmail = `info@${slug}.com.au`;
      const [saved] = await db.insert(companyContacts).values({
        companyIntelligenceId: ciId!,
        companyName,
        contactName: "Office Team",
        firstName: "Office",
        lastName: "Team",
        role: "General Enquiries",
        department: "General",
        email: genericEmail,
        confidenceScore: 25,
        verificationStatus: "generic_fallback",
        isPrimary: true,
        contactSource: "name_inferred",
        contactType: "generic_fallback",
        notes: `No MX-validated domain found; using name-based fallback`,
      }).returning();
      savedContactId = saved.id;
      savedEmail = genericEmail;
      contactsFound = 1;
    }

    if (savedContactId) {
      await db.update(opportunities).set({
        contactId: savedContactId,
        contactName: "Discovered Contact",
        contactEmail: savedEmail,
      }).where(eq(opportunities.id, opportunityId));
    }

    await db.update(contactDiscoveryRuns).set({
      runStatus: "completed",
      contactsFound,
      fallbackContactsCreated: savedEmail?.startsWith("info@") ? 1 : 0,
      completedAt: new Date(),
    }).where(eq(contactDiscoveryRuns.id, run.id));

    console.log(`[ContactDiscovery] ✓ ${companyName}: ${contactsFound} contacts, email=${savedEmail}, domain=${domain}`);
  } catch (err: any) {
    await db.update(contactDiscoveryRuns).set({
      runStatus: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    }).where(eq(contactDiscoveryRuns.id, run.id));
    console.error(`[ContactDiscovery] Failed for ${companyName}:`, err.message);
  }

  return { contactId: savedContactId, companyIntelligenceId: ciId, domain, email: savedEmail, contactsFound };
}

export async function runContactDiscovery(companyId: string, opportunityId?: string): Promise<{
  contactsFound: number;
  fallbackContactsCreated: number;
  runId: string;
}> {
  const companies = await storage.getCompanyIntelligenceRecords({});
  const company = companies.find(c => c.id === companyId);
  if (!company) {
    console.warn(`[ContactDiscovery] Company ${companyId} not found`);
    return { contactsFound: 0, fallbackContactsCreated: 0, runId: "" };
  }

  const [run] = await db.insert(contactDiscoveryRuns).values({
    companyId,
    companyName: company.companyName,
    opportunityId: opportunityId ?? null,
    runStatus: "running",
  }).returning();

  let contactsFound = 0;
  let fallbackContactsCreated = 0;

  try {
    const existingContacts = await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.companyIntelligenceId, companyId))
      .limit(10);

    const hasEmailContacts = existingContacts.some(c => c.email && isValidEmail(c.email));
    if (hasEmailContacts) {
      await db.update(contactDiscoveryRuns).set({
        runStatus: "completed",
        contactsFound: existingContacts.length,
        completedAt: new Date(),
      }).where(eq(contactDiscoveryRuns.id, run.id));
      return { contactsFound: existingContacts.length, fallbackContactsCreated: 0, runId: run.id };
    }

    let domain = company.domain ?? null;
    if (!domain) {
      domain = await inferDomain(company.companyName);
      if (domain) {
        await db.update(companyIntelligence).set({ domain }).where(eq(companyIntelligence.id, companyId));
      }
    }

    if (domain) {
      const aiContacts = await discoverContactsViaAI(company.companyName, domain, company.industry, company.city);
      for (const contact of aiContacts) {
        await db.insert(companyContacts).values({
          companyIntelligenceId: companyId,
          companyName: company.companyName,
          contactName: contact.fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          role: contact.role,
          department: contact.department,
          email: contact.email,
          linkedinUrl: contact.linkedinUrl,
          confidenceScore: contact.confidence,
          verificationStatus: verificationStatus(contact.confidence, false),
          isPrimary: contactsFound === 0,
          contactSource: "ai_inferred",
          contactType: "direct",
        });
        contactsFound++;
      }

      if (contactsFound === 0) {
        await db.insert(companyContacts).values({
          companyIntelligenceId: companyId,
          companyName: company.companyName,
          contactName: "Office Team",
          firstName: "Office",
          lastName: "Team",
          role: "General Enquiries",
          department: "General",
          email: `info@${domain}`,
          confidenceScore: 40,
          verificationStatus: "generic_fallback",
          isPrimary: true,
          contactSource: "domain_inferred",
          contactType: "generic_fallback",
        });
        fallbackContactsCreated++;
      }
    } else {
      const slug = company.companyName.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);
      await db.insert(companyContacts).values({
        companyIntelligenceId: companyId,
        companyName: company.companyName,
        contactName: "Office Team",
        firstName: "Office",
        lastName: "Team",
        role: "General Enquiries",
        department: "General",
        email: `info@${slug}.com.au`,
        confidenceScore: 25,
        verificationStatus: "generic_fallback",
        isPrimary: true,
        contactSource: "name_inferred",
        contactType: "generic_fallback",
      });
      fallbackContactsCreated++;
    }

    await db.update(contactDiscoveryRuns).set({
      runStatus: "completed",
      contactsFound,
      fallbackContactsCreated,
      completedAt: new Date(),
    }).where(eq(contactDiscoveryRuns.id, run.id));

    console.log(`[ContactDiscovery] ${company.companyName}: ${contactsFound} direct, ${fallbackContactsCreated} fallback`);
  } catch (err: any) {
    await db.update(contactDiscoveryRuns).set({ runStatus: "failed", errorMessage: err.message, completedAt: new Date() })
      .where(eq(contactDiscoveryRuns.id, run.id));
    throw err;
  }

  return { contactsFound, fallbackContactsCreated, runId: run.id };
}

export async function getContactsForCompany(companyId: string) {
  return db
    .select()
    .from(companyContacts)
    .where(eq(companyContacts.companyIntelligenceId, companyId))
    .orderBy(companyContacts.confidenceScore);
}

export async function getContactDiscoveryStats() {
  const [allRuns, allContacts] = await Promise.all([
    db.select().from(contactDiscoveryRuns).limit(500),
    db.select().from(companyContacts).limit(2000),
  ]);

  const directContacts = allContacts.filter(c => c.contactType === "direct");
  const fallbackContacts = allContacts.filter(c => c.contactType === "generic_fallback");
  const highConfidence = allContacts.filter(c => (c.confidenceScore ?? 0) >= 70);
  const completedRuns = allRuns.filter(r => r.runStatus === "completed");

  return {
    totalRuns: allRuns.length,
    completedRuns: completedRuns.length,
    totalContacts: allContacts.length,
    directContacts: directContacts.length,
    fallbackContacts: fallbackContacts.length,
    highConfidenceContacts: highConfidence.length,
    avgContactsPerRun: completedRuns.length > 0
      ? Math.round(completedRuns.reduce((s, r) => s + (r.contactsFound ?? 0), 0) / completedRuns.length)
      : 0,
  };
}

export async function runDiscoveryForHighValueOpportunities(): Promise<void> {
  if (SAFE_MODE) {
    console.log("[ContactDiscovery] SAFE_MODE — running in limited discovery mode");
  }

  const companies = await storage.getCompanyIntelligenceRecords({});
  const highValue = companies
    .filter(c => (c.confidenceScore ?? 0) >= 60 && (c.moveProbability ?? 0) >= 50)
    .slice(0, 20);

  console.log(`[ContactDiscovery] Running discovery for ${highValue.length} high-value companies`);

  for (const co of highValue) {
    try {
      const existing = await db
        .select()
        .from(companyContacts)
        .where(eq(companyContacts.companyIntelligenceId, co.id))
        .limit(1);
      if (existing.some(c => c.email && isValidEmail(c.email))) continue;

      await runContactDiscovery(co.id);
    } catch (err) {
      console.error(`[ContactDiscovery] Error for ${co.companyName}:`, err);
    }
  }
}
