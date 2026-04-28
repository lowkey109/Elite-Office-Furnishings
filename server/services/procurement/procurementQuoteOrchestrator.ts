import fs from "fs/promises";
import path from "path";
import { sendWhatsAppMessage } from "../intelligence/communications/whatsappService";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = "procurement-quote-store.json";
const OUTBOX_FILE = "procurement-whatsapp-outbox.json";
const QUOTE_LOG_FILE = "procurement-customer-quote-log.json";
const EMAIL_OUTBOX_FILE = "procurement-email-outbox.json";
const PROCUREMENT_SEND_AUDIT_FILE = "procurement-send-audit.json";

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
    preferredContact: "email",
    whatsapp: null,
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

  return `你好，这是 The Corporate Desk。

请帮我们报价以下产品：

${lines.join("\n")}

送货地址/城市：
${request.customer.deliveryAddress || request.project.deliverySuburb || "待确认"}

请回复以下信息：
1. 单价
2. 运费
3. 生产/交货周期
4. 保修期
5. 包装信息
6. 安装注意事项
7. 是否可以定制颜色/尺寸

报价编号：${request.quoteNumber}

谢谢。

---

Hello, this is The Corporate Desk.

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
7. Whether colour/size can be customised

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
      status: entry.initialStatus || "queued",
      holdReason: entry.holdReason || undefined,
      ...entry
    },
    ...messages
  ].slice(0, 1000);

  await writeJson(OUTBOX_FILE, outbox);

  return outbox.messages[0];
}


async function appendProcurementEmailOutbox(entry: any) {
  const outbox = await readJson(EMAIL_OUTBOX_FILE, { emails: [] });
  const emails = Array.isArray(outbox.emails) ? outbox.emails : [];

  outbox.emails = [
    {
      id: "proc-email-" + Date.now(),
      createdAt: now(),
      status: "queued",
      realSendPerformed: false,
      ...entry
    },
    ...emails
  ].slice(0, 1000);

  await writeJson(EMAIL_OUTBOX_FILE, outbox);
  return outbox.emails[0];
}

export async function listProcurementEmailOutbox() {
  const outbox = await readJson(EMAIL_OUTBOX_FILE, { emails: [] });
  return {
    ok: true,
    count: Array.isArray(outbox.emails) ? outbox.emails.length : 0,
    emails: Array.isArray(outbox.emails) ? outbox.emails : []
  };
}

export async function sendQueuedProcurementEmails(opts: { overrideToken?: string; limit?: number } = {}) {
  const overrideConfigured = Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN);
  const overrideMatches = overrideConfigured && opts.overrideToken === process.env.TCD_AUTONOMY_OVERRIDE_TOKEN;

  if (process.env.TCD_ALLOW_REAL_OUTREACH !== "true" || !overrideMatches) {
    return {
      ok: false,
      locked: true,
      message: "Procurement email send is locked unless real outreach is enabled and override token matches."
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY is missing" };
  }

  const outbox = await readJson(EMAIL_OUTBOX_FILE, { emails: [] });
  const emails = Array.isArray(outbox.emails) ? outbox.emails : [];
  const limit = Math.max(1, Number(opts.limit || 10));
  const pending = emails.filter((email: any) => email.status === "queued").slice(0, limit);
  const results = [];
  const from = process.env.TCD_EMAIL_FROM_PLAIN || "hello@thecorporatedesk.au";

  for (const email of pending) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        text: email.body
      })
    });

    const payload = await response.json().catch(() => ({}));

    email.status = response.ok ? "sent" : "send_failed";
    email.sentAt = response.ok ? now() : undefined;
    email.realSendPerformed = response.ok;
    email.provider = "resend";
    email.providerResponse = response.ok ? payload : undefined;
    email.error = response.ok ? undefined : payload;

    results.push({
      id: email.id,
      to: email.to,
      purpose: email.purpose,
      status: email.status,
      providerResponse: payload
    });
  }

  await writeJson(EMAIL_OUTBOX_FILE, { emails });

  return { ok: true, attempted: pending.length, results };
}

export async function queueInstallerRfq(id: string) {
  const store = await getStore();
  const request = (store.requests || []).find((item: QuoteRequest) => item.id === id);

  if (!request) {
    return { ok: false, error: "Quote request not found" };
  }

  const installer = INSTALLERS[0];
  const message = buildInstallerRfqMessage(request);

  const queued = await appendProcurementEmailOutbox({
    channel: "email",
    direction: "outbound",
    purpose: "installer_rfq",
    quoteRequestId: id,
    quoteNumber: request.quoteNumber,
    toName: installer.contactName,
    toCompany: installer.companyName,
    to: installer.email || "liam@teamkitset.com",
    phone: installer.phoneAu || "0497977002",
    subject: `Install quote request - ${request.quoteNumber}`,
    body: message,
    note: "Installer/assembler uses email or phone, not WhatsApp."
  });

  request.status = "installer_email_rfq_queued";
  request.updatedAt = now();
  await saveStore(store);

  return {
    ok: true,
    requestStatus: request.status,
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
    initialStatus: "draft_hold",
    holdReason: "Manufacturer RFQs require one-at-a-time manual release to prevent supplier flooding.",
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


export async function sendQueuedProcurementWhatsAppMessages(opts: { overrideToken?: string; limit?: number } = {}) {
  const overrideConfigured = Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN);
  const overrideMatches = overrideConfigured && opts.overrideToken === process.env.TCD_AUTONOMY_OVERRIDE_TOKEN;

  if (process.env.TCD_ALLOW_REAL_OUTREACH !== "true" || !overrideMatches) {
    return {
      ok: false,
      locked: true,
      message: "Procurement WhatsApp send is locked unless real outreach is enabled and override token matches.",
      required: {
        TCD_ALLOW_REAL_OUTREACH: "true",
        "x-tcd-autonomy-override": "must match TCD_AUTONOMY_OVERRIDE_TOKEN"
      }
    };
  }

  const outbox = await readJson(OUTBOX_FILE, { messages: [] });
  const messages = Array.isArray(outbox.messages) ? outbox.messages : [];
  const limit = Math.max(1, Number(opts.limit || 10));

  const pending = messages
    .filter((message: any) => message.status === "queued" && message.channel === "whatsapp" && !["manufacturer_rfq", "shipping_agent_rfq"].includes(String(message.purpose || "")))
    .slice(0, limit);

  const results = [];

  for (const message of pending) {
    const cleanTo = String(message.to || "").replace(/^whatsapp:/, "").trim();

    let result: any;
    if (!cleanTo || cleanTo === "TBC") {
      result = {
        ok: false,
        skipped: true,
        reason: "Missing valid WhatsApp recipient number"
      };
    } else {
      result = await sendWhatsAppMessage({
        toE164: cleanTo,
        message: String(message.body || "")
      });
    }

    message.status = (result.ok === true || result.success === true) ? "sent" : "send_failed";
    message.sentAt = (result.ok === true || result.success === true) ? now() : undefined;
    message.realSendPerformed = result.ok === true || result.success === true;
    message.provider = result.provider || "existing_whatsapp_service";
    message.providerResponse = (result.ok === true || result.success === true) ? result : undefined;
    message.error = (result.ok === true || result.success === true) ? undefined : result;

    results.push({
      id: message.id,
      to: message.to,
      purpose: message.purpose,
      status: message.status,
      result
    });
  }

  await writeJson(OUTBOX_FILE, { messages });

  return {
    ok: true,
    attempted: pending.length,
    results,
    config: {
      TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID),
      TWILIO_AUTH_TOKEN: Boolean(process.env.TWILIO_AUTH_TOKEN),
      TWILIO_WHATSAPP_FROM: Boolean(process.env.TWILIO_WHATSAPP_FROM),
      WHATSAPP_GATEWAY_URL: Boolean(process.env.WHATSAPP_GATEWAY_URL)
    }
  };
}

function parseMoneyFromProcurementText(text: string): number[] {
  return [...String(text || "").matchAll(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/g)]
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n));
}

function parseProcurementLeadTimeWeeks(text: string): number | undefined {
  const value = String(text || "").toLowerCase();
  const weekMatch = value.match(/([0-9]+)\s*(week|weeks|wk|wks)/);
  if (weekMatch) return Number(weekMatch[1]);

  const dayMatch = value.match(/([0-9]+)\s*(day|days)/);
  if (dayMatch) return Math.max(1, Math.ceil(Number(dayMatch[1]) / 7));

  return undefined;
}

export async function parseInboundProcurementWhatsAppReply(input: any) {
  const body = String(input.Body || input.body || input.message || "").trim();
  const from = String(input.From || input.from || "").trim();
  const quoteRefRaw = String(input.quoteRequestId || input.quoteNumber || "").trim();

  const store = await getStore();
  const requests = Array.isArray(store.requests) ? store.requests : [];

  const request =
    requests.find((item: QuoteRequest) => item.id === quoteRefRaw || item.quoteNumber === quoteRefRaw) ||
    requests.find((item: QuoteRequest) => body.includes(item.quoteNumber)) ||
    requests[0];

  if (!request) {
    return {
      ok: false,
      error: "No procurement quote request found for inbound reply",
      from,
      body
    };
  }

  const lower = body.toLowerCase();
  const moneyValues = parseMoneyFromProcurementText(body);
  const leadTimeWeeks = parseProcurementLeadTimeWeeks(body);

  const looksInstaller =
    lower.includes("install") ||
    lower.includes("assembly") ||
    lower.includes("rubbish") ||
    lower.includes("site") ||
    from.includes("497977002");

  let applied: any;

  if (looksInstaller) {
    applied = await recordInstallerResponse(request.id, {
      installerName: input.installerName || "Kitset Assembly Services",
      installCost: moneyValues[0] || request.installer.estimatedInstallCost || 0,
      notes: body
    });
  } else {
    applied = await recordSupplierResponse(request.id, {
      supplierName: input.supplierName || "WhatsApp Supplier Reply",
      unitCost: moneyValues[0] || 0,
      shippingCost: moneyValues[1] || 0,
      leadTimeWeeks,
      warranty: lower.includes("3 year") || lower.includes("3-year") ? "3 years" : undefined,
      notes: body
    });
  }

  const inboundLog = await readJson("procurement-whatsapp-inbound-log.json", { replies: [] });
  inboundLog.replies = [
    {
      id: "wa-inbound-" + Date.now(),
      createdAt: now(),
      from,
      body,
      quoteRequestId: request.id,
      quoteNumber: request.quoteNumber,
      parsedAs: looksInstaller ? "installer_response" : "supplier_response",
      moneyValues,
      leadTimeWeeks,
      appliedOk: applied.ok === true
    },
    ...(Array.isArray(inboundLog.replies) ? inboundLog.replies : [])
  ].slice(0, 1000);

  await writeJson("procurement-whatsapp-inbound-log.json", inboundLog);

  return {
    ok: true,
    parsedAs: looksInstaller ? "installer_response" : "supplier_response",
    quoteRequestId: request.id,
    quoteNumber: request.quoteNumber,
    moneyValues,
    leadTimeWeeks,
    applied
  };
}

export async function listInboundProcurementWhatsAppReplies() {
  const inboundLog = await readJson("procurement-whatsapp-inbound-log.json", { replies: [] });
  return {
    ok: true,
    count: Array.isArray(inboundLog.replies) ? inboundLog.replies.length : 0,
    replies: Array.isArray(inboundLog.replies) ? inboundLog.replies : []
  };
}

function stripHtmlForProcurementPdf(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function renderCustomerQuotePdfBuffer(id: string) {
  const html = await renderCustomerQuoteHtml(id);

  try {
    const playwright = await new Function("return import(\"playwright\")")();
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" }
    });

    await browser.close();

    return {
      ok: true,
      contentType: "application/pdf",
      fileName: id + "-customer-quote.pdf",
      buffer: Buffer.from(pdf)
    };
  } catch (error: any) {
    const text = stripHtmlForProcurementPdf(html).slice(0, 180).replace(/[()]/g, "");
    const fallback = Buffer.from(
      `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 220 >> stream
