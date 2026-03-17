import { db } from "../../db";
import { webhookEvents, quotes, paymentLinks, paymentIntentsLog, invoicesLog, auditLogs } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { getStripeClient, getStripeConfig } from "./stripeConfigService";
import { recordRevenueEvent } from "./revenueService";
import Stripe from "stripe";

export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{ success: boolean; eventId?: string; eventType?: string; message?: string }> {
  const config = getStripeConfig();
  const stripe = getStripeClient();

  if (!stripe) {
    return { success: false, message: "Stripe not configured" };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[WebhookService] STRIPE_WEBHOOK_SECRET not set — cannot verify webhook");
    return { success: false, message: "STRIPE_WEBHOOK_SECRET not configured" };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[WebhookService] Signature verification failed:", err.message);
    return { success: false, message: `Signature verification failed: ${err.message}` };
  }

  const [existing] = await db.select().from(webhookEvents)
    .where(and(eq(webhookEvents.provider, "stripe"), eq(webhookEvents.externalEventId, event.id)));

  if (existing?.processed) {
    console.log(`[WebhookService] Duplicate event ${event.id} — already processed, skipping`);
    return { success: true, eventId: existing.id, eventType: event.type, message: "duplicate_skipped" };
  }

  const [webhookRecord] = await db.insert(webhookEvents).values({
    provider: "stripe",
    externalEventId: event.id,
    eventType: event.type,
    processed: false,
    payloadJson: JSON.stringify(event.data.object),
  }).onConflictDoNothing().returning();

  if (!webhookRecord) {
    return { success: true, message: "duplicate_skipped" };
  }

  try {
    await handleStripeEvent(event, config);

    await db.update(webhookEvents).set({
      processed: true,
      processedAt: new Date(),
    }).where(eq(webhookEvents.id, webhookRecord.id));

    await db.insert(auditLogs).values({
      actorType: "stripe_webhook",
      action: `webhook_processed:${event.type}`,
      entityType: "webhook_event",
      entityId: webhookRecord.id,
      metadataJson: JSON.stringify({ eventId: event.id, eventType: event.type }),
    });

    return { success: true, eventId: webhookRecord.id, eventType: event.type };
  } catch (err: any) {
    console.error(`[WebhookService] Error processing ${event.type}:`, err.message);
    await db.update(webhookEvents).set({
      errorMessage: err.message,
    }).where(eq(webhookEvents.id, webhookRecord.id));
    return { success: false, message: err.message };
  }
}

