import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = "procurement-quote-store.json";
const OUTBOX_FILE = "procurement-whatsapp-outbox.json";
const QUOTE_LOG_FILE = "procurement-customer-quote-log.json";

type ProcurementItem = {
  name: string;
  model?: string;
  quantity: number;
  dimensions?: string;
  colour?: string;
  notes?: string;
};

type SupplierResponse = {
  supplierName: string;
  unitCost: number;
  shippingCost: number;
  leadTimeWeeks?: number;
  warranty?: string;
  notes?: string;
  receivedAt?: string;
};

type InstallerResponse = {
  installerName: string;
  installCost: number;
  notes?: string;
  receivedAt?: string;
};

type QuoteRequest = {
  id: string;
  quoteNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    deliveryAddress?: string;
  };
  items: ProcurementItem[];
  project: {
    deliverySuburb?: string;
    deliveryState?: string;
    installRequired: boolean;
    urgency?: string;
    notes?: string;
  };
  installer: {
    selectedInstallerId?: string;
    estimatedInstallCost?: number;
    response?: InstallerResponse;
  };
  supplier: {
    response?: SupplierResponse;
  };
  pricing?: any;
  customerQuote?: any;
};

const INSTALLERS = [
  {
    id: "kitset-assembly-services-liam-flew",
    companyName: "Kitset Assembly Services",
    contactName: "Liam Flew",
    role: "Country Manager - Australia",
    email: "liam@teamkitset.com",
    whatsapp: "+61497977002",
    phoneAu: "0497977002",
    phoneNz: "0274926664",
    address: "16 Nexus Way, Southport, QLD 4215",
    serviceArea: ["QLD", "NSW", "AU"],
    source: "Assembler for office Furniture PDF",
    pricingIncludesGst: true,
    assumptions: [
      "Indicative estimate until photos/details are reviewed.",
      "Assumes no rubbish removal required.",
      "Assumes boxes are in the room of assembly ready to be assembled.",
      "Missing instructions can slow install significantly and may double install time."
    ],
    installRates: {
      smallCabinet: 149,
      largeCabinet: 280,
      extraLargeExecutiveDesk: 450,
      smallReceptionDesk: 149,
      largeReceptionDesk: 280,
      largerCabinet: 320,
      largerManagersDesk: 250,
      executiveDeskLarge: 280,
      officePod: 690,
      mediumCabinet: 250,
      mediumReceptionDesk: 189,
      smallManagersDesk: 199
    }
  }
];

function now() {
  return new Date().toISOString();
}

async function readJson(fileName: string, fallback: any) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(fileName: string, data: any) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2), "utf8");
}

function money(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function inferInstallRateKey(item: ProcurementItem) {
  const text = [item.name, item.model, item.notes].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("office pod")) return "officePod";
  if (text.includes("extra large") && text.includes("executive")) return "extraLargeExecutiveDesk";
  if (text.includes("executive desk")) return "executiveDeskLarge";
  if (text.includes("large") && text.includes("reception")) return "largeReceptionDesk";
  if (text.includes("medium") && text.includes("reception")) return "mediumReceptionDesk";
  if (text.includes("small") && text.includes("reception")) return "smallReceptionDesk";
  if (text.includes("reception")) return "largeReceptionDesk";
  if (text.includes("manager") && text.includes("large")) return "largerManagersDesk";
  if (text.includes("manager")) return "smallManagersDesk";
  if (text.includes("large") && text.includes("cabinet")) return "largeCabinet";
  if (text.includes("medium") && text.includes("cabinet")) return "mediumCabinet";
  if (text.includes("cabinet")) return "smallCabinet";

  return "largeReceptionDesk";
}

function estimateInstallCost(items: ProcurementItem[]) {
  const installer = INSTALLERS[0];
  let total = 0;
  const breakdown = items.map((item) => {
    const key = inferInstallRateKey(item);
    const unit = Number((installer.installRates as any)[key] || 0);
    const qty = Number(item.quantity || 1);
    const lineTotal = money(unit * qty);
    total += lineTotal;
    return {
      itemName: item.name,
      model: item.model || null,
      quantity: qty,
      rateKey: key,
      unitInstallCostInclGst: unit,
      lineInstallCostInclGst: lineTotal
    };
  });

  return {
    installerId: installer.id,
    installerName: installer.companyName,
    contactName: installer.contactName,
    estimatedInstallCostInclGst: money(total),
    breakdown,
    assumptions: installer.assumptions
  };
}

function generateQuoteNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return "TCD-Q-" + ymd + "-" + String(Date.now()).slice(-5);
}

function requiredString(value: any, fallback = "") {
  return String(value || fallback).trim();
}

async function getStore() {
  return await readJson(STORE_FILE, { requests: [] });
}

async function saveStore(store: any) {
  await writeJson(STORE_FILE, store);
}

export async function listProcurementInstallers() {
  return {
    ok: true,
    count: INSTALLERS.length,
    installers: INSTALLERS
  };
}

export async function createProcurementQuoteRequest(input: any) {
  const store = await getStore();
  const requests = Array.isArray(store.requests) ? store.requests : [];

  const id = "proc-quote-" + Date.now();
  const items = Array.isArray(input.items) && input.items.length
    ? input.items.map((item: any) => ({
        name: requiredString(item.name, "Office furniture item"),
        model: item.model ? String(item.model) : undefined,
        quantity: Math.max(1, Number(item.quantity || 1)),
        dimensions: item.dimensions ? String(item.dimensions) : undefined,
        colour: item.colour ? String(item.colour) : undefined,
        notes: item.notes ? String(item.notes) : undefined
      }))
    : [
        {
          name: "Modern Executive Reception Desk",
          model: "RD-3000-GR",
          quantity: 1,
          dimensions: "W 3000 x D 2000 x H 760 / 1100 mm",
          colour: "Grey + Black trim + warm LED",
          notes: "Curved executive reception desk with LED lighting"
        }
      ];

  const installEstimate = estimateInstallCost(items);

  const request: QuoteRequest = {
    id,
    quoteNumber: generateQuoteNumber(),
    status: "quote_request_created",
    createdAt: now(),
    updatedAt: now(),
    customer: {
      name: requiredString(input.customer?.name || input.customerName, "Customer"),
      email: input.customer?.email || input.customerEmail || undefined,
      phone: input.customer?.phone || input.customerPhone || undefined,
      company: input.customer?.company || input.companyName || undefined,
      deliveryAddress: input.customer?.deliveryAddress || input.deliveryAddress || undefined
    },
    items,
    project: {
      deliverySuburb: input.project?.deliverySuburb || input.deliverySuburb || undefined,
      deliveryState: input.project?.deliveryState || input.deliveryState || undefined,
      installRequired: input.project?.installRequired !== false,
      urgency: input.project?.urgency || undefined,
      notes: input.project?.notes || input.notes || undefined
    },
    installer: {
      selectedInstallerId: installEstimate.installerId,
      estimatedInstallCost: installEstimate.estimatedInstallCostInclGst
    },
    supplier: {}
  };

  store.requests = [request, ...requests].slice(0, 1000);
  await saveStore(store);

  return {
    ok: true,
    request,
    installEstimate
  };
}

export async function getProcurementQuoteRequest(id: string) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  return { ok: true, request };
}

export async function listProcurementQuoteRequests() {
  const store = await getStore();
  const requests = Array.isArray(store.requests) ? store.requests : [];

  return {
    ok: true,
    count: requests.length,
    requests
  };
}

function buildInstallerRfqMessage(request: QuoteRequest) {
  const lines = request.items.map((item) =>
    `- ${item.quantity} x ${item.name}${item.model ? " (" + item.model + ")" : ""}${item.dimensions ? " — " + item.dimensions : ""}`
  );

  return `Hi Liam, this is The Corporate Desk.

Can you please provide/confirm install pricing and availability for this customer quote?

Items:
${lines.join("\n")}

Delivery / install location:
${request.customer.deliveryAddress || request.project.deliverySuburb || "TBC"}

Please confirm:
1. Install cost incl. GST
2. Availability / lead time
3. Any site requirements
4. Whether rubbish removal is excluded

Quote ref: ${request.quoteNumber}

Thanks.`;
}

function buildManufacturerRfqMessage(request: QuoteRequest) {
  const lines = request.items.map((item) =>
    `- ${item.quantity} x ${item.name}${item.model ? " (" + item.model + ")" : ""}${item.colour ? " — " + item.colour : ""}${item.dimensions ? " — " + item.dimensions : ""}`
  );

  return `Hi, this is The Corporate Desk.

Please quote supply pricing for:

${lines.join("\n")}

Delivery address/suburb:
${request.customer.deliveryAddress || request.project.deliverySuburb || "TBC"}

Please provide:
1. Unit price
2. Shipping cost
3. Lead time
4. Warranty
5. Packing details
6. Any install notes

Quote ref: ${request.quoteNumber}

Thanks.`;
}