BT
/F1 18 Tf
50 780 Td
(The Corporate Desk Quote) Tj
0 -28 Td
/F1 10 Tf
(${text}) Tj
0 -24 Td
(Styled quote is available from the HTML quote route.) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000520 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
590
%%EOF`,
      "utf8"
    );

    return {
      ok: false,
      contentType: "application/pdf",
      fileName: id + "-customer-quote-fallback.pdf",
      buffer: fallback,
      error: error?.message || String(error)
    };
  }
}


// APPROVED_MANUFACTURER_DIRECTORY
const APPROVED_MANUFACTURERS = [
  {
    id: "xitian-wangzhen-ruby",
    companyName: "Xitian Furniture",
    contactName: "wangzhen Ruby",
    whatsapp: "+8618007947880",
    country: "China",
    website: "https://xitianfurniture.com",
    categories: ["office furniture", "reception desks", "executive desks", "workstations", "custom furniture"],
    priority: 1,
    notes: "WhatsApp Business furniture supplier. Use for general office furniture and custom product RFQs."
  },
  {
    id: "huayi-metal-products-gina",
    companyName: "Huayi Metal Products Co.Ltd",
    contactName: "Gina",
    whatsapp: "+8618024514609",
    country: "China",
    website: null,
    categories: ["metal products", "office furniture", "executive desks", "cabinets", "custom furniture"],
    priority: 2,
    notes: "Use when RFQ may require metal products, desks, cabinets, or custom manufacturing."
  },
  {
    id: "jinying-furniture-alice",
    companyName: "Jinying Furniture",
    contactName: "Alice",
    whatsapp: "+8613380299408",
    country: "China",
    website: null,
    categories: ["office furniture", "executive desks", "reception desks", "classic desks", "custom furniture"],
    priority: 3,
    notes: "Use for executive furniture and general office furniture RFQs."
  },
  {
    id: "ella-office-furniture",
    companyName: "Ella Office Furniture",
    contactName: "Ms Ella",
    whatsapp: "+8613690142502",
    country: "China",
    website: null,
    categories: ["office furniture", "executive desks", "catalog products", "workstations", "reception desks"],
    priority: 4,
    notes: "WhatsApp Business with catalog. Use for office furniture catalog RFQs."
  },
  {
    id: "guangzhou-meiyi-furniture-asya",
    companyName: "Guangzhou Meiyi Furniture Co., Ltd",
    contactName: "Asya",
    whatsapp: "+8613422161319",
    country: "China",
    website: "https://www.meiyifurnishing.com",
    alternateWebsite: "https://myofficefurniture.com.cn",
    categories: ["office furniture", "reception desks", "executive desks", "cabinets", "custom furniture"],
    priority: 5,
    notes: "Only work communication. Use for office furniture and custom manufacturing RFQs."
  },
  {
    id: "denny-office-furniture",
    companyName: "Denny Office Furniture",
    contactName: "Denny",
    whatsapp: "+8613127968208",
    country: "China",
    website: null,
    categories: ["office furniture", "custom furniture", "reception desks", "executive desks"],
    priority: 6,
    notes: "Use as additional supplier backup for quote comparison."
  }
];

const APPROVED_SHIPPING_AGENTS = [
  {
    id: "lynne-mao-china-shipping",
    companyName: "China Shipping Agent",
    contactName: "Lynne Mao",
    whatsapp: "+8618770665717",
    country: "China",
    categories: ["shipping", "freight", "export", "china to australia"],
    priority: 1,
    notes: "Shipping agent from China. Use when manufacturer shipping is too expensive or needs comparison."
  }
];

function normaliseCategoryText(value: unknown): string {
  return String(value || "").toLowerCase();
}

function manufacturerMatchesItems(manufacturer: any, items: ProcurementItem[]) {
  const combined = normaliseCategoryText(
    items.map((item) => [item.name, item.model, item.notes, item.colour, item.dimensions].filter(Boolean).join(" ")).join(" ")
  );

  if (!combined.trim()) return true;

  return manufacturer.categories.some((category: string) => {
    const c = normaliseCategoryText(category);
    return combined.includes(c) || c.includes("office furniture") || c.includes("custom furniture");
  });
}

export async function listApprovedProcurementManufacturers() {
  return {
    ok: true,
    count: APPROVED_MANUFACTURERS.length,
    manufacturers: APPROVED_MANUFACTURERS,
    shippingAgents: APPROVED_SHIPPING_AGENTS
  };
}

export async function queueApprovedManufacturerRfqs(id: string, opts: any = {}) {
  const requestResult = await getProcurementQuoteRequest(id);
  if (!requestResult.ok) return requestResult;

  const request = requestResult.request as QuoteRequest;
  const maxSuppliers = Math.max(1, Number(opts.maxSuppliers || 4));
  const includeAll = opts.includeAll === true;

  const matched = APPROVED_MANUFACTURERS
    .filter((manufacturer: any) => includeAll || manufacturerMatchesItems(manufacturer, request.items))
    .sort((a: any, b: any) => Number(a.priority || 999) - Number(b.priority || 999))
    .slice(0, maxSuppliers);

  const results: any[] = [];

  for (const manufacturer of matched) {
    try {
      const queued = await queueManufacturerRfq(id, {
        companyName: manufacturer.companyName,
        name: manufacturer.contactName,
        whatsapp: manufacturer.whatsapp
      });

      results.push({
        manufacturer,
        queued
      });
    } catch (error: any) {
      results.push({
        manufacturer,
        queued: {
          ok: false,
          error: error?.message || String(error)
        }
      });
    }
  }

  return {
    ok: true,
    quoteRequestId: id,
    quoteNumber: request.quoteNumber,
    matchedCount: matched.length,
    queuedCount: results.filter((item) => item.queued?.ok === true).length,
    results
  };
}

export async function queueShippingAgentRfq(id: string, opts: any = {}) {
  const requestResult = await getProcurementQuoteRequest(id);
  if (!requestResult.ok) return requestResult;

  const agent = APPROVED_SHIPPING_AGENTS[0];
  const request = requestResult.request as QuoteRequest;

  const itemLines = request.items.map((item) =>
    `- ${item.quantity} x ${item.name}${item.model ? " (" + item.model + ")" : ""}${item.dimensions ? " — " + item.dimensions : ""}`
  );

  const message = `你好 ${agent.contactName}，这是 The Corporate Desk。

