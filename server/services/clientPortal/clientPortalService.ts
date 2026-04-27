import fs from "fs/promises";
import path from "path";
import { getPlanAccess } from "./planAccess";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

export type ClientPlan =
  | "free"
  | "starter"
  | "growth"
  | "leasehawk-pro"
  | "leasehawk-plus"
  | "enterprise"
  | "phantomx-paper"
  | "phantomx-pro"
  | "phantomx-live-readiness";

type ClientUser = {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  companyName: string;
  phone?: string;
  companySize?: string;
  projectType?: string;
  plan: ClientPlan;
  passwordHash: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  legalAcceptedAt?: string;
  trialStartedAt: string;
  trialEndsAt: string;
  subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled" | "free" | "incomplete";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
};

type ClientProject = {
  id: string;
  tenantId: string;
  clientUserId: string;
  title: string;
  goal?: string;
  timeline?: string;
  budget?: string;
  seats?: string;
  city?: string;
  status: "new" | "planning" | "quoting" | "procurement" | "active" | "complete";
  createdAt: string;
  updatedAt: string;
};

type ClientUpload = {
  id: string;
  tenantId: string;
  clientUserId: string;
  projectId?: string;
  fileName: string;
  fileType: string;
  category: "floor_plan" | "office_photo" | "product_list" | "competitor_quote" | "lease_document" | "project_brief" | "other";
  notes?: string;
  createdAt: string;
};

type ClientStore = {
  users: ClientUser[];
  projects: ClientProject[];
  uploads: ClientUpload[];
  supportMessages: any[];
};

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "client-portal-store.json");
const activeSessions = new Map<string, { userId: string; tenantId: string; createdAt: string }>();

function now() {
  return new Date().toISOString();
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function loadStore(): Promise<ClientStore> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      supportMessages: Array.isArray(parsed.supportMessages) ? parsed.supportMessages : [],
    };
  } catch {
    return { users: [], projects: [], uploads: [], supportMessages: [] };
  }
}

async function saveStore(store: ClientStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normaliseEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, key] = String(stored || "").split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(key, "hex");
  if (candidate.length !== original.length) return false;
  return timingSafeEqual(candidate, original);
}

function publicUser(user: ClientUser) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function assertPlan(value: any): ClientPlan {
  const allowed: ClientPlan[] = [
    "free",
    "starter",
    "growth",
    "leasehawk-pro",
    "leasehawk-plus",
    "enterprise",
    "phantomx-paper",
    "phantomx-pro",
    "phantomx-live-readiness",
  ];
  return allowed.includes(value) ? value : "free";
}

function createSession(user: ClientUser) {
  const token = `tcd_client_${randomBytes(32).toString("hex")}`;
  activeSessions.set(token, {
    userId: user.id,
    tenantId: user.tenantId,
    createdAt: now(),
  });
  return token;
}

export async function getClientByToken(token?: string | null) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  const store = await loadStore();
  const user = store.users.find((u) => u.id === session.userId && u.tenantId === session.tenantId);
  return user || null;
}

export async function requireClient(token?: string | null) {
  const user = await getClientByToken(token);
  if (!user) {
    const err: any = new Error("Client authentication required");
    err.status = 401;
    throw err;
  }
  return user;
}

export async function signupClient(input: any) {
  const store = await loadStore();
  const email = normaliseEmail(input.email);
  const password = String(input.password || input.email || randomBytes(8).toString("hex"));

  if (!email.includes("@")) {
    return { ok: false, error: "Valid business email is required" };
  }

  const existing = store.users.find((u) => u.email === email);
  if (existing) {
    return { ok: false, error: "Client account already exists" };
  }

  const t = now();
  const user: ClientUser = {
    id: id("client"),
    tenantId: id("tenant"),
    fullName: String(input.fullName || input.name || ""),
    email,
    companyName: String(input.companyName || input.company || "Client Company"),
    phone: input.phone || "",
    companySize: input.companySize || "",
    projectType: input.projectType || "",
    plan: assertPlan(input.plan || input.tier),
    passwordHash: hashPassword(password),
    emailVerified: false,
    onboardingComplete: false,
    legalAcceptedAt: input.legalAccepted ? t : undefined,
    trialStartedAt: t,
    trialEndsAt: addDays(new Date(), 14).toISOString(),
    subscriptionStatus: input.plan === "free" || input.tier === "free" ? "free" : "trialing",
    createdAt: t,
    updatedAt: t,
  };

  store.users.push(user);
  await saveStore(store);

  const token = createSession(user);
  return { ok: true, token, user: publicUser(user) };
}

