import Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  webhookEvents,
  quotes,
  paymentIntentsLog,
  invoicesLog,
  auditLogs,
  dealExecution,
} from "../../../shared/schema";

import { getStripeClient, getStripeConfig } from "./stripeConfigService";
import { recordRevenueEvent } from "./revenueService";

/**
 * Processes a Stripe webhook event using the *raw* request body + signature.
 * - Verifies Stripe signature
 * - Idempotently stores the event
 * - Handles the event
 * - Marks processed + writes audit log
 */
export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{
  success: boolean;
  eventId?: string;
  eventType?: string;
  message?: string;
}> {
  const config = getStripeConfig();
  const stripe = getStripeClient();

  if (!stripe) return { success: false, message: "Stripe not configured" };

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn(
      "[WebhookService] STRIPE_WEBHOOK_SECRET not set — cannot verify webhook"
    );
    return { success: false, message: "STRIPE_WEBHOOK_SECRET not configured" };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(
      "[WebhookService] Signature verification failed:",
      err?.message
    );
    return {
      success: false,
      message: `Signature verification failed: ${err?.message ?? "unknown"}`,
    };
  }

  // 1) Fast-path idempotency: if already processed, skip.
  const [existing] = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, "stripe"),
        eq(webhookEvents.externalEventId, event.id)
      )
    )
    .limit(1);

  if (existing?.processed) {
    console.log(
      `[WebhookService] Duplicate event ${event.id} — already processed, skipping`
    );
    return {
      success: true,
      eventId: existing.id,
      eventType: event.type,
      message: "duplicate_skipped",
    };
  }

  // 2) Insert record (idempotent). If conflict, we treat as duplicate.
  const [webhookRecord] = await db
    .insert(webhookEvents)
    .values({
      provider: "stripe",
      externalEventId: event.id,
      eventType: event.type,
      processed: false,
      payloadJson: event as unknown as Record<string, unknown>, // store whole event for forensic/debug
    })
    .onConflictDoNothing()
    .returning();

  if (!webhookRecord) {
    // Another worker likely inserted it concurrently.
    return { success: true, eventType: event.type, message: "duplicate_skipped" };
  }

  // 3) Handle + mark processed
  try {
    await handleStripeEvent(event, config);

    await db
      .update(webhookEvents)
      .set({
        processed: true,
        processedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(webhookEvents.id, webhookRecord.id));

    await db.insert(auditLogs).values({
      actorType: "stripe_webhook",
      action: `webhook_processed:${event.type}`,
      entityType: "webhook_event",
      entityId: webhookRecord.id,
      metadataJson: { stripeEventId: event.id, eventType: event.type },
    });

    return { success: true, eventId: webhookRecord.id, eventType: event.type };
  } catch (err: any) {
    console.error(
      `[WebhookService] Error processing ${event.type}:`,
      err?.message
    );

    await db
      .update(webhookEvents)
      .set({ errorMessage: err?.message ?? "unknown_error" })
      .where(eq(webhookEvents.id, webhookRecord.id));

    return { success: false, eventType: event.type, message: err?.message ?? "unknown_error" };
  }
}

