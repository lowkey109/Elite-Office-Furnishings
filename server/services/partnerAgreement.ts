const TCD_COMPANY = "The Corporate Desk Pty Ltd";
const TCD_ABN = "ABN as registered";
const TCD_JURISDICTION = "Queensland, Australia";

export interface AgreementParty {
  contactName: string;
  companyName: string;
  email: string;
  abn?: string | null;
  city?: string | null;
  state?: string | null;
}

export function generateAgreementText(partner: AgreementParty, templateVersion = "v1"): string {
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const partnerLocation = [partner.city, partner.state].filter(Boolean).join(", ") || "Australia";
  const partnerAbn = partner.abn ? `ABN ${partner.abn}` : "";

  return `PARTNER REFERRAL AGREEMENT
Template Version: ${templateVersion}
Date: ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTIES

(1) ${TCD_COMPANY} (${TCD_ABN}) ("The Corporate Desk")
    A commercial workspace solutions company operating across Australia.

(2) ${partner.contactName} of ${partner.companyName}${partnerAbn ? ` (${partnerAbn})` : ""}, located at ${partnerLocation} ("Referral Partner")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ARRANGEMENT

This Agreement establishes a non-exclusive referral arrangement between the parties. The Referral Partner agrees to introduce commercial workspace opportunities to The Corporate Desk. This is a referral and introducer arrangement only.

The Referral Partner is not, and shall not hold themselves out as, an employee, agent, or representative of The Corporate Desk, and has no authority to bind The Corporate Desk to any obligation, contract, or representation.

2. SERVICES SCOPE

The Referral Partner may introduce potential clients who are seeking office furniture supply, workspace design, fitout coordination, or related commercial workspace services provided by The Corporate Desk.

The Corporate Desk retains full discretion over which opportunities to pursue, how to service any client, and the pricing and terms applicable to any project.

3. COMMISSION STRUCTURE

Upon successful completion of a project where:

  (a) the client was directly introduced by the Referral Partner;
  (b) the project has been invoiced and delivered by The Corporate Desk; and
  (c) the client has made full payment in cleared funds to The Corporate Desk,

The Corporate Desk will pay the Referral Partner a referral commission of 7.5% of the verified project value (excluding GST), unless a different rate has been agreed separately in writing by both parties.

Commission is calculated on the project value received from the client, excluding any delivery, installation, or third-party costs not supplied by The Corporate Desk.

4. PAYMENT TERMS

Commission will be calculated and paid within thirty (30) days of full client payment being received and cleared by The Corporate Desk.

No commission is payable on projects that are:
  - cancelled prior to client payment;
  - disputed by the client;
  - not fully paid by the client; or
  - introduced without prior disclosure to The Corporate Desk.

5. NON-EXCLUSIVITY

This Agreement is non-exclusive. The Referral Partner may refer opportunities to other providers. The Corporate Desk may engage other referral partners and continue its own business development activities independent of this Agreement.

6. CONFIDENTIALITY

Each party agrees to keep confidential any non-public information received from the other party in connection with this Agreement, including but not limited to client information, pricing, and business strategy. This obligation survives the termination of this Agreement.

7. NO AGENCY — NO AUTHORITY

Nothing in this Agreement creates any agency, partnership, joint venture, employment, or franchise relationship between the parties.

The Referral Partner must not:
  - make any commitment, representation, or quotation on behalf of The Corporate Desk;
  - accept orders or sign contracts on behalf of The Corporate Desk; or
  - represent that they have any authority to act on behalf of The Corporate Desk.

8. LIMITATION OF LIABILITY

To the maximum extent permitted by applicable law, The Corporate Desk's total liability to the Referral Partner for any claim arising under or in connection with this Agreement is limited to the commission amount (if any) attributable to the relevant referral.

Neither party is liable to the other for indirect, consequential, special, or punitive damages arising under this Agreement, regardless of the cause of action.

9. TERMINATION

Either party may terminate this Agreement with thirty (30) days written notice to the other party. Termination does not affect the entitlement to commission on opportunities that were submitted, accepted, and actively progressing prior to the effective date of termination.

10. GOVERNING LAW

This Agreement is governed by and construed in accordance with the laws of ${TCD_JURISDICTION}. Both parties submit to the non-exclusive jurisdiction of the courts of ${TCD_JURISDICTION}.

11. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties with respect to the referral arrangement described herein and supersedes all prior discussions, representations, and agreements relating to that subject matter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIGITAL ACCEPTANCE

By digitally accepting this Agreement, the Referral Partner confirms that they have read, understood, and agree to be bound by all terms and conditions of this Partner Referral Agreement.

Partner: ${partner.contactName} (${partner.companyName})
Email: ${partner.email}`;
}

export function getAgreementTemplateVersion(): string {
  return "v1";
}
