import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "client-portal-store.json");
const EVENTS_FILE = path.join(DATA_DIR, "stripe-events.json");

type ClientPortalStore = {
  users: any[];
  projects: any[];
  uploads: any[];
};

type StripeEventStore = {
  events: any[];
};

function now() {
  return new Date().toISOString();
}

async function loadClientStore(): Promise<ClientPortalStore> {
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

async function saveClientStore(store: ClientPortalStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function loadEventStore(): Promise<StripeEventStore> {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { events: [] };
  }
}

async function saveEventStore(store: StripeEventStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EVENTS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normalisePlan(plan: string) {
  return String(plan || "free").trim();
}

function statusFromStripe(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "trialing") return "trialing";
  if (s === "past_due") return "past_due";
  if (s === "canceled" || s === "cancelled") return "cancelled";
  if (s === "incomplete") return "incomplete";
  if (s === "paused") return "paused";
  return s || "manual_review";
}

export async function attachStripeCustomerToClient(input: {
  clientUserId?: string;
  tenantId?: string;
  email?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan?: string;
  subscriptionStatus?: string;
}) {
  const store = await loadClientStore();

  const index = store.users.findIndex((u) =>
    (input.clientUserId && u.id === input.clientUserId) ||
    (input.tenantId && u.tenantId === input.tenantId) ||
    (input.email && String(u.email).toLowerCase() === String(input.email).toLowerCase()) ||
    (input.stripeCustomerId && u.stripeCustomerId === input.stripeCustomerId),
  );

  if (index === -1) {
    return { ok: false, error: "Client user not found for Stripe customer sync." };
  }

  store.users[index] = {
    ...store.users[index],
    ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
    ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
    ...(input.plan ? { plan: normalisePlan(input.plan) } : {}),
    ...(input.subscriptionStatus ? { subscriptionStatus: statusFromStripe(input.subscriptionStatus) } : {}),
    updatedAt: now(),
  };

  await saveClientStore(store);

  return {
    ok: true,
    user: {
      id: store.users[index].id,
      tenantId: store.users[index].tenantId,
      email: store.users[index].email,
      plan: store.users[index].plan,
      subscriptionStatus: store.users[index].subscriptionStatus,
      stripeCustomerId: store.users[index].stripeCustomerId || null,
      stripeSubscriptionId: store.users[index].stripeSubscriptionId || null,
    },
  };
}

export async function recordStripeEvent(event: any) {
  const store = await loadEventStore();

  if (event?.id && store.events.some((e) => e.id === event.id)) {
    return { ok: true, duplicate: true };
  }

  store.events.unshift({
    id: event?.id || "evt-local-" + Date.now(),
    type: event?.type || "unknown",
    createdAt: now(),
    receivedAt: now(),
    livemode: Boolean(event?.livemode),
    summary: {
      customer: event?.data?.object?.customer || null,
      subscription: event?.data?.object?.subscription || event?.data?.object?.id || null,
      status: event?.data?.object?.status || null,
    },
  });

  store.events = store.events.slice(0, 250);
  await saveEventStore(store);

  return { ok: true, duplicate: false };
}

function planFromMetadata(obj: any) {
  return (
    obj?.metadata?.plan ||
    obj?.metadata?.clientPlan ||
    obj?.lines?.data?.[0]?.price?.metadata?.plan ||
    ""
  );
}

export async function handleStripeWebhookEvent(event: any) {
  await recordStripeEvent(event);

  const type = event?.type;
  const obj = event?.data?.object || {};

  if (type === "checkout.session.completed") {
    return attachStripeCustomerToClient({
      clientUserId: obj?.metadata?.clientUserId,
      tenantId: obj?.metadata?.tenantId,
      email: obj?.customer_details?.email || obj?.metadata?.email,
      stripeCustomerId: typeof obj.customer === "string" ? obj.customer : obj.customer?.id,
      stripeSubscriptionId: typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id,
      plan: planFromMetadata(obj),
      subscriptionStatus: "active",
    });
  }

  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  ) {
    return attachStripeCustomerToClient({
      stripeCustomerId: typeof obj.customer === "string" ? obj.customer : obj.customer?.id,
      stripeSubscriptionId: obj.id,
      plan: planFromMetadata(obj),
      subscriptionStatus: obj.status,
    });
  }

  if (type === "invoice.payment_failed") {
    return attachStripeCustomerToClient({
      stripeCustomerId: typeof obj.customer === "string" ? obj.customer : obj.customer?.id,
      stripeSubscriptionId: typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id,
      subscriptionStatus: "past_due",
    });
  }

  return { ok: true, ignored: true, type };
}

export async function getStripeBillingOverview() {
  const events = await loadEventStore();

  return {
    ok: true,
    configured: {
      secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
      webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      prices: {
        starter: Boolean(process.env.STRIPE_PRICE_STARTER),
        growth: Boolean(process.env.STRIPE_PRICE_GROWTH),
        leasehawkPro: Boolean(process.env.STRIPE_PRICE_LEASEHAWK_PRO),
        leasehawkPlus: Boolean(process.env.STRIPE_PRICE_LEASEHAWK_PLUS),
        phantomxPro: Boolean(process.env.STRIPE_PRICE_PHANTOMX_PRO),
      },
    },
    recentEvents: events.events.slice(0, 25),
  };
}