async function handleStripeEvent(
  event: Stripe.Event,
  config: ReturnType<typeof getStripeConfig>
) {
  switch (event.type) {
    /**
     * Checkout Session completed (generally used with Payment Links / Checkout).
     * If payment_status is "paid" and metadata includes quoteId, mark quote paid.
     */
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      const quoteId = session.metadata?.quoteId;
      const amountTotal = session.amount_total ?? 0;
      const currency = session.currency ?? "aud";

      if (quoteId && session.payment_status === "paid") {
        await markQuotePaid({
          quoteId,
          amount: amountTotal,
          currency,
          companyId: session.metadata?.companyId,
          isSimulated: config.testMode,
        });
      }
      break;
    }

    /**
     * PaymentIntent succeeded (typical direct card payment flow).
     * - Log intent
     * - Mark quote paid
     * - Mark deal won (+ optional commissions creation)
     */
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;

      const quoteId = intent.metadata?.quoteId;
      const opportunityId = intent.metadata?.opportunityId ?? null;
      const companyId = intent.metadata?.companyId ?? null;

      console.log(
        `[WebhookService] payment_intent.succeeded — id: ${intent.id}, amount: ${intent.amount}, quoteId: ${quoteId}`
      );

      await db
        .insert(paymentIntentsLog)
          .values({
          amount: intent.amount,
          currency: intent.currency,
          paymentStatus: "succeeded",
          rawPayloadJson: intent as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing();

      if (quoteId) {
        await markQuotePaid({
          quoteId,
          amount: intent.amount,
          currency: intent.currency,
          companyId: companyId ?? undefined,
          isSimulated: config.testMode,
        });

        // Mark deal won if companyName provided
        const companyName = intent.metadata?.companyName;
        if (companyName) {
          const dealId = await upsertWonDealFromPayment({
            companyName,
            amountCents: intent.amount,
            stripeId: intent.id,
          });

          // Auto-create partner commissions if this deal has linked partner opportunities
          if (dealId) {
            await tryCreatePartnerCommissions({
              dealId,
              amountCents: intent.amount,
              stripeId: intent.id,
            });
          }
        }
      }

      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;

      await db
        .insert(paymentIntentsLog)
          .values({
          amount: intent.amount,
          currency: intent.currency,
          paymentStatus: "failed",
          rawPayloadJson: intent as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing();

      const quoteId = intent.metadata?.quoteId;
      if (quoteId) {
        await db
          .update(quotes)
          .set({ financialStatus: "payment_failed" })
          .where(eq(quotes.id, quoteId));
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;

      await db
        .update(invoicesLog)
        .set({
          status: "paid",
          amountPaid: invoice.amount_paid,
          paidAt: new Date(),
        })
        .where(eq(invoicesLog.stripeInvoiceId, invoice.id));

      const quoteId = invoice.metadata?.quoteId;
      if (quoteId) {
        await markQuotePaid({
          quoteId,
          amount: invoice.amount_paid,
          currency: invoice.currency ?? "aud",
          companyId: invoice.metadata?.companyId,
          isSimulated: config.testMode,
          revenueEventType: "invoice_paid",
        });
      }

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;

      await db
        .update(invoicesLog)
        .set({ status: "payment_failed" })
        .where(eq(invoicesLog.stripeInvoiceId, invoice.id));

      break;
    }

    case "invoice.finalized": {
      const invoice = event.data.object as Stripe.Invoice;

      await db
        .update(invoicesLog)
        .set({
          status: "sent",
          stripeHostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
          stripeInvoiceUrl: invoice.invoice_pdf || undefined,
        })
        .where(eq(invoicesLog.stripeInvoiceId, invoice.id));

      break;
    }

    default: {
      console.log(`[WebhookService] Unhandled event type: ${event.type}`);
    }
  }
}

/**
 * Marks quote as fully paid and records revenue event.
 * Stripe amounts are in cents.
 */
async function markQuotePaid(opts: {
  quoteId: string;
  amount: number; // cents
  currency: string;
  opportunityId?: string | null;
  companyId?: string | null;
  isSimulated: boolean;
  revenueEventType?: "full_payment_received" | "invoice_paid";
}) {
  const eventType = opts.revenueEventType ?? "full_payment_received";

  await db
    .update(quotes)
    .set({
      financialStatus: "paid",
      amountPaid: opts.amount,
      amountDue: 0,
      lastPaymentAt: new Date(),
    })
    .where(eq(quotes.id, opts.quoteId));

  await recordRevenueEvent({
    companyId: opts.companyId ?? undefined,
    eventType,
    amount: opts.amount,
    currency: opts.currency || "aud",
    isSimulated: opts.isSimulated,
  });
}

/**
 * Upsert a "won" dealExecution record based on payment metadata.
 * Returns dealExecution.id if created/updated.
 */
async function upsertWonDealFromPayment(opts: {
  companyName: string;
  amountCents: number;
  stripeId: string;
}): Promise<string | undefined> {
  const [existingDeal] = await db
    .select()
    .from(dealExecution)
    .where(eq(dealExecution.companyName, opts.companyName))
    .limit(1);

  const dealValueEstimate = Math.round(opts.amountCents / 100);
  const lastAction = `Payment received: $${(opts.amountCents / 100).toFixed(
    2
  )} AUD`;

  if (existingDeal) {
    await db
      .update(dealExecution)
      .set({
        stage: "won",
        status: "won",
        dealValueEstimate,
        lastAction,
        wonAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dealExecution.id, existingDeal.id));

    console.log(
      `[WebhookService] Deal ${existingDeal.id} marked WON via payment`
    );

    return existingDeal.id;
  }

  const [newDeal] = await db
    .insert(dealExecution)
    .values({
      companyName: opts.companyName,
      stage: "won",
      status: "won",
      dealValueEstimate,
      lastAction: `Payment received via Stripe: $${(opts.amountCents / 100).toFixed(
        2
      )} AUD`,
      nextAction: "Deliver order",
      assignedTo: "human",
      stripePaymentLinkId: opts.stripeId,
      wonAt: new Date(),
    })
    .returning();

  return newDeal?.id;
}

async function tryCreatePartnerCommissions(opts: {
  dealId: string;
  amountCents: number;
  stripeId: string;
}) {
  try {
    const {
      commissions: commsTable,
      partnerOpportunities: partnerOpps,
      partners: partnersTable,
    } = await import("../../../shared/schema");

    const linkedOpps = await db
      .select()
      .from(partnerOpps)
      .where(eq(partnerOpps.dealExecutionId, opts.dealId));

    for (const opp of linkedOpps) {
      const [partner] = await db
        .select()
        .from(partnersTable)
        .where(eq(partnersTable.id, opp.partnerId))
        .limit(1);

      if (!partner) continue;

      const commRate = (partner as any).commissionRate ?? opp.commissionRate ?? 5;
      const dealValueDollars = Math.round(opts.amountCents / 100);

      // commissionAmount stored in cents
      const commissionAmountCents = Math.round(
        dealValueDollars * (commRate / 100) * 100
      );

      await db
        .insert(commsTable)
        .values({
          partnerId: opp.partnerId,
                    dealValue: dealValueDollars,
          commissionAmount: commissionAmountCents,
          status: "pending",
          notes: `Auto-created on payment_intent.succeeded — Stripe ID: ${opts.stripeId}`,
        })
        .onConflictDoNothing();
    }

    if (linkedOpps.length > 0) {
      console.log(
        `[WebhookService] Created commissions for ${linkedOpps.length} partner(s)`
      );
    }
  } catch (err: any) {
    console.error(
      "[WebhookService] Commission creation failed:",
      err?.message
    );
  }
}

export async function simulateWebhookEvent(opts: {
  eventType: string;
  quoteId?: string;
  amount?: number; // cents
  currency?: string;
  opportunityId?: string;
  companyId?: string;
}): Promise<{ success: boolean; message: string }> {
  const config = getStripeConfig();

  const [record] = await db
    .insert(webhookEvents)
    .values({
      provider: "stripe",
      externalEventId: `sim_${Date.now()}`,
      eventType: opts.eventType,
      processed: true,
      processedAt: new Date(),
      payloadJson: { simulated: true, ...opts },
    })
    .returning();

  // Keep legacy simulation behavior consistent
  if (opts.eventType === "payment_intent.succeeded" && opts.quoteId) {
    await markQuotePaid({
      quoteId: opts.quoteId ?? "simulated",
            amount: opts.amount ?? 0,
      currency: opts.currency ?? "aud",
      companyId: opts.companyId,
      isSimulated: true,
      revenueEventType: "full_payment_received",
    });
  }

  if (opts.eventType === "invoice.paid" && opts.quoteId) {
    await markQuotePaid({
      quoteId: opts.quoteId ?? "simulated",
            amount: opts.amount ?? 0,
      currency: opts.currency ?? "aud",
      companyId: opts.companyId,
      isSimulated: true,
      revenueEventType: "invoice_paid",
    });
  }

  await db.insert(auditLogs).values({
    actorType: "admin",
    action: "simulate_webhook",
    entityType: "webhook_event",
    entityId: record.id,
    metadataJson: { ...opts, testMode: config.testMode },
  });

  return {
    success: true,
    message: `Webhook event ${opts.eventType} simulated successfully`,
  };
}