如果工厂运费太高，请帮我们估算这单从中国到澳大利亚的运输费用。

产品：
${itemLines.join("\n")}

目的地：
${request.customer.deliveryAddress || request.project.deliverySuburb || "Australia, address TBC"}

请确认：
1. 预计运费
2. 运输时间
3. 清关/进口注意事项
4. 是否包含门到门派送
5. 是否需要包装尺寸/重量才能准确报价

报价编号：${request.quoteNumber}

谢谢。

---

Hi ${agent.contactName}, this is The Corporate Desk.

Can you please estimate shipping/freight for this quote if manufacturer shipping is too high?

Items:
${itemLines.join("\n")}

Delivery destination:
${request.customer.deliveryAddress || request.project.deliverySuburb || "Australia, address TBC"}

Please confirm:
1. Estimated shipping/freight cost
2. Transit time
3. Any customs/import notes
4. Whether door-to-door delivery is included
5. Whether you need package size/weight for accurate pricing

Quote ref: ${request.quoteNumber}

Thanks.`;

  const queued = await appendWhatsAppOutbox({
    channel: "whatsapp",
    direction: "outbound",
    purpose: "shipping_agent_rfq",
    initialStatus: "draft_hold",
    holdReason: "Shipping RFQs require one-at-a-time manual release to prevent supplier flooding.",
    quoteRequestId: id,
    quoteNumber: request.quoteNumber,
    toName: agent.contactName,
    toCompany: agent.companyName,
    to: agent.whatsapp,
    body: message,
    realSendPerformed: false,
    note: "Queued shipping agent RFQ for freight comparison."
  });

  return {
    ok: true,
    quoteRequestId: id,
    quoteNumber: request.quoteNumber,
    agent,
    queued,
    message
  };
}


// PROCUREMENT_ANTI_FLOOD_GUARDS
function procurementTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normaliseProcurementRecipient(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function readProcurementSendAudit() {
  return await readJson(PROCUREMENT_SEND_AUDIT_FILE, { sends: [] });
}

async function writeProcurementSendAudit(audit: any) {
  await writeJson(PROCUREMENT_SEND_AUDIT_FILE, audit);
}

function getManufacturerDailyCap() {
  return Math.max(1, Number(process.env.TCD_PROCUREMENT_MANUFACTURER_DAILY_CAP || 3));
}

function getManufacturerCooldownHours() {
  return Math.max(1, Number(process.env.TCD_PROCUREMENT_MANUFACTURER_COOLDOWN_HOURS || 24));
}

async function canReleaseProcurementMessage(message: any) {
  const purpose = String(message?.purpose || "");
  const recipient = normaliseProcurementRecipient(message?.to);
  const quoteRequestId = String(message?.quoteRequestId || "");
  const today = procurementTodayKey();
  const audit = await readProcurementSendAudit();
  const sends = Array.isArray(audit.sends) ? audit.sends : [];

  if (!recipient || recipient === "tbc") {
    return { ok: false, reason: "missing_recipient" };
  }

  if (!["manufacturer_rfq", "shipping_agent_rfq"].includes(purpose)) {
    return { ok: false, reason: "only_manufacturer_or_shipping_release_supported_here" };
  }

  const sameQuoteDuplicate = sends.find((send: any) =>
    send.status === "sent" &&
    normaliseProcurementRecipient(send.to) === recipient &&
    String(send.quoteRequestId || "") === quoteRequestId &&
    String(send.purpose || "") === purpose
  );

  if (sameQuoteDuplicate) {
    return {
      ok: false,
      reason: "duplicate_supplier_rfq_for_same_quote",
      existingSendId: sameQuoteDuplicate.id,
      existingSentAt: sameQuoteDuplicate.sentAt
    };
  }

  const dailyCap = getManufacturerDailyCap();
  const sentToday = sends.filter((send: any) =>
    send.status === "sent" &&
    String(send.sentAt || "").startsWith(today) &&
    ["manufacturer_rfq", "shipping_agent_rfq"].includes(String(send.purpose || ""))
  );

  if (sentToday.length >= dailyCap) {
    return {
      ok: false,
      reason: "manufacturer_daily_cap_reached",
      dailyCap,
      sentToday: sentToday.length
    };
  }

  const cooldownHours = getManufacturerCooldownHours();
  const cutoffMs = Date.now() - cooldownHours * 60 * 60 * 1000;
  const recentToSameRecipient = sends.find((send: any) =>
    send.status === "sent" &&
    normaliseProcurementRecipient(send.to) === recipient &&
    Date.parse(send.sentAt || "") >= cutoffMs
  );

  if (recentToSameRecipient) {
    return {
      ok: false,
      reason: "recipient_cooldown_active",
      cooldownHours,
      recentSendId: recentToSameRecipient.id,
      recentSentAt: recentToSameRecipient.sentAt
    };
  }

  return {
    ok: true,
    dailyCap,
    sentToday: sentToday.length,
    cooldownHours
  };
}

async function recordProcurementSendAudit(entry: any) {
  const audit = await readProcurementSendAudit();
  const sends = Array.isArray(audit.sends) ? audit.sends : [];

  audit.sends = [
    {
      id: "proc-send-audit-" + Date.now(),
      createdAt: now(),
      ...entry
    },
    ...sends
  ].slice(0, 2000);

  await writeProcurementSendAudit(audit);
  return audit.sends[0];
}

export async function listProcurementSendAudit() {
  const audit = await readProcurementSendAudit();
  return {
    ok: true,
    count: Array.isArray(audit.sends) ? audit.sends.length : 0,
    sends: Array.isArray(audit.sends) ? audit.sends : [],
    guard: {
      manufacturerDailyCap: getManufacturerDailyCap(),
      manufacturerCooldownHours: getManufacturerCooldownHours()
    }
  };
}

export async function releaseOneProcurementWhatsAppDraft(input: {
  messageId?: string;
  overrideToken?: string;
  dryRun?: boolean;
}) {
  const overrideConfigured = Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN);
  const overrideMatches = overrideConfigured && input.overrideToken === process.env.TCD_AUTONOMY_OVERRIDE_TOKEN;

  if (process.env.TCD_ALLOW_REAL_OUTREACH !== "true" || !overrideMatches) {
    return {
      ok: false,
      locked: true,
      message: "Release is locked unless real outreach is enabled and override token matches."
    };
  }

  if (!input.messageId) {
    return {
      ok: false,
      error: "messageId is required. This endpoint only releases one selected RFQ at a time."
    };
  }

  const outbox = await readJson(OUTBOX_FILE, { messages: [] });
  const messages = Array.isArray(outbox.messages) ? outbox.messages : [];
  const message = messages.find((item: any) => item.id === input.messageId);

  if (!message) {
    return { ok: false, error: "Message not found" };
  }

  if (message.status !== "draft_hold") {
    return {
      ok: false,
      error: "Only draft_hold messages can be released.",
      currentStatus: message.status
    };
  }

  const guard = await canReleaseProcurementMessage(message);

  if (!guard.ok) {
    message.status = "draft_hold";
    message.lastBlockedAt = now();
    message.lastBlockedReason = guard.reason;
    await writeJson(OUTBOX_FILE, { messages });

    return {
      ok: false,
      blocked: true,
      guard,
      message: {
        id: message.id,
        purpose: message.purpose,
        toCompany: message.toCompany,
        toName: message.toName,
        to: message.to,
        status: message.status
      }
    };
  }

  if (input.dryRun === true) {
    return {
      ok: true,
      dryRun: true,
      guard,
      message: {
        id: message.id,
        purpose: message.purpose,
        toCompany: message.toCompany,
        toName: message.toName,
        to: message.to,
        body: message.body,
        status: message.status
      }
    };
  }

  const cleanTo = String(message.to || "").replace(/^whatsapp:/, "").trim();
  const result: any = await sendWhatsAppMessage({
    toE164: cleanTo,
    message: String(message.body || "")
  });

  const success = result.ok === true || result.success === true;

  message.status = success ? "sent" : "send_failed";
  message.sentAt = success ? now() : undefined;
  message.realSendPerformed = success;
  message.provider = result.provider || "existing_whatsapp_service";
  message.providerResponse = success ? result : undefined;
  message.error = success ? undefined : result;

  await writeJson(OUTBOX_FILE, { messages });

  await recordProcurementSendAudit({
    status: success ? "sent" : "send_failed",
    sentAt: success ? message.sentAt : undefined,
    messageId: message.id,
    quoteRequestId: message.quoteRequestId,
    quoteNumber: message.quoteNumber,
    purpose: message.purpose,
    toCompany: message.toCompany,
    toName: message.toName,
    to: message.to,
    provider: message.provider,
    providerResponse: message.providerResponse,
    error: message.error
  });

  return {
    ok: success,
    action: success ? "one_procurement_whatsapp_rfq_sent" : "one_procurement_whatsapp_rfq_failed",
    guard,
    message: {
      id: message.id,
      purpose: message.purpose,
      toCompany: message.toCompany,
      toName: message.toName,
      to: message.to,
      status: message.status
    },
    providerResponse: result
  };
}
