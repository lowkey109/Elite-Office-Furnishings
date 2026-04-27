import fs from "fs/promises";
import path from "path";
import { getPlanAccess } from "./planAccess";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "client-portal-store.json");

type ClientPortalStore = {
  users: any[];
  projects: any[];
  uploads: any[];
};

function now() {
  return new Date().toISOString();
}

async function loadStore(): Promise<ClientPortalStore> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
    };
  } catch {
    return { users: [], projects: [], uploads: [] };
  }
}

async function saveStore(store: ClientPortalStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function safeUser(user: any, store: ClientPortalStore) {
  const projects = store.projects.filter((p) => p.tenantId === user.tenantId);
  const uploads = store.uploads.filter((u) => u.tenantId === user.tenantId);
  const access = getPlanAccess(user.plan);

  return {
    id: user.id,
    tenantId: user.tenantId,
    fullName: user.fullName,
    email: user.email,
    companyName: user.companyName,
    phone: user.phone || "",
    companySize: user.companySize || "",
    projectType: user.projectType || "",
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    trialStartedAt: user.trialStartedAt || null,
    trialEndsAt: user.trialEndsAt || null,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    emailVerified: Boolean(user.emailVerified),
    onboardingComplete: Boolean(user.onboardingComplete),
    legalAcceptedAt: user.legalAcceptedAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    counts: {
      projects: projects.length,
      uploads: uploads.length,
    },
    access,
  };
}

export async function listAdminCustomers(filters: any = {}) {
  const store = await loadStore();

  let users = store.users.map((user) => safeUser(user, store));

  if (filters.plan) users = users.filter((u) => u.plan === filters.plan);
  if (filters.subscriptionStatus) users = users.filter((u) => u.subscriptionStatus === filters.subscriptionStatus);
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    users = users.filter((u) =>
      [u.fullName, u.email, u.companyName, u.plan, u.subscriptionStatus].join(" ").toLowerCase().includes(q),
    );
  }

  users = users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return {
    ok: true,
    generatedAt: now(),
    count: users.length,
    customers: users,
    stats: {
      total: store.users.length,
      trialing: store.users.filter((u) => u.subscriptionStatus === "trialing").length,
      active: store.users.filter((u) => u.subscriptionStatus === "active").length,
      pastDue: store.users.filter((u) => u.subscriptionStatus === "past_due").length,
      cancelled: store.users.filter((u) => u.subscriptionStatus === "cancelled").length,
      onboardingIncomplete: store.users.filter((u) => !u.onboardingComplete).length,
      emailUnverified: store.users.filter((u) => !u.emailVerified).length,
    },
  };
}

export async function getAdminCustomer(id: string) {
  const store = await loadStore();
  const user = store.users.find((u) => u.id === id || u.tenantId === id || u.email === id);

  if (!user) {
    return { ok: false, error: "Customer not found" };
  }

  return {
    ok: true,
    customer: safeUser(user, store),
    projects: store.projects.filter((p) => p.tenantId === user.tenantId),
    uploads: store.uploads.filter((u) => u.tenantId === user.tenantId),
  };
}

export async function updateAdminCustomerSubscription(id: string, patch: any) {
  const store = await loadStore();
  const index = store.users.findIndex((u) => u.id === id || u.tenantId === id || u.email === id);

  if (index === -1) {
    return { ok: false, error: "Customer not found" };
  }

  const allowedPlans = [
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

  const allowedStatuses = [
    "trialing",
    "active",
    "past_due",
    "cancelled",
    "incomplete",
    "paused",
    "manual_review",
  ];

  if (patch.plan && !allowedPlans.includes(patch.plan)) {
    return { ok: false, error: "Invalid plan" };
  }

  if (patch.subscriptionStatus && !allowedStatuses.includes(patch.subscriptionStatus)) {
    return { ok: false, error: "Invalid subscription status" };
  }

  store.users[index] = {
    ...store.users[index],
    ...(patch.plan ? { plan: patch.plan } : {}),
    ...(patch.subscriptionStatus ? { subscriptionStatus: patch.subscriptionStatus } : {}),
    ...(typeof patch.emailVerified === "boolean" ? { emailVerified: patch.emailVerified } : {}),
    ...(typeof patch.onboardingComplete === "boolean" ? { onboardingComplete: patch.onboardingComplete } : {}),
    ...(patch.stripeCustomerId !== undefined ? { stripeCustomerId: patch.stripeCustomerId } : {}),
    ...(patch.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: patch.stripeSubscriptionId } : {}),
    updatedAt: now(),
  };

  await saveStore(store);

  return {
    ok: true,
    customer: safeUser(store.users[index], store),
  };
}

export async function getAdminSubscriptionOverview() {
  const customers = await listAdminCustomers({});
  const byPlan: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const customer of customers.customers) {
    byPlan[customer.plan] = (byPlan[customer.plan] || 0) + 1;
    byStatus[customer.subscriptionStatus] = (byStatus[customer.subscriptionStatus] || 0) + 1;
  }

  const stripe = {
    secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    prices: {
      starter: Boolean(process.env.STRIPE_PRICE_STARTER),
      growth: Boolean(process.env.STRIPE_PRICE_GROWTH),
      leasehawkPro: Boolean(process.env.STRIPE_PRICE_LEASEHAWK_PRO),
      leasehawkPlus: Boolean(process.env.STRIPE_PRICE_LEASEHAWK_PLUS),
      phantomxPro: Boolean(process.env.STRIPE_PRICE_PHANTOMX_PRO),
    },
  };

  return {
    ok: true,
    generatedAt: now(),
    stats: customers.stats,
    byPlan,
    byStatus,
    stripe,
    subscriptions: customers.customers.map((customer) => ({
      id: customer.id,
      tenantId: customer.tenantId,
      email: customer.email,
      companyName: customer.companyName,
      plan: customer.plan,
      subscriptionStatus: customer.subscriptionStatus,
      trialEndsAt: customer.trialEndsAt,
      stripeCustomerId: customer.stripeCustomerId,
      stripeSubscriptionId: customer.stripeSubscriptionId,
      createdAt: customer.createdAt,
    })),
  };
}
