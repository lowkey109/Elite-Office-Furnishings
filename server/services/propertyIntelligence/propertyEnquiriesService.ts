import fs from "fs/promises";
import path from "path";
import { listAdminPropertyListings } from "./propertyListingsService";

export type PropertyEnquiryType =
  | "general_enquiry"
  | "request_intro"
  | "request_finance"
  | "request_inspection"
  | "save_listing";

export type PropertyEnquiryStatus =
  | "new"
  | "reviewing"
  | "contacted"
  | "converted"
  | "closed"
  | "dismissed";

export type PropertyEnquiry = {
  id: string;
  tenantId: string;
  clientUserId: string;
  clientEmail?: string;
  clientCompanyName?: string;
  listingId: string;
  listingTitle?: string;
  listingType?: string;
  propertyType?: string;
  enquiryType: PropertyEnquiryType;
  status: PropertyEnquiryStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  enquiries: PropertyEnquiry[];
};

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "property-enquiries-store.json");

function now() {
  return new Date().toISOString();
}

function id(prefix = "enquiry") {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

async function loadStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      enquiries: Array.isArray(parsed.enquiries) ? parsed.enquiries : [],
    };
  } catch {
    return { enquiries: [] };
  }
}

async function saveStore(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function createPropertyEnquiry(input: {
  tenantId: string;
  clientUserId: string;
  clientEmail?: string;
  clientCompanyName?: string;
  listingId: string;
  enquiryType?: PropertyEnquiryType;
  message?: string;
}) {
  const store = await loadStore();
  const listings = await listAdminPropertyListings({});
  const listing = listings.listings.find((item: any) => item.id === input.listingId);

  if (!listing) {
    return { ok: false, error: "Listing not found" };
  }

  const enquiry: PropertyEnquiry = {
    id: id("property-enquiry"),
    tenantId: input.tenantId,
    clientUserId: input.clientUserId,
    clientEmail: input.clientEmail || "",
    clientCompanyName: input.clientCompanyName || "",
    listingId: input.listingId,
    listingTitle: listing.title,
    listingType: listing.listingType,
    propertyType: listing.propertyType,
    enquiryType: input.enquiryType || "general_enquiry",
    status: "new",
    message: input.message || "",
    createdAt: now(),
    updatedAt: now(),
  };

  store.enquiries.unshift(enquiry);
  await saveStore(store);

  import("../notifications/clientEmailNotificationService")
    .then(({ sendPropertyEnquiryReceivedEmail }) => sendPropertyEnquiryReceivedEmail(enquiry))
    .catch((error) => console.warn("[notifications] property enquiry email failed", error));

  return { ok: true, enquiry };
}

export async function listAdminPropertyEnquiries(filters: any = {}) {
  const store = await loadStore();
  let rows = store.enquiries;

  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.enquiryType) rows = rows.filter((row) => row.enquiryType === filters.enquiryType);
  if (filters.listingId) rows = rows.filter((row) => row.listingId === filters.listingId);

  return {
    ok: true,
    generatedAt: now(),
    count: rows.length,
    enquiries: rows,
    stats: {
      total: store.enquiries.length,
      new: store.enquiries.filter((e) => e.status === "new").length,
      contacted: store.enquiries.filter((e) => e.status === "contacted").length,
      converted: store.enquiries.filter((e) => e.status === "converted").length,
    },
  };
}

export async function updatePropertyEnquiry(id: string, patch: Partial<PropertyEnquiry>) {
  const store = await loadStore();
  const index = store.enquiries.findIndex((enquiry) => enquiry.id === id);

  if (index === -1) {
    return { ok: false, error: "Enquiry not found" };
  }

  store.enquiries[index] = {
    ...store.enquiries[index],
    ...patch,
    updatedAt: now(),
  };

  await saveStore(store);
  return { ok: true, enquiry: store.enquiries[index] };
}
