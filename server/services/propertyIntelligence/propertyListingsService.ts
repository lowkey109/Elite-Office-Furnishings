import fs from "fs/promises";
import path from "path";

export type PropertyListingType =
  | "sale"
  | "rent"
  | "lease"
  | "commercial_lease"
  | "development_site";

export type PropertyType =
  | "house"
  | "unit"
  | "townhouse"
  | "land"
  | "office"
  | "warehouse"
  | "retail"
  | "industrial"
  | "development_site"
  | "other";

export type PropertyListingSource =
  | "manual"
  | "partner_submitted"
  | "csv_upload"
  | "domain_api"
  | "proptrack"
  | "government_sales_history"
  | "osm_context";

export type PropertyListingStatus =
  | "active"
  | "under_offer"
  | "sold"
  | "leased"
  | "withdrawn";

export type PropertyListing = {
  id: string;
  listingType: PropertyListingType;
  propertyType: PropertyType;
  source: PropertyListingSource;
  status: PropertyListingStatus;
  title: string;
  address?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  price?: string;
  rent?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  landSizeSqm?: number | null;
  buildingSizeSqm?: number | null;
  agentName?: string;
  agencyName?: string;
  agentPhone?: string;
  agentEmail?: string;
  listingUrl?: string;
  imageUrls?: string[];
  description?: string;
  inspectionTimes?: string[];
  latitude?: number | null;
  longitude?: number | null;
  partnerName?: string;
  sourceReference?: string;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  listings: PropertyListing[];
};

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "property-listings-store.json");

function now() {
  return new Date().toISOString();
}

function id(prefix = "listing") {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asArray(value: any): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[|;]/)
    .map(clean)
    .filter(Boolean);
}

async function loadStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
    };
  } catch {
    return { listings: [] };
  }
}

