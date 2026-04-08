import type { FollowUpSequence } from "@shared/schema";

const FROM = "The Corporate Desk <onboarding@resend.dev>";
const ADMIN_EMAIL = "thecorporatedeskservice@gmail.com";
const SITE_URL = "https://thecorporatedesk.com.au";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function p(text: string): string {
  return `<p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7;">${text}</p>`;
}

function cta(label: string, href: string): string {
  return `<div style="margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:#1a1a1a;color:#c9a84c;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.5px;">${label}</a>
  </div>`;
}

function signature(): string {
  return `<p style="margin:28px 0 0 0;color:#9ca3af;font-size:13px;line-height:1.6;">
    Warm regards,<br>
    <strong style="color:#374151;">The Corporate Desk Team</strong><br>
    <span style="color:#c9a84c;">thecorporatedesk.com.au</span><br>
    1300 XXX XXX — Brisbane, QLD
  </p>`;
}

function template(subject: string, body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#1a1a1a;padding:28px 36px;display:flex;align-items:center;gap:12px;">
      <div style="color:#c9a84c;font-size:18px;font-weight:700;letter-spacing:1px;">THE CORPORATE DESK</div>
    </div>
    <div style="padding:36px;">
      ${body}
      ${signature()}
    </div>
    <div style="background:#f3f4f6;padding:16px 36px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        You're receiving this because you submitted an enquiry at thecorporatedesk.com.au. 
        If you've already spoken with our team, please disregard this email.
      </p>
    </div>
  </div>
</body></html>`;
}

// ─── Stage Content by Lead Type ───────────────────────────────────────────────

interface StageContent {
  subject: string;
  body: string;
}

function getStageContent(seq: FollowUpSequence, stage: number): StageContent {
  const firstName = seq.leadName.split(" ")[0];
  const company = seq.leadCompany;
  const type = seq.leadType;

  const budgetNote = seq.budgetMin && seq.budgetMax
    ? `$${seq.budgetMin.toLocaleString("en-AU")} – $${seq.budgetMax.toLocaleString("en-AU")}`
    : seq.budgetMin
    ? `from $${seq.budgetMin.toLocaleString("en-AU")}`
    : seq.budgetMax
    ? `up to $${seq.budgetMax.toLocaleString("en-AU")}`
    : null;

  const contextNote = [
    seq.officeSizeSqm && `${seq.officeSizeSqm} sqm office`,
    seq.staffCount && `${seq.staffCount} team members`,
    budgetNote && `budget of ${budgetNote}`,
  ]
    .filter(Boolean)
    .join(", ");

  // ─── STAGE 1: Day 1 — Warm follow-up ─────────────────────────────────────

  if (stage === 1) {
    if (type === "quote-builder") {
      return {
        subject: `${firstName}, your workspace estimate is ready to discuss`,
        body: `
          ${p(`Hi ${firstName},`)}
          ${p(`I wanted to personally follow up on the workspace estimate you received for <strong>${company}</strong>.${contextNote ? ` Based on what you shared — ${contextNote} — the estimate gives you a strong starting point.` : ""}`)}
          ${p(`The estimate is built around your specific requirements, but the real value comes from a quick conversation where we can refine it, explore product options, and make sure the package fits exactly what you need.`)}
          ${p(`Are you free for a 20-minute call this week? I can walk you through the estimate in detail and answer any questions.`)}
          ${cta("Book a Quick Call", `${SITE_URL}/workplace-strategy`)}
          ${p(`Or simply reply to this email — whichever is easier for you.`)}`,
      };
    }

    if (type === "finance-lead") {
      return {
        subject: `${firstName}, your finance options for ${company}`,
        body: `

          ${p(`Hi ${firstName},`)}
          ${p(`Thank you for your interest in financing your office fit-out. I wanted to follow up to make sure you have everything you need to move forward with confidence.`)}
          ${p(`We work with three specialist commercial finance partners — Stratton Finance, QPF Finance, and Vestone Capital — depending on your project size and structure. Most clients are approved within 24–48 hours and can spread the cost over 24–60 months, keeping cash in the business while getting the office done now.`)}
          ${p(`If you have a project value in mind, I can point you to the right lender and give you a rate estimate immediately.`)}
          ${cta("Explore Finance Options", `${SITE_URL}/finance-your-workspace`)}`,
      };
    }

    if (type === "planning-request" || type === "planner") {
      return {
        subject: `${firstName}, your office layout plan update`,
        body: `
          ${p(`Hi ${firstName},`)}
          ${p(`I'm following up on your office layout planning request for <strong>${company}</strong>.${contextNote ? ` Your project details — ${contextNote} — give us a solid foundation to work from.` : ""}`)}
          ${p(`Our AI planning system has analysed your requirements. If you'd like to discuss the recommendations or get a more detailed layout plan with product specifications and cost breakdown, I'd love to connect.`)}
          ${p(`A 20-minute call is usually all it takes to turn an AI brief into a complete project proposal.`)}
          ${cta("Discuss Your Layout Plan", `${SITE_URL}/workplace-strategy`)}`,
      };
    }

    // Default — contact/enquiry/strategy
    return {
      subject: `${firstName}, following up on your enquiry`,
      body: `
        ${p(`Hi ${firstName},`)}
        ${p(`Thank you for reaching out to The Corporate Desk about <strong>${company}</strong>'s workspace needs. I wanted to personally follow up to make sure your enquiry gets the attention it deserves.`)}
        ${p(`Whether you're planning a full office fit-out, refreshing your current space, or just exploring options, we're here to help you make the right decisions — without any pressure.`)}
        ${p(`What's the best way to connect? A quick call, an email conversation, or a visit to our Brisbane showroom — whichever works for you.`)}
        ${cta("Book a Workspace Consultation", `${SITE_URL}/workplace-strategy`)}`,
    };
  }

  // ─── STAGE 2: Day 3 — Value content ───────────────────────────────────────

  if (stage === 2) {
    if (type === "quote-builder" || type === "finance-lead") {
      return {
        subject: `The cost of delaying your office fit-out — and how to avoid it`,
        body: `
          ${p(`Hi ${firstName},`)}
          ${p(`A quick note with something that might be useful for your planning at <strong>${company}</strong>.`)}
          ${p(`One of the most common mistakes we see is leaving the furniture decision until the last minute. Standard products take 4–6 weeks from order to installation. Custom finishes and sit-stand desks can take 8–14 weeks. If your lease handover or move-in date is fixed, every week of delay compresses your timeline — and that can mean rushed decisions or premium freight costs.`)}
          ${p(`The teams who end up with the best outcomes are the ones who lock in their furniture package early — while installation slots are available and without pressure.`)}
          ${p(`If you're working to a timeline, it's worth having that conversation now rather than in 6 weeks. I can give you a realistic schedule based on your project.`)}
          ${cta("Get a Timeline Estimate", `${SITE_URL}/workplace-strategy`)}
          ${p(`No commitment required — just a clear picture of what's achievable.`)}`,
      };
    }

    return {
      subject: `How Australian companies are fitting out smarter in 2025`,
      body: `
        ${p(`Hi ${firstName},`)}
        ${p(`I thought this might be useful as you think through <strong>${company}</strong>'s workspace.`)}
        ${p(`The most significant shift we're seeing across Australian commercial fit-outs right now is the move toward hybrid-ready offices. Companies are reducing fixed desks by 20–30% and reinvesting that budget into collaboration zones, acoustic booths, and premium breakout areas — because the office now competes for attendance against home.`)}
        ${p(`The result is offices that feel more premium, more intentional, and more aligned with how people actually work post-2022 — often for a similar overall budget.`)}
        ${p(`If you'd like to see how this could apply to ${company}'s space, I'm happy to share some examples from recent projects.`)}
        ${cta("See Recent Projects", `${SITE_URL}/case-studies`)}`,
    };
  }

  // ─── STAGE 3: Day 7 — Social proof ────────────────────────────────────────

  if (stage === 3) {
    return {
      subject: `What our clients say — and why it matters for ${company}`,
      body: `
        ${p(`Hi ${firstName},`)}
        ${p(`I know you're busy, so I'll keep this brief.`)}
        ${p(`We've delivered over 500 commercial office fit-outs across Australia, from 5-person startups to 150-person corporate headquarters. The most consistent feedback we receive isn't about the furniture itself — it's about the experience: clear communication, no surprises, and an end result that genuinely impresses their team and clients.`)}
        ${p(`That's what we aim to deliver for every project, including yours.`)}
        ${p(`If you're still weighing up options, I'd be happy to share some specific project references from your industry — so you can see exactly what's possible and get a realistic picture of the investment.`)}
        ${cta("View Our Case Studies", `${SITE_URL}/case-studies`)}
        ${p(`Alternatively, our Quote Builder gives you an AI-powered estimate in under 5 minutes, with no obligation.`)}
        ${cta("Get an Instant Estimate", `${SITE_URL}/quote-builder`)}`,
    };
  }

  // ─── STAGE 4: Day 14 — Final touch ────────────────────────────────────────

  return {
    subject: `One last note, ${firstName}`,
    body: `
      ${p(`Hi ${firstName},`)}
      ${p(`I've reached out a few times about <strong>${company}</strong>'s workspace and I don't want to be a bother — so this will be my last follow-up unless you'd like to reconnect.`)}
      ${p(`If the timing isn't right or your plans have changed, that's completely fine. We work on projects at all stages — whether you need something next month or are planning 12 months ahead.`)}
      ${p(`When you're ready — even if it's months from now — we'd love to help. You can reach us anytime through the link below, or simply reply to this email.`)}
      ${cta("Start the Conversation", `${SITE_URL}/contact`)}
      ${p(`Wishing you and the team at ${company} all the best.`)}`,
  };
}

// ─── Sequence Schedule ────────────────────────────────────────────────────────

const STAGE_DELAYS_HOURS: Record<number, number> = {
  1: 24,    // Day 1
  2: 72,    // Day 3
  3: 168,   // Day 7
  4: 336,   // Day 14
};

export const TOTAL_STAGES = 4;

export function getNextSendAt(stage: number): Date | null {
  const hours = STAGE_DELAYS_HOURS[stage];
  if (!hours) return null;
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

// ─── Build and send one follow-up email ──────────────────────────────────────

export async function sendFollowUpEmail(
  seq: FollowUpSequence,
  stage: number,
  sendEmailFn: (opts: { to: string; subject: string; html: string }) => Promise<void>
): Promise<void> {
  const { subject, body } = getStageContent(seq, stage);
  const html = template(subject, body);
  await sendEmailFn({ to: seq.leadEmail, subject, html });
}

export { STAGE_DELAYS_HOURS };