export async function loginClient(input: any) {
  const store = await loadStore();
  const email = normaliseEmail(input.email);
  const password = String(input.password || input.email || "");
  const user = store.users.find((u) => u.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid client credentials" };
  }

  const token = createSession(user);
  return { ok: true, token, user: publicUser(user) };
}

export async function completeClientOnboarding(token: string | undefined, input: any) {
  const user = await requireClient(token);
  const store = await loadStore();
  const idx = store.users.findIndex((u) => u.id === user.id && u.tenantId === user.tenantId);
  if (idx === -1) return { ok: false, error: "Client not found" };

  store.users[idx].onboardingComplete = true;
  store.users[idx].updatedAt = now();

  const project: ClientProject = {
    id: id("project"),
    tenantId: user.tenantId,
    clientUserId: user.id,
    title: input.goal ? `${input.goal}` : "First workspace project",
    goal: input.goal || "",
    timeline: input.timeline || "",
    budget: input.budget || "",
    seats: input.seats || "",
    city: input.city || "",
    status: "new",
    createdAt: now(),
    updatedAt: now(),
  };

  store.projects.push(project);
  await saveStore(store);

  return { ok: true, user: publicUser(store.users[idx]), project };
}

export async function getClientDashboard(token: string | undefined) {
  const user = await requireClient(token);
  const store = await loadStore();
  const projects = store.projects.filter((p) => p.tenantId === user.tenantId);
  const uploads = store.uploads.filter((u) => u.tenantId === user.tenantId);

  return {
    ok: true,
    user: publicUser(user),
    projects,
    uploads,
    quotes: [],
    procurementRequests: [],
    financeEnquiries: [],
    supportMessages: store.supportMessages.filter((m) => m.tenantId === user.tenantId),
    subscription: {
      plan: user.plan,
      status: user.subscriptionStatus,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      stripeCustomerId: user.stripeCustomerId || null,
    },
  };
}

export async function createClientProject(token: string | undefined, input: any) {
  const user = await requireClient(token);
  const store = await loadStore();

  const active = store.projects.filter((p) => p.tenantId === user.tenantId && p.status !== "complete").length;
  const limits: Record<string, number> = {
    free: 1,
    starter: 1,
    growth: 3,
    "leasehawk-pro": 1,
    "leasehawk-plus": 3,
    enterprise: 999,
    "phantomx-paper": 1,
    "phantomx-pro": 1,
    "phantomx-live-readiness": 1,
  };

  if (active >= (limits[user.plan] ?? 1)) {
    return { ok: false, error: "Plan project limit reached", upgradeRequired: true };
  }

  const project: ClientProject = {
    id: id("project"),
    tenantId: user.tenantId,
    clientUserId: user.id,
    title: input.title || input.goal || "Workspace project",
    goal: input.goal || "",
    timeline: input.timeline || "",
    budget: input.budget || "",
    seats: input.seats || "",
    city: input.city || "",
    status: "new",
    createdAt: now(),
    updatedAt: now(),
  };

  store.projects.push(project);
  await saveStore(store);
  return { ok: true, project };
}

export async function addClientUploadMetadata(token: string | undefined, input: any) {
  const user = await requireClient(token);
  const store = await loadStore();

  const upload: ClientUpload = {
    id: id("upload"),
    tenantId: user.tenantId,
    clientUserId: user.id,
    projectId: input.projectId || undefined,
    fileName: String(input.fileName || "uploaded-file"),
    fileType: String(input.fileType || "unknown"),
    category: input.category || "other",
    notes: input.notes || "",
    createdAt: now(),
  };

  store.uploads.push(upload);
  await saveStore(store);
  return { ok: true, upload };
}

export function planAllows(plan: ClientPlan, feature: string) {
  const ranks: Record<ClientPlan, number> = {
    free: 0,
    starter: 1,
    growth: 2,
    "leasehawk-pro": 3,
    "leasehawk-plus": 4,
    enterprise: 5,
    "phantomx-paper": 2,
    "phantomx-pro": 3,
    "phantomx-live-readiness": 5,
  };

  if (feature === "leasehawk") return ranks[plan] >= 3 || plan === "enterprise";
  if (feature === "phantomx-paper") return plan === "phantomx-paper" || plan === "phantomx-pro" || plan === "enterprise";
  if (feature === "exports") return plan === "leasehawk-plus" || plan === "enterprise";
  if (feature === "procurement") return ranks[plan] >= 2;
  return true;
}

