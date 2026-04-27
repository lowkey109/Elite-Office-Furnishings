import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const ENGAGEMENT_FILE = path.join(DATA_DIR, "client-engagement-store.json");
const ENQUIRIES_FILE = path.join(DATA_DIR, "property-enquiries-store.json");
const LISTINGS_FILE = path.join(DATA_DIR, "property-listings-store.json");

type Store = {
  savedListings: any[];
  supportMessages: any[];
  onboardingEvents: any[];
};

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

async function readJson(file: string, fallback: any) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadStore(): Promise<Store> {
  const parsed = await readJson(ENGAGEMENT_FILE, {});
  return {
    savedListings: Array.isArray(parsed.savedListings) ? parsed.savedListings : [],
    supportMessages: Array.isArray(parsed.supportMessages) ? parsed.supportMessages : [],
    onboardingEvents: Array.isArray(parsed.onboardingEvents) ? parsed.onboardingEvents : [],
  };
}

async function saveStore(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ENGAGEMENT_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function saveClientListing(input: {
  tenantId: string;
  clientUserId: string;
  clientEmail?: string;
  clientCompanyName?: string;
  listingId: string;
}) {
  const store = await loadStore();

  const existing = store.savedListings.find(
    (item) => item.tenantId === input.tenantId && item.listingId === input.listingId,
  );

  if (existing) {
    return { ok: true, duplicate: true, savedListing: existing };
  }

  const listingsStore = await readJson(LISTINGS_FILE, { listings: [] });
  const listing = (listingsStore.listings || []).find((item: any) => item.id === input.listingId);

  const savedListing = {
    id: id("saved-listing"),
    tenantId: input.tenantId,
    clientUserId: input.clientUserId,
    clientEmail: input.clientEmail || "",
    clientCompanyName: input.clientCompanyName || "",
    listingId: input.listingId,
    listingTitle: listing?.title || input.listingId,
    listingType: listing?.listingType || "",
    propertyType: listing?.propertyType || "",
    address: listing?.address || "",
    suburb: listing?.suburb || "",
    city: listing?.city || "",
    state: listing?.state || "",
    price: listing?.price || "",
    rent: listing?.rent || "",
    savedAt: now(),
  };

  store.savedListings.unshift(savedListing);
  await saveStore(store);

  return { ok: true, duplicate: false, savedListing };
}

export async function listClientSavedListings(tenantId: string) {
  const store = await loadStore();
  const savedListings = store.savedListings.filter((item) => item.tenantId === tenantId);

  return {
    ok: true,
    count: savedListings.length,
    savedListings,
  };
}

export async function removeClientSavedListing(tenantId: string, id: string) {
  const store = await loadStore();
  const before = store.savedListings.length;

  store.savedListings = store.savedListings.filter((item) => !(item.tenantId === tenantId && item.id === id));

  await saveStore(store);

  return {
    ok: true,
    removed: before - store.savedListings.length,
  };
}

export async function listClientPropertyEnquiryHistory(tenantId: string) {
  const enquiriesStore = await readJson(ENQUIRIES_FILE, { enquiries: [] });
  const enquiries = (enquiriesStore.enquiries || []).filter((item: any) => item.tenantId === tenantId);

  return {
    ok: true,
    count: enquiries.length,
    enquiries,
  };
}

export async function createClientSupportMessage(input: {
  tenantId: string;
  clientUserId: string;
  clientEmail?: string;
  clientCompanyName?: string;
  subject: string;
  category?: string;
  message: string;
}) {
  const store = await loadStore();

  const supportMessage = {
    id: id("support"),
    tenantId: input.tenantId,
    clientUserId: input.clientUserId,
    clientEmail: input.clientEmail || "",
    clientCompanyName: input.clientCompanyName || "",
    subject: String(input.subject || "Support request"),
    category: String(input.category || "general"),
    message: String(input.message || ""),
    status: "new",
    createdAt: now(),
    updatedAt: now(),
  };

  store.supportMessages.unshift(supportMessage);
  await saveStore(store);

  return { ok: true, supportMessage };
}

export async function listClientSupportMessages(tenantId: string) {
  const store = await loadStore();
  const messages = store.supportMessages.filter((item) => item.tenantId === tenantId);

  return {
    ok: true,
    count: messages.length,
    messages,
  };
}

export async function listAdminSupportMessages(filters: any = {}) {
  const store = await loadStore();
  let messages = store.supportMessages;

  if (filters.status) messages = messages.filter((item) => item.status === filters.status);
  if (filters.category) messages = messages.filter((item) => item.category === filters.category);

  return {
    ok: true,
    count: messages.length,
    messages,
    stats: {
      total: store.supportMessages.length,
      new: store.supportMessages.filter((item) => item.status === "new").length,
      open: store.supportMessages.filter((item) => item.status === "open").length,
      closed: store.supportMessages.filter((item) => item.status === "closed").length,
    },
  };
}

export async function updateAdminSupportMessage(id: string, patch: any) {
  const store = await loadStore();
  const index = store.supportMessages.findIndex((item) => item.id === id);

  if (index === -1) {
    return { ok: false, error: "Support message not found" };
  }

  store.supportMessages[index] = {
    ...store.supportMessages[index],
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.adminNotes !== undefined ? { adminNotes: String(patch.adminNotes || "") } : {}),
    updatedAt: now(),
  };

  await saveStore(store);

  return { ok: true, supportMessage: store.supportMessages[index] };
}

export async function getClientOnboardingChecklist(user: any) {
  const saved = await listClientSavedListings(user.tenantId);
  const enquiries = await listClientPropertyEnquiryHistory(user.tenantId);
  const support = await listClientSupportMessages(user.tenantId);

  const checklist = [
    {
      id: "create_account",
      label: "Create client account",
      complete: true,
      href: "/client-dashboard",
    },
    {
      id: "complete_onboarding",
      label: "Complete first project onboarding",
      complete: Boolean(user.onboardingComplete),
      href: "/client-onboarding",
    },
    {
      id: "review_plan",
      label: "Review your plan and billing",
      complete: Boolean(user.subscriptionStatus),
      href: "/client/billing",
    },
    {
      id: "view_listings",
      label: "Explore LeaseHawk listings",
      complete: saved.count > 0 || enquiries.count > 0,
      href: "/client/property-listings",
    },
    {
      id: "save_or_enquire",
      label: "Save a listing or send an enquiry",
      complete: saved.count > 0 || enquiries.count > 0,
      href: "/client/saved-listings",
    },
    {
      id: "try_phantomx",
      label: "Open PhantomX free paper mode",
      complete: false,
      href: "/client/phantomx-paper",
    },
    {
      id: "support_ready",
      label: "Know where to ask for help",
      complete: support.count > 0,
      href: "/client/support",
    },
  ];

  const complete = checklist.filter((item) => item.complete).length;

  return {
    ok: true,
    progress: {
      total: checklist.length,
      complete,
      percent: Math.round((complete / checklist.length) * 100),
    },
    checklist,
  };
}