async function appendWhatsAppOutbox(entry: any) {
  const outbox = await readJson(OUTBOX_FILE, { messages: [] });
  const messages = Array.isArray(outbox.messages) ? outbox.messages : [];

  outbox.messages = [
    {
      id: "wa-outbox-" + Date.now(),
      createdAt: now(),
      status: "queued",
      ...entry
    },
    ...messages
  ].slice(0, 1000);

  await writeJson(OUTBOX_FILE, outbox);

  return outbox.messages[0];
}

export async function queueInstallerRfq(id: string) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  const installer = INSTALLERS[0];
  const message = buildInstallerRfqMessage(request);

  const queued = await appendWhatsAppOutbox({
    channel: "whatsapp",
    direction: "outbound",
    purpose: "installer_rfq",
    quoteRequestId: id,
    quoteNumber: request.quoteNumber,
    toName: installer.contactName,
    toCompany: installer.companyName,
    to: installer.whatsapp,
    body: message,
    realSendPerformed: false,
    note: "Queued for WhatsApp send. Wire this to Twilio/Meta WhatsApp before production auto-send."
  });

  request.status = "installer_rfq_queued";
  request.updatedAt = now();
  await saveStore(store);

  return {
    ok: true,
    queued,
    installer,
    message
  };
}

export async function queueManufacturerRfq(id: string, supplier: any = {}) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  const toName = supplier.name || supplier.companyName || "Manufacturer";
  const to = supplier.whatsapp || supplier.phone || supplier.email || "TBC";
  const message = buildManufacturerRfqMessage(request);

  const queued = await appendWhatsAppOutbox({
    channel: supplier.whatsapp ? "whatsapp" : "manual",
    direction: "outbound",
    purpose: "manufacturer_rfq",
    quoteRequestId: id,
    quoteNumber: request.quoteNumber,
    toName,
    toCompany: supplier.companyName || toName,
    to,
    body: message,
    realSendPerformed: false,
    note: "Queued RFQ. Add approved manufacturer WhatsApp details to enable real send."
  });

  request.status = "manufacturer_rfq_queued";
  request.updatedAt = now();
  await saveStore(store);

  return {
    ok: true,
    queued,
    message
  };
}

export async function listProcurementWhatsAppOutbox() {
  const outbox = await readJson(OUTBOX_FILE, { messages: [] });
  return {
    ok: true,
    count: Array.isArray(outbox.messages) ? outbox.messages.length : 0,
    messages: Array.isArray(outbox.messages) ? outbox.messages : []
  };
}

export async function recordSupplierResponse(id: string, response: SupplierResponse) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  request.supplier.response = {
    supplierName: requiredString(response.supplierName, "Supplier"),
    unitCost: money(Number(response.unitCost || 0)),
    shippingCost: money(Number(response.shippingCost || 0)),
    leadTimeWeeks: response.leadTimeWeeks ? Number(response.leadTimeWeeks) : undefined,
    warranty: response.warranty || undefined,
    notes: response.notes || undefined,
    receivedAt: now()
  };

  request.status = "supplier_response_received";
  request.updatedAt = now();
  await saveStore(store);

  return { ok: true, request };
}

export async function recordInstallerResponse(id: string, response: InstallerResponse) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  request.installer.response = {
    installerName: requiredString(response.installerName, "Kitset Assembly Services"),
    installCost: money(Number(response.installCost || request.installer.estimatedInstallCost || 0)),
    notes: response.notes || undefined,
    receivedAt: now()
  };

  request.status = "installer_response_received";
  request.updatedAt = now();
  await saveStore(store);

  return { ok: true, request };
}