export async function getCustomerSafeLeaseHawk(token: string | undefined) {
  const user = await requireClient(token);
  const { getLeaseHawkFeedForTenant } = await import("../propertyIntelligence/leasehawkEngine");
  return getLeaseHawkFeedForTenant({
    tenantId: user.tenantId,
    plan: user.plan,
  });
}

export async function getCustomerSafePhantomX(token: string | undefined) {
  const user = await requireClient(token);
  const { getPhantomXPaperState } = await import("../trading/phantomXPaperLearner");
  const state = await getPhantomXPaperState();

  return {
    ok: true,
    locked: false,
    free: true,
    paperOnly: true,
    liveTradingEnabled: false,
    disclaimer: "PhantomX Paper Trader is free pretend-money trading only. No real funds, no live exchange orders, no financial advice.",
    balance: state.balance,
    equity: state.equity,
    running: state.running,
    tickCount: state.tickCount,
    openPositions: state.positions.filter((p: any) => p.status === "open"),
    recentOutcomes: state.outcomes.slice(0, 50),
    learning: state.learning,
  };
}

export async function listAdminClients() {
  const store = await loadStore();
  return {
    ok: true,
    users: store.users.map(publicUser),
    projects: store.projects,
    uploads: store.uploads,
    stats: {
      users: store.users.length,
      projects: store.projects.length,
      uploads: store.uploads.length,
      trialing: store.users.filter((u) => u.subscriptionStatus === "trialing").length,
      active: store.users.filter((u) => u.subscriptionStatus === "active").length,
    },
  };
}

export async function createStripeCheckout(input: any) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return {
      ok: false,
      configured: false,
      error: "STRIPE_SECRET_KEY is not configured",
      message: "Stripe checkout route is ready, but billing is not enabled until Stripe secrets and price IDs are configured.",
    };
  }

  const priceId = String(input.priceId || process.env[`STRIPE_PRICE_${String(input.plan || "").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] || "");
  if (!priceId) {
    return {
      ok: false,
      configured: false,
      error: "Stripe price ID missing for selected plan",
    };
  }

  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("line_items[0][price]", priceId);
  params.append("line_items[0][quantity]", "1");
  params.append("subscription_data[trial_period_days]", "14");
  params.append("success_url", input.successUrl || "http://localhost:5000/client-dashboard?checkout=success");
  params.append("cancel_url", input.cancelUrl || "http://localhost:5000/subscriptions?checkout=cancelled");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const json = await res.json();
  if (!res.ok) {
    return { ok: false, configured: true, error: json };
  }

  return { ok: true, configured: true, checkoutUrl: json.url, session: json };
}


export async function getClientPlanAccess(token: string | undefined) {
  const user = await requireClient(token);

  return {
    ok: true,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      companyName: user.companyName,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      stripeCustomerId: user.stripeCustomerId || null,
      stripeSubscriptionId: user.stripeSubscriptionId || null,
    },
    access: getPlanAccess(user.plan),
  };
}

export async function getClientCheckoutStatus(plan: string) {
  const configured = Boolean(process.env.STRIPE_SECRET_KEY);
  const envName = `STRIPE_PRICE_${String(plan || "").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const priceId = process.env[envName];

  return {
    ok: true,
    configured,
    plan,
    priceEnv: envName,
    priceConfigured: Boolean(priceId),
    message: configured && priceId
      ? "Stripe checkout is configured for this plan."
      : "Stripe checkout is not fully configured. Add STRIPE_SECRET_KEY and the matching STRIPE_PRICE_* env var.",
  };
}


export async function createClientBillingPortal(token: string | undefined, returnUrl?: string) {
  const user = await requireClient(token);

  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, configured: false, error: "STRIPE_SECRET_KEY is not configured" };
  }

  if (!user.stripeCustomerId) {
    return {
      ok: false,
      configured: true,
      error: "No Stripe customer is linked to this client yet. Complete checkout first.",
    };
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl || process.env.PUBLIC_APP_URL || "http://localhost:5000/client/billing",
  });

  return {
    ok: true,
    configured: true,
    url: session.url,
  };
}