async function saveStore(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normaliseListing(input: any, source: PropertyListingSource = "manual"): PropertyListing {
  const t = now();
  const listingType = clean(input.listingType || input.type || "sale") as PropertyListingType;
  const propertyType = clean(input.propertyType || "house") as PropertyType;

  const title =
    clean(input.title) ||
    [propertyType, listingType, input.suburb || input.city].filter(Boolean).join(" ");

  return {
    id: input.id || id("listing"),
    listingType,
    propertyType,
    source: (input.source || source) as PropertyListingSource,
    status: (input.status || "active") as PropertyListingStatus,
    title,
    address: clean(input.address),
    suburb: clean(input.suburb),
    city: clean(input.city || input.suburb),
    state: clean(input.state),
    postcode: clean(input.postcode),
    country: clean(input.country || "Australia"),
    price: clean(input.price),
    rent: clean(input.rent),
    bedrooms: num(input.bedrooms),
    bathrooms: num(input.bathrooms),
    parking: num(input.parking),
    landSizeSqm: num(input.landSizeSqm || input.landSize),
    buildingSizeSqm: num(input.buildingSizeSqm || input.buildingSize),
    agentName: clean(input.agentName),
    agencyName: clean(input.agencyName),
    agentPhone: clean(input.agentPhone),
    agentEmail: clean(input.agentEmail),
    listingUrl: clean(input.listingUrl || input.url),
    imageUrls: asArray(input.imageUrls || input.images),
    description: clean(input.description),
    inspectionTimes: asArray(input.inspectionTimes),
    latitude: num(input.latitude),
    longitude: num(input.longitude),
    partnerName: clean(input.partnerName),
    sourceReference: clean(input.sourceReference),
    createdAt: input.createdAt || t,
    updatedAt: t,
  };
}

function clientSafe(listing: PropertyListing) {
  return {
    id: listing.id,
    listingType: listing.listingType,
    propertyType: listing.propertyType,
    source: listing.source,
    status: listing.status,
    title: listing.title,
    address: listing.address,
    suburb: listing.suburb,
    city: listing.city,
    state: listing.state,
    postcode: listing.postcode,
    country: listing.country,
    price: listing.price,
    rent: listing.rent,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    parking: listing.parking,
    landSizeSqm: listing.landSizeSqm,
    buildingSizeSqm: listing.buildingSizeSqm,
    agencyName: listing.agencyName,
    listingUrl: listing.listingUrl,
    imageUrls: listing.imageUrls,
    description: listing.description,
    inspectionTimes: listing.inspectionTimes,
    latitude: listing.latitude,
    longitude: listing.longitude,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

function applyFilters(rows: PropertyListing[], filters: any) {
  let out = rows;

  if (filters.listingType) out = out.filter((l) => l.listingType === filters.listingType);
  if (filters.propertyType) out = out.filter((l) => l.propertyType === filters.propertyType);
  if (filters.status) out = out.filter((l) => l.status === filters.status);
  if (filters.source) out = out.filter((l) => l.source === filters.source);

  if (filters.city) {
    const q = clean(filters.city).toLowerCase();
    out = out.filter((l) => clean(l.city || l.suburb).toLowerCase().includes(q));
  }

  if (filters.state) {
    const q = clean(filters.state).toLowerCase();
    out = out.filter((l) => clean(l.state).toLowerCase() === q);
  }

  if (filters.q) {
    const q = clean(filters.q).toLowerCase();
    out = out.filter((l) =>
      [
        l.title,
        l.address,
        l.suburb,
        l.city,
        l.state,
        l.price,
        l.rent,
        l.description,
        l.agencyName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function listAdminPropertyListings(filters: any = {}) {
  const store = await loadStore();
  const listings = applyFilters(store.listings, filters);

  return {
    ok: true,
    connected: true,
    sourceMode: "free_first_manual_partner_csv",
    generatedAt: now(),
    count: listings.length,
    listings,
    sourceHealth: {
      manual: "active",
      partnerSubmitted: "active",
      csvUpload: "active",
      domainApi: process.env.DOMAIN_API_KEY || process.env.DOMAIN_CLIENT_ID ? "configured" : "not_configured",
      propTrack: process.env.PROPTRACK_API_KEY ? "configured" : "not_configured",
      adzuna: "signal_layer_only_not_listing_inventory",
    },
  };
}

export async function listClientPropertyListings(filters: any = {}) {
  const data = await listAdminPropertyListings({ ...filters, status: filters.status || "active" });
  return {
    ...data,
    listings: data.listings.map(clientSafe),
  };
}

export async function createManualPropertyListing(input: any) {
  const store = await loadStore();
  const listing = normaliseListing(input, input.source || "manual");

  store.listings.unshift(listing);
  await saveStore(store);

  return {
    ok: true,
    listing,
  };
}

export async function updatePropertyListing(id: string, input: any) {
  const store = await loadStore();
  const index = store.listings.findIndex((l) => l.id === id);

  if (index === -1) {
    return { ok: false, error: "Listing not found" };
  }

  store.listings[index] = {
    ...store.listings[index],
    ...normaliseListing({ ...store.listings[index], ...input, id }, store.listings[index].source),
    updatedAt: now(),
  };

  await saveStore(store);
  return { ok: true, listing: store.listings[index] };
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(clean);
}

export async function importPropertyListingsCsv(input: { csv: string; source?: PropertyListingSource; partnerName?: string }) {
  const csv = String(input.csv || "").trim();

  if (!csv) {
    return { ok: false, error: "CSV content is required" };
  }

  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1);

  const created: PropertyListing[] = [];
  const store = await loadStore();

  for (const row of rows) {
    const values = parseCsvLine(row);
    const obj: any = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] || "";
    });

    obj.source = input.source || "csv_upload";
    obj.partnerName = input.partnerName || obj.partnerName || "";

    created.push(normaliseListing(obj, obj.source));
  }

  store.listings.unshift(...created);
  await saveStore(store);

  return {
    ok: true,
    imported: created.length,
    listings: created,
  };
}

export async function seedSamplePropertyListings() {
  const store = await loadStore();

  if (store.listings.length > 0) {
    return { ok: true, skipped: true, count: store.listings.length };
  }

  const samples = [
    {
      listingType: "sale",
      propertyType: "house",
      source: "manual",
      status: "active",
      title: "Family house for sale in Brisbane",
      address: "Sample Street",
      suburb: "Paddington",
      city: "Brisbane",
      state: "QLD",
      price: "$1,250,000",
      bedrooms: 4,
      bathrooms: 2,
      parking: 2,
      description: "Sample manual listing for LeaseHawk testing. Replace with real partner-submitted listings.",
    },
    {
      listingType: "commercial_lease",
      propertyType: "office",
      source: "manual",
      status: "active",
      title: "Office lease opportunity in Fortitude Valley",
      address: "Sample Commercial Road",
      suburb: "Fortitude Valley",
      city: "Brisbane",
      state: "QLD",
      rent: "$650/sqm gross",
      buildingSizeSqm: 420,
      description: "Sample commercial lease listing for testing. Replace with real agent or partner-submitted listing.",
    },
  ].map((x) => normaliseListing(x, "manual"));

  store.listings.push(...samples);
  await saveStore(store);

  return { ok: true, seeded: samples.length, listings: samples };
}