export async function buildCustomerQuote(id: string, options: any = {}) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  const supplier = request.supplier.response;
  if (!supplier) {
    return { ok: false, error: "Supplier response is required before customer quote can be built" };
  }

  const quantity = request.items.reduce((sum: number, item: ProcurementItem) => sum + Number(item.quantity || 1), 0);
  const supplierSubtotal = money(Number(supplier.unitCost || 0) * quantity);
  const shipping = money(Number(supplier.shippingCost || 0));
  const install = request.project.installRequired
    ? money(Number(request.installer.response?.installCost || request.installer.estimatedInstallCost || 0))
    : 0;

  const marginPercent = Number(options.marginPercent ?? 35);
  const preMarginCost = money(supplierSubtotal + shipping + install);
  const marginAmount = money(preMarginCost * (marginPercent / 100));
  const subtotalExGst = money(preMarginCost + marginAmount);
  const gst = money(subtotalExGst * 0.1);
  const totalInclGst = money(subtotalExGst + gst);

  const quote = {
    quoteNumber: request.quoteNumber,
    quoteDate: now().slice(0, 10),
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    customer: request.customer,
    items: request.items,
    publicLineItems: [
      {
        description: request.items.map((item: ProcurementItem) => `${item.quantity} x ${item.name}${item.model ? " (" + item.model + ")" : ""}`).join(", "),
        amountExGst: subtotalExGst
      }
    ],
    inclusions: {
      supply: true,
      shipping: true,
      installation: request.project.installRequired,
      warranty: supplier.warranty || "Manufacturer warranty applies",
      leadTime: supplier.leadTimeWeeks ? `${supplier.leadTimeWeeks} week lead time from deposit/payment` : "Lead time to be confirmed"
    },
    totals: {
      subtotalExGst,
      gst,
      totalInclGst
    },
    internalCosting: {
      supplierSubtotal,
      shipping,
      install,
      preMarginCost,
      marginPercent,
      marginAmount,
      supplierName: supplier.supplierName,
      installerName: request.installer.response?.installerName || "Kitset Assembly Services"
    },
    terms: [
      "Quote subject to final site access and product availability.",
      "Lead time begins once payment/deposit is received.",
      "Installation assumes boxes are in the room of assembly and rubbish removal is excluded unless stated.",
      "Pricing valid until the quote expiry date."
    ],
    bankDetails: {
      note: "Payment details supplied on invoice unless configured in environment."
    }
  };

  request.customerQuote = quote;
  request.pricing = quote.internalCosting;
  request.status = "customer_quote_ready";
  request.updatedAt = now();

  await saveStore(store);

  return { ok: true, quote, request };
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function renderCustomerQuoteHtml(id: string) {
  const result = await getProcurementQuoteRequest(id);
  if (!result.ok) return "<h1>Quote not found</h1>";

  const request = result.request as QuoteRequest;
  const quote = request.customerQuote;

  if (!quote) {
    return "<h1>Customer quote has not been built yet</h1>";
  }

  const itemRows = request.items.map((item) => `
    <tr>
      <td>
        <strong>${escapeHtml(item.name)}</strong><br/>
        <span>${escapeHtml(item.model || "")}</span><br/>
        <small>${escapeHtml(item.dimensions || item.notes || "")}</small>
      </td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>Included</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(quote.quoteNumber)} - The Corporate Desk</title>
  <style>
    body { font-family: Arial, sans-serif; color: #17233d; margin: 0; background: #f4f6f8; }
    .page { max-width: 980px; margin: 28px auto; background: white; padding: 42px; box-shadow: 0 12px 40px rgba(0,0,0,.08); }
    .top { display: flex; justify-content: space-between; gap: 32px; border-bottom: 3px solid #c69b3d; padding-bottom: 24px; }
    .brand h1 { margin: 0; font-size: 34px; color: #0b1d3a; }
    .brand p { margin: 6px 0; color: #526070; }
    .quote-box { text-align: right; }
    .quote-box h2 { margin: 0; font-size: 28px; color: #0b1d3a; }
    .section { margin-top: 30px; }
    h3 { color: #0b1d3a; border-bottom: 1px solid #d9dee7; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; background: #0b1d3a; color: white; padding: 12px; }
    td { padding: 14px 12px; border-bottom: 1px solid #e5e9f0; vertical-align: top; }
    .summary { margin-left: auto; width: 360px; background: #f8fafc; padding: 20px; border-radius: 12px; }
    .summary-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .total { font-size: 24px; font-weight: 800; color: #0b1d3a; border-top: 2px solid #c69b3d; padding-top: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .card { background: #f8fafc; padding: 18px; border-radius: 12px; }
    .terms li { margin: 8px 0; }
    .accept { margin-top: 34px; border: 2px dashed #cbd5e1; padding: 20px; }
    .accent { color: #c69b3d; font-weight: 700; }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">
        <h1>The Corporate Desk</h1>
        <p>Commercial workspace supply, procurement and project control</p>
        <p>ABN: 28 691 680 805</p>
        <p>hello@thecorporatedesk.au</p>
      </div>
      <div class="quote-box">
        <h2>Quotation</h2>
        <p><strong>${escapeHtml(quote.quoteNumber)}</strong></p>
        <p>Date: ${escapeHtml(quote.quoteDate)}</p>
        <p>Valid until: ${escapeHtml(quote.validUntil)}</p>
      </div>
    </div>

    <div class="section grid">
      <div class="card">
        <h3>Customer</h3>
        <p><strong>${escapeHtml(quote.customer.name)}</strong></p>
        <p>${escapeHtml(quote.customer.company || "")}</p>
        <p>${escapeHtml(quote.customer.email || "")}</p>
      </div>
      <div class="card">
        <h3>Delivery / Installation</h3>
        <p>${escapeHtml(quote.customer.deliveryAddress || request.project.deliverySuburb || "TBC")}</p>
        <p>Installation: ${quote.inclusions.installation ? "Included" : "Not included"}</p>
        <p>Lead time: ${escapeHtml(quote.inclusions.leadTime)}</p>
      </div>
    </div>

    <div class="section">
      <h3>Items Included</h3>
      <table>
        <thead>
          <tr><th>Description</th><th>Qty</th><th>Price</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="summary">
        <div class="summary-row"><span>Subtotal ex GST</span><strong>$${quote.totals.subtotalExGst.toFixed(2)}</strong></div>
        <div class="summary-row"><span>GST</span><strong>$${quote.totals.gst.toFixed(2)}</strong></div>
        <div class="summary-row total"><span>Total inc GST</span><span>$${quote.totals.totalInclGst.toFixed(2)}</span></div>
      </div>
    </div>

    <div class="section grid">
      <div class="card">
        <h3>Included</h3>
        <p>Supply: Yes</p>
        <p>Shipping: Yes</p>
        <p>Installation: ${quote.inclusions.installation ? "Yes" : "No"}</p>
        <p>Warranty: ${escapeHtml(quote.inclusions.warranty)}</p>
      </div>
      <div class="card">
        <h3>Payment</h3>
        <p>Payment/deposit required before order placement unless otherwise agreed.</p>
        <p class="accent">${escapeHtml(quote.bankDetails.note)}</p>
      </div>
    </div>

    <div class="section">
      <h3>Terms</h3>
      <ul class="terms">
        ${quote.terms.map((term: string) => `<li>${escapeHtml(term)}</li>`).join("")}
      </ul>
    </div>

    <div class="accept">
      <h3>Acceptance</h3>
      <p>I accept this quotation and authorise The Corporate Desk to proceed.</p>
      <p>Client name: ___________________________</p>
      <p>Signature: _____________________________ Date: _______________</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendCustomerQuoteEmail(id: string, opts: { overrideToken?: string } = {}) {
  const result = await getProcurementQuoteRequest(id);
  if (!result.ok) return result;

  const request = result.request as QuoteRequest;
  const quote = request.customerQuote;

  if (!quote) {
    return { ok: false, error: "Customer quote has not been built yet" };
  }

  if (!request.customer.email) {
    return { ok: false, error: "Customer email is missing" };
  }

  const overrideConfigured = Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN);
  const overrideMatches = overrideConfigured && opts.overrideToken === process.env.TCD_AUTONOMY_OVERRIDE_TOKEN;

  if (process.env.TCD_ALLOW_REAL_OUTREACH !== "true" || !overrideMatches) {
    return {
      ok: false,
      locked: true,
      message: "Customer quote email is locked unless outreach is enabled and override token matches."
    };
  }

  const html = await renderCustomerQuoteHtml(id);
  const from = process.env.TCD_EMAIL_FROM_PLAIN || "hello@thecorporatedesk.au";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: request.customer.email,
      subject: `Your quote from The Corporate Desk - ${request.quoteNumber}`,
      html
    })
  });

  const payload = await response.json().catch(() => ({}));

  const log = await readJson(QUOTE_LOG_FILE, { emails: [] });
  log.emails = [
    {
      id: "customer-quote-email-" + Date.now(),
      createdAt: now(),
      status: response.ok ? "sent" : "failed",
      quoteRequestId: id,
      quoteNumber: request.quoteNumber,
      to: request.customer.email,
      from,
      provider: "resend",
      providerResponse: payload
    },
    ...(Array.isArray(log.emails) ? log.emails : [])
  ].slice(0, 1000);
  await writeJson(QUOTE_LOG_FILE, log);

  if (!response.ok) {
    return {
      ok: false,
      action: "customer_quote_email_failed",
      status: response.status,
      error: payload
    };
  }

  request.status = "customer_quote_sent";
  request.updatedAt = now();
  await saveStore(await getStore());

  return {
    ok: true,
    action: "customer_quote_sent",
    quoteRequestId: id,
    to: request.customer.email,
    providerResponse: payload
  };
}
