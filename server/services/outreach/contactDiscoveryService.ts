/**
 * Contact Discovery Engine
 * Finds likely decision-makers for high-value opportunities.
 * Writes to company_contacts + contact_discovery_runs.
 */

import { db } from "../../db";
import { storage } from "../../storage";
import OpenAI from "openai";
import {
  companyContacts,
  contactDiscoveryRuns,
  contactVerificationLogs,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

const FALLBACK_ROLES = ["General Manager", "CEO", "Founder", "Reception", "Admin"];

const GENERIC_PREFIXES = ["info", "admin", "reception", "contact", "hello", "office"];

function buildGenericEmail(companyName: string, prefix = "info"): string {
  const domain = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 20);
  return `${prefix}@${domain}.com.au`;
}

function verificationStatus(confidence: number, isGeneric: boolean): string {
  if (isGeneric) return "generic_fallback";
  if (confidence >= 85) return "high_confidence";
  if (confidence >= 65) return "medium_confidence";
  return "unverified";
}

async function discoverContactsViaAI(
  companyName: string,
  industry: string | null,
  city: string | null
): Promise<Array<{
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  email: string | null;
  linkedinUrl: string | null;
  confidence: number;
  contactType: "direct" | "generic_fallback";
}>> {
  try {
    const prompt = `You are a B2B contact intelligence service for Australian commercial real estate.
For the company "${companyName}" (industry: ${industry ?? "unknown"}, city: ${city ?? "Australia"}), identify likely decision-makers for office furniture/fit-out procurement.

Return a JSON array of up to 3 contacts. Each contact:
{
  "fullName": string,
  "firstName": string,
  "lastName": string,
  "role": string (one of: ${PRIORITY_ROLES.slice(0, 5).join(", ")}),
  "department": string,
  "email": null,
  "linkedinUrl": string or null (LinkedIn profile URL if highly confident, else null),
  "confidence": number 0-100 (how confident are you this person exists in this role),
  "contactType": "direct"
}

Rules:
- Only include contacts you are reasonably confident exist at this company
- Do NOT invent email addresses  
- Keep confidence realistic (60-80 for medium, 80+ for high confidence)
- Return empty array [] if company is unknown or too small

Return ONLY valid JSON array, no other text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 800,
    } as any);

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[ContactDiscovery] AI discovery failed:", err);
    return [];
  }
}

export async function runContactDiscovery(companyId: string, opportunityId?: string): Promise<{
  contactsFound: number;
  fallbackContactsCreated: number;
  runId: string;
}> {
  // Get company intelligence record
  const companies = await storage.getCompanyIntelligenceRecords({});
  const company = companies.find(c => c.id === companyId);
  if (!company) {
    console.warn(`[ContactDiscovery] Company ${companyId} not found`);
    return { contactsFound: 0, fallbackContactsCreated: 0, runId: "" };
  }

  // Create discovery run record
  const [run] = await db.insert(contactDiscoveryRuns).values({
    companyId,
    companyName: company.companyName,
    opportunityId: opportunityId ?? null,
    runStatus: "running",
  }).returning();

  let contactsFound = 0;
  let fallbackContactsCreated = 0;

  try {
    // Check for existing contacts
    const existingContacts = await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.companyIntelligenceId, companyId))
      .limit(10);

    const hasDirectContacts = existingContacts.some(c => c.contactType === "direct");

    if (!hasDirectContacts) {
      // Attempt AI-based discovery
      const aiContacts = await discoverContactsViaAI(
        company.companyName,
        company.industry,
        company.city
      );

      for (const contact of aiContacts) {
        // Check for duplicate by role
        const dupCheck = existingContacts.find(ec =>
          ec.role?.toLowerCase() === contact.role?.toLowerCase()
        );
        if (dupCheck) continue;

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
          contactSource: "ai_generated",
          contactType: "direct",
        });

        // Log verification
        await db.insert(contactVerificationLogs).values({
          contactId: run.id, // will update after getting inserted id
          checkType: "ai_confidence",
          result: contact.confidence >= 70 ? "passed" : "warning",
          detailsJson: JSON.stringify({ role: contact.role, confidence: contact.confidence }),
        });

        contactsFound++;
      }
    }

    // Always create a fallback generic contact if no email contacts exist
    const hasEmailContacts = existingContacts.some(c => c.email) || contactsFound > 0;
    if (!hasEmailContacts) {
      const genericEmail = buildGenericEmail(company.companyName);
      await db.insert(companyContacts).values({
        companyIntelligenceId: companyId,
        companyName: company.companyName,
        contactName: "Office Team",
        firstName: "Office",
        lastName: "Team",
        role: "Office Contact",
        department: "General",
        email: genericEmail,
        confidenceScore: 30,
        verificationStatus: "generic_fallback",
        isPrimary: existingContacts.length === 0,
        contactSource: "inferred",
        contactType: "generic_fallback",
        notes: "Generic fallback — request forwarding to correct contact",
      });
      fallbackContactsCreated++;
    }

    // Complete the run
    await db
      .update(contactDiscoveryRuns)
      .set({
        runStatus: "completed",
        contactsFound,
        fallbackContactsCreated,
        completedAt: new Date(),
      })
      .where(eq(contactDiscoveryRuns.id, run.id));

    console.log(`[ContactDiscovery] ${company.companyName}: ${contactsFound} direct, ${fallbackContactsCreated} fallback`);
  } catch (err: any) {
    await db
      .update(contactDiscoveryRuns)
      .set({ runStatus: "failed", errorMessage: err.message, completedAt: new Date() })
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
      // Check if already has contacts
      const existing = await db
        .select()
        .from(companyContacts)
        .where(eq(companyContacts.companyIntelligenceId, co.id))
        .limit(1);
      if (existing.length > 0) continue;

      await runContactDiscovery(co.id);
    } catch (err) {
      console.error(`[ContactDiscovery] Error for ${co.companyName}:`, err);
    }
  }
}