async function handleStripeEvent(event: Stripe.Event, config: ReturnType<typeof getStripeConfig>) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const quoteId = session.metadata?.quoteId;
      if (quoteId && session.payment_status === "paid") {
        await db.update(quotes).set({
          financialStatus: "paid",
          amountPaid: session.amount_total || 0,
          amountDue: 0,
          lastPaymentAt: new Date(),
        }).where(eq(quotes.id, quoteId));

        await recordRevenueEvent({
          quoteId,
          opportunityId: session.metadata?.opportunityId,
          companyId: session.metadata?.companyId,
          eventType: "full_payment_received",
          amount: session.amount_total || 0,
          currency: session.currency || "aud",
          isSimulated: config.testMode,
        });
      }
      break;
    }

    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const quoteId = intent.metadata?.quoteId;

      await db.insert(paymentIntentsLog).values({
        quoteId: quoteId || null,
        opportunityId: intent.metadata?.opportunityId || null,
        stripePaymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        paymentStatus: "succeeded",
        rawPayloadJson: JSON.stringify(intent),
      }).onConflictDoNothing();

      if (quoteId) {
        await db.update(quotes).set({
          financialStatus: "paid",
          amountPaid: intent.amount,
          amountDue: 0,
          lastPaymentAt: new Date(),
        }).where(eq(quotes.id, quoteId));

        await recordRevenueEvent({
          quoteId,
          opportunityId: intent.metadata?.opportunityId,
          eventType: "full_payment_received",
          amount: intent.amount,
          currency: intent.currency,
          isSimulated: config.testMode,
        });
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await db.insert(paymentIntentsLog).values({
        quoteId: intent.metadata?.quoteId || null,
        stripePaymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        paymentStatus: "failed",
        rawPayloadJson: JSON.stringify(intent),
      }).onConflictDoNothing();

      if (intent.metadata?.quoteId) {
        await db.update(quotes).set({ financialStatus: "payment_failed" }).where(eq(quotes.id, intent.metadata.quoteId));
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const quoteId = invoice.metadata?.quoteId;

      await db.update(invoicesLog).set({
        status: "paid",
        amountPaid: invoice.amount_paid,
        paidAt: new Date(),
      }).where(eq(invoicesLog.stripeInvoiceId, invoice.id));

      if (quoteId) {
        await db.update(quotes).set({
          financialStatus: "paid",
          amountPaid: invoice.amount_paid,
          amountDue: 0,
          lastPaymentAt: new Date(),
        }).where(eq(quotes.id, quoteId));

        await recordRevenueEvent({
          quoteId,
          opportunityId: invoice.metadata?.opportunityId,
          eventType: "invoice_paid",
          amount: invoice.amount_paid,
          currency: invoice.currency,
          isSimulated: config.testMode,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await db.update(invoicesLog).set({ status: "payment_failed" }).where(eq(invoicesLog.stripeInvoiceId, invoice.id));
      break;
    }

    case "invoice.finalized": {
      const invoice = event.data.object as Stripe.Invoice;
      await db.update(invoicesLog).set({
        status: "sent",
        stripeHostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
        stripeInvoiceUrl: invoice.invoice_pdf || undefined,
      }).where(eq(invoicesLog.stripeInvoiceId, invoice.id));
      break;
    }

    default:
      console.log(`[WebhookService] Unhandled event type: ${event.type}`);
  }
}

export async function simulateWebhookEvent(opts: {
  eventType: string;
  quoteId?: string;
  amount?: number;
  currency?: string;
  opportunityId?: string;
  companyId?: string;
}): Promise<{ success: boolean; message: string }> {
  const config = getStripeConfig();

  const [record] = await db.insert(webhookEvents).values({
    provider: "stripe",
    externalEventId: `sim_${Date.now()}`,
    eventType: opts.eventType,
    processed: true,
    processedAt: new Date(),
    payloadJson: JSON.stringify({ simulated: true, ...opts }),
  }).returning();

  if (opts.eventType === "payment_intent.succeeded" && opts.quoteId) {
    await db.update(quotes).set({
      financialStatus: "paid",
      amountPaid: opts.amount || 0,
      amountDue: 0,
      lastPaymentAt: new Date(),
    }).where(eq(quotes.id, opts.quoteId));

    await recordRevenueEvent({
      quoteId: opts.quoteId,
      opportunityId: opts.opportunityId,
      companyId: opts.companyId,
      eventType: "full_payment_received",
      amount: opts.amount || 0,
      currency: opts.currency || "aud",
      isSimulated: true,
    });
  }

  if (opts.eventType === "invoice.paid" && opts.quoteId) {
    await db.update(quotes).set({
      financialStatus: "paid",
      amountPaid: opts.amount || 0,
      amountDue: 0,
      lastPaymentAt: new Date(),
    }).where(eq(quotes.id, opts.quoteId));

    await recordRevenueEvent({
      quoteId: opts.quoteId,
      eventType: "invoice_paid",
      amount: opts.amount || 0,
      currency: opts.currency || "aud",
      isSimulated: true,
    });
  }

  await db.insert(auditLogs).values({
    actorType: "admin",
    action: "simulate_webhook",
    entityType: "webhook_event",
    entityId: record.id,
    metadataJson: JSON.stringify(opts),
  });

  return { success: true, message: `Webhook event ${opts.eventType} simulated successfully` };
}
