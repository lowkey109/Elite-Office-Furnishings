import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Quote } from "@shared/schema";

const fmt = (n?: number | null) => n ? `$${Number(n).toLocaleString("en-AU")}` : "$0";
const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function getQuoteId(): string {
  const parts = window.location.pathname.split("/");
  const idx = parts.indexOf("quotes");
  return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : "";
}

export default function QuotePrint() {
  const quoteId = getQuoteId();

  const { data: quote, isLoading, isError } = useQuery<Quote>({
    queryKey: ["/api/admin/quotes", quoteId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/quotes/${quoteId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!quoteId,
    retry: false,
  });

  useEffect(() => {
    if (quote) {
      document.title = `Quote ${quote.quoteNumber} — The Corporate Desk`;
    }
  }, [quote]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f3f0", fontFamily: "Georgia, serif" }}>
        <div style={{ color: "#888", fontSize: 14 }}>Loading quote…</div>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f3f0", fontFamily: "Georgia, serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#c05050", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Quote Not Found</div>
          <div style={{ color: "#888", fontSize: 14 }}>This quote may have been deleted or the link is incorrect.</div>
        </div>
      </div>
    );
  }

  let items: any[] = [];
  if (Array.isArray(quote.quoteItems)) {
    items = quote.quoteItems;
  }

  const validUntil = (() => {
    const d = new Date(quote.createdAt!);
    d.setDate(d.getDate() + (quote.validityDays ?? 30));
    return d;
  })();

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .page-wrap { padding: 0 !important; }
        }
        @page { margin: 12mm 14mm; size: A4 portrait; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #f5f3f0; }
      `}</style>

      {/* Print button bar - hidden on print */}
      <div className="no-print" style={{ background: "#0f0f13", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#c9a84c", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>The Corporate Desk</span>
          <span style={{ color: "#333", fontSize: 12 }}>·</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>Quote {quote.quoteNumber}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa", fontSize: 12, padding: "7px 16px", borderRadius: 8, cursor: "pointer" }}
          >
            ← Back
          </button>
          <button
            data-testid="button-print"
            onClick={() => window.print()}
            style={{ background: "#c9a84c", border: "none", color: "#0f0f13", fontWeight: 700, fontSize: 13, padding: "8px 20px", borderRadius: 8, cursor: "pointer" }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* A4 page */}
      <div className="page-wrap" style={{ background: "#f5f3f0", minHeight: "100vh", padding: "24px 16px" }}>
        <div style={{ maxWidth: 794, margin: "0 auto", background: "#ffffff", boxShadow: "0 4px 40px rgba(0,0,0,0.12)", borderRadius: 4 }}>

          {/* Header */}
          <div style={{ background: "#0f0f13", padding: "36px 44px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: "#c9a84c", fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Arial, sans-serif" }}>
                  The Corporate Desk
                </div>
                <div style={{ color: "#ffffff", fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", lineHeight: 1.2 }}>
                  Formal Quotation
                </div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6, fontFamily: "Arial, sans-serif" }}>
                  thecorporatedesk.com.au · 1300 977 607
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 4 }}>
                  Quote Reference
                </div>
                <div style={{ color: "#c9a84c", fontSize: 18, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>
                  {quote.quoteNumber}
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 8, fontFamily: "Arial, sans-serif" }}>
                  Issued: {fmtDate(quote.createdAt)}
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
                  Valid Until: {fmtDate(validUntil)}
                </div>
              </div>
            </div>
          </div>

          {/* Client + Project info */}
          <div style={{ padding: "28px 44px", background: "#fafaf8", borderBottom: "1px solid #ece9e4", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ color: "#888", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 10 }}>
                Prepared For
              </div>
              <div style={{ color: "#1a1a1a", fontSize: 16, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 4 }}>
                {quote.clientName}
              </div>
              {quote.companyName && (
                <div style={{ color: "#555", fontSize: 14, fontFamily: "Arial, sans-serif", marginBottom: 4 }}>
                  {quote.companyName}
                </div>
              )}
              {quote.email && (
                <div style={{ color: "#888", fontSize: 12, fontFamily: "Arial, sans-serif" }}>{quote.email}</div>
              )}
              {quote.phone && (
                <div style={{ color: "#888", fontSize: 12, fontFamily: "Arial, sans-serif" }}>{quote.phone}</div>
              )}
            </div>
            <div>
              <div style={{ color: "#888", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 10 }}>
                Project Details
              </div>
              {quote.officeSizeSqm && (
                <div style={{ color: "#555", fontSize: 13, fontFamily: "Arial, sans-serif", marginBottom: 3 }}>
                  Office Size: <strong>{quote.officeSizeSqm} m²</strong>
                </div>
              )}
              {quote.staffCount && (
                <div style={{ color: "#555", fontSize: 13, fontFamily: "Arial, sans-serif", marginBottom: 3 }}>
                  Staff Count: <strong>{quote.staffCount} people</strong>
                </div>
              )}
              {quote.projectSummary && (
                <div style={{ color: "#666", fontSize: 12, fontFamily: "Arial, sans-serif", marginTop: 8, lineHeight: 1.6, fontStyle: "italic" }}>
                  {quote.projectSummary}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ padding: "28px 44px" }}>
            <div style={{ color: "#888", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 12 }}>
              Itemised Schedule of Works
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f0f13" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#c9a84c", fontWeight: 700, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    Description
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: "#c9a84c", fontWeight: 700, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", width: 90 }}>
                    Category
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "center", color: "#c9a84c", fontWeight: 700, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", width: 55 }}>
                    Qty
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#c9a84c", fontWeight: 700, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", width: 100 }}>
                    Unit Price
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#c9a84c", fontWeight: 700, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", width: 100 }}>
                    Line Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafaf8", borderBottom: "1px solid #ece9e4" }}>
                    <td style={{ padding: "10px 12px", color: "#1a1a1a", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600 }}>{item.productName}</div>
                      {item.variant && <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>{item.variant}</div>}
                      {item.sku && <div style={{ color: "#aaa", fontSize: 10, marginTop: 1, fontFamily: "monospace" }}>SKU: {item.sku}</div>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#777", verticalAlign: "top" }}>{item.category}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#1a1a1a", verticalAlign: "top" }}>{item.quantity}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#555", verticalAlign: "top" }}>{fmt(item.unitPrice)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#1a1a1a", fontWeight: 600, verticalAlign: "top" }}>{fmt(item.lineTotal)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#aaa", fontStyle: "italic" }}>
                      No line items specified — contact us for a detailed itemised schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <table style={{ width: 280, fontFamily: "Arial, sans-serif", fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "5px 12px", color: "#777" }}>Subtotal (ex GST)</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: "#1a1a1a" }}>{fmt(quote.subtotal)}</td>
                  </tr>
                  {(quote.freightCost ?? 0) > 0 && (
                    <tr>
                      <td style={{ padding: "5px 12px", color: "#777" }}>Freight & Delivery</td>
                      <td style={{ padding: "5px 12px", textAlign: "right", color: "#1a1a1a" }}>{fmt(quote.freightCost)}</td>
                    </tr>
                  )}
                  {(quote.installationCost ?? 0) > 0 && (
                    <tr>
                      <td style={{ padding: "5px 12px", color: "#777" }}>Installation</td>
                      <td style={{ padding: "5px 12px", textAlign: "right", color: "#1a1a1a" }}>{fmt(quote.installationCost)}</td>
                    </tr>
                  )}
                  {(quote.otherCosts ?? 0) > 0 && (
                    <tr>
                      <td style={{ padding: "5px 12px", color: "#777" }}>Other Costs</td>
                      <td style={{ padding: "5px 12px", textAlign: "right", color: "#1a1a1a" }}>{fmt(quote.otherCosts)}</td>
                    </tr>
                  )}
                  {(quote.discount ?? 0) > 0 && (
                    <tr>
                      <td style={{ padding: "5px 12px", color: "#c05050" }}>Discount</td>
                      <td style={{ padding: "5px 12px", textAlign: "right", color: "#c05050" }}>−{fmt(quote.discount)}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: "1px solid #ece9e4" }}>
                    <td style={{ padding: "8px 12px", color: "#555", fontWeight: 600 }}>GST (10%)</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#555", fontWeight: 600 }}>{fmt(quote.gst)}</td>
                  </tr>
                  <tr style={{ background: "#0f0f13" }}>
                    <td style={{ padding: "12px", color: "#c9a84c", fontWeight: 700, fontSize: 15, fontFamily: "Georgia, serif" }}>
                      Total (inc. GST)
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#c9a84c", fontWeight: 700, fontSize: 18, fontFamily: "Georgia, serif" }}>
                      {fmt(quote.totalIncGst)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Finance Option */}
          {(quote.financeMonthlyEstimate ?? 0) > 0 && (
            <div style={{ margin: "0 44px 24px", background: "#fffbf0", border: "1px solid #e8d9a0", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ color: "#8a6d00", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 6 }}>
                Finance Option Available
              </div>
              <div style={{ color: "#1a1a1a", fontSize: 13, fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
                Fund this project for approximately <strong style={{ fontSize: 16 }}>{fmt(quote.financeMonthlyEstimate)}/month</strong> over 60 months — subject to lender approval.
                Contact us for a full commercial finance assessment tailored to your business.
              </div>
            </div>
          )}

          {/* Notes */}
          {quote.notes && (
            <div style={{ margin: "0 44px 24px", background: "#f7f5f2", border: "1px solid #ece9e4", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ color: "#888", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 8 }}>
                Notes & Conditions
              </div>
              <div style={{ color: "#555", fontSize: 13, fontFamily: "Arial, sans-serif", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {quote.notes}
              </div>
            </div>
          )}

          {/* Terms & Signature */}
          <div style={{ margin: "0 44px", borderTop: "1px solid #ece9e4", paddingTop: 24, paddingBottom: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 28 }}>
              <div>
                <div style={{ color: "#888", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 12 }}>
                  Terms & Conditions
                </div>
                <ul style={{ color: "#666", fontSize: 11, fontFamily: "Arial, sans-serif", lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                  <li>Prices are valid for {quote.validityDays ?? 30} days from the date of this quotation.</li>
                  <li>All prices are in Australian dollars (AUD).</li>
                  <li>GST of 10% is included in the Total.</li>
                  <li>Delivery timeframes subject to stock availability.</li>
                  <li>A 50% deposit is required to confirm the order.</li>
                  <li>Freight and installation charges as itemised above.</li>
                  <li>Finance estimates are indicative only and subject to lender credit assessment.</li>
                </ul>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 12 }}>
                  Acceptance
                </div>
                <div style={{ color: "#666", fontSize: 12, fontFamily: "Arial, sans-serif", marginBottom: 20, lineHeight: 1.6 }}>
                  To accept this quotation, please sign below and return to us, or reply to the email accompanying this quote. A 50% deposit invoice will be issued upon acceptance.
                </div>
                <div style={{ borderTop: "1px solid #aaa", marginTop: 32, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#aaa", fontSize: 10, fontFamily: "Arial, sans-serif" }}>Authorised Signature</span>
                  <span style={{ color: "#aaa", fontSize: 10, fontFamily: "Arial, sans-serif" }}>Date</span>
                </div>
                <div style={{ color: "#bbb", fontSize: 10, fontFamily: "Arial, sans-serif", marginTop: 12 }}>
                  Name: ___________________________
                </div>
                <div style={{ color: "#bbb", fontSize: 10, fontFamily: "Arial, sans-serif", marginTop: 8 }}>
                  Position: ________________________
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: "#0f0f13", padding: "20px 44px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#c9a84c", fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: 4 }}>
                The Corporate Desk
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
                Premium Commercial Office Furniture · Australia
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
                1300 977 607 · service@thecorporatedesk.com.au
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "Arial, sans-serif", marginTop: 2 }}>
                thecorporatedesk.com.au · {quote.quoteNumber} · Prepared by {quote.preparedBy ?? "The Corporate Desk"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
