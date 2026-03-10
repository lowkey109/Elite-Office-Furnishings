import type { Express } from "express";
import OpenAI from "openai";
import nodemailer from "nodemailer";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const BRAND_CONTEXT = `
You are writing marketing content for The Corporate Desk (thecorporatedesk.com.au).

Brand voice: Premium, authoritative, concise. This is a luxury commercial office furniture supplier.
Target audience: Business owners, C-suite executives, facility managers, architects, property developers.
Key messages: ISO 9001 & 14001 certified, 6-year warranty, Australian owned, serves Brisbane/Sydney/Melbourne.
Products: Executive desks, boardroom tables, reception areas, ergonomic seating, complete office fitouts.
Project range: $30,000 – $300,000+
CTA focus: Free layout plan, quote requests, workplace strategy calls.
Phone: 1300 977 607 | Email: service@thecorporatedesk.com.au
Website: thecorporatedesk.com.au
`;

const PLATFORM_SPECS: Record<string, string> = {
  email: `Write a professional HTML email campaign. Include:
- Subject line (compelling, under 60 chars)
- Preview text (under 100 chars)  
- Header headline
- 2-3 short paragraphs of body copy
- Clear call-to-action button text
- Footer with contact details
Format as JSON: { subject, previewText, headline, body, ctaText, ctaUrl }`,

  facebook: `Write a Facebook post for a business page. Include:
- Engaging opening line (hook)
- 2-3 short paragraphs
- 3-5 relevant hashtags
- Call to action with phone or website
Max 400 words total. Use line breaks for readability.
Format as JSON: { post, hashtags }`,

  instagram: `Write an Instagram post. Include:
- Strong visual description suggestion (for an image/carousel)
- Caption with hook (first line must grab attention, shows before "more")
- 15-20 relevant hashtags (mix of broad and niche)
- CTA in bio reference
Format as JSON: { visualSuggestion, caption, hashtags }`,

  telegram: `Write a Telegram channel post. Include:
- Bold headline using **text** markdown
- Concise body (2-3 paragraphs)  
- Bullet points where appropriate using • 
- Contact/link at bottom
Keep it under 300 words. Format as JSON: { message }`,

  twitter: `Write a series of 3 tweets as a thread for X (Twitter). Include:
- Tweet 1: Hook/headline (under 280 chars)
- Tweet 2: Value proposition (under 280 chars)
- Tweet 3: CTA (under 280 chars)
Use relevant hashtags in tweets 2 and 3.
Format as JSON: { tweets: [string, string, string] }`,

  whatsapp: `Write a WhatsApp Business message. Include:
- Friendly but professional opening
- Clear value message (2-3 sentences max)
- Direct CTA (call number or visit website)
Keep it conversational, under 150 words. No excessive formatting.
Format as JSON: { message }`,
};

export function registerMarketingRoutes(app: Express) {

  app.post("/api/marketing/generate", async (req, res) => {
    try {
      const { platform, topic, tone = "professional", customBrief } = req.body;

      if (!platform || !PLATFORM_SPECS[platform]) {
        return res.status(400).json({ error: "Valid platform required: email, facebook, instagram, telegram, twitter, whatsapp" });
      }

      const prompt = `${BRAND_CONTEXT}

PLATFORM: ${platform.toUpperCase()}
TOPIC/CAMPAIGN: ${topic || "General brand awareness and lead generation"}
TONE: ${tone}
${customBrief ? `ADDITIONAL BRIEF: ${customBrief}` : ""}

${PLATFORM_SPECS[platform]}

IMPORTANT: Return ONLY valid JSON, no markdown, no extra text.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        
      } as any);

      const rawContent = completion.choices[0]?.message?.content || "{}";
      
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        const match = rawContent.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { raw: rawContent };
      }

      res.json({ success: true, platform, content: parsed });
    } catch (error) {
      console.error("Generate error:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  app.post("/api/marketing/send-email", async (req, res) => {
    try {
      const { to, subject, htmlBody, previewText } = req.body;

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const emailFrom = process.env.EMAIL_FROM || "The Corporate Desk <service@thecorporatedesk.com.au>";

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(400).json({
          error: "Email not configured",
          missing: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter(k => !process.env[k]),
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;background:#0d0f14;">
  <div style="background:linear-gradient(135deg,#1a1c24,#0d0f14);padding:40px 32px;text-align:center;border-bottom:1px solid rgba(201,168,76,0.2);">
    <p style="color:rgba(201,168,76,0.7);font-size:10px;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px">THE CORPORATE</p>
    <p style="color:#C9A84C;font-size:14px;letter-spacing:8px;text-transform:uppercase;margin:0;font-weight:bold">DESK</p>
  </div>
  <div style="padding:40px 32px;">
    ${htmlBody}
  </div>
  <div style="padding:24px 32px;border-top:1px solid rgba(201,168,76,0.1);text-align:center;">
    <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0 0 8px">The Corporate Desk | 10 Primrose Street, Bowen Hills QLD 4006</p>
    <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0">1300 977 607 | service@thecorporatedesk.com.au | thecorporatedesk.com.au</p>
  </div>
</div>
</body></html>`;

      const recipients = Array.isArray(to) ? to.join(", ") : to;
      await transporter.sendMail({ from: emailFrom, to: recipients, subject, html });

      res.json({ success: true, message: `Email sent to ${recipients}` });
    } catch (error: any) {
      console.error("Email error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  app.post("/api/marketing/telegram", async (req, res) => {
    try {
      const { message, channelId } = req.body;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const channel = channelId || process.env.TELEGRAM_CHANNEL_ID;

      if (!token) return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not configured", missing: ["TELEGRAM_BOT_TOKEN"] });
      if (!channel) return res.status(400).json({ error: "TELEGRAM_CHANNEL_ID not configured", missing: ["TELEGRAM_CHANNEL_ID"] });

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        }),
      });

      const data = await response.json() as any;
      if (!data.ok) throw new Error(data.description || "Telegram API error");

      res.json({ success: true, messageId: data.result?.message_id });
    } catch (error: any) {
      console.error("Telegram error:", error);
      res.status(500).json({ error: error.message || "Failed to post to Telegram" });
    }
  });

  app.post("/api/marketing/facebook", async (req, res) => {
    try {
      const { message, link } = req.body;
      const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const pageId = process.env.FACEBOOK_PAGE_ID;

      if (!token) return res.status(400).json({ error: "FACEBOOK_PAGE_ACCESS_TOKEN not configured", missing: ["FACEBOOK_PAGE_ACCESS_TOKEN"] });
      if (!pageId) return res.status(400).json({ error: "FACEBOOK_PAGE_ID not configured", missing: ["FACEBOOK_PAGE_ID"] });

      const body: Record<string, string> = { message, access_token: token };
      if (link) body.link = link;

      const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;
      if (data.error) throw new Error(data.error.message);

      res.json({ success: true, postId: data.id });
    } catch (error: any) {
      console.error("Facebook error:", error);
      res.status(500).json({ error: error.message || "Failed to post to Facebook" });
    }
  });

  app.post("/api/marketing/instagram", async (req, res) => {
    try {
      const { caption, imageUrl } = req.body;
      const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

      if (!token) return res.status(400).json({ error: "FACEBOOK_PAGE_ACCESS_TOKEN not configured", missing: ["FACEBOOK_PAGE_ACCESS_TOKEN"] });
      if (!igAccountId) return res.status(400).json({ error: "INSTAGRAM_BUSINESS_ACCOUNT_ID not configured", missing: ["INSTAGRAM_BUSINESS_ACCOUNT_ID"] });
      if (!imageUrl) return res.status(400).json({ error: "imageUrl is required for Instagram posts" });

      const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
      });
      const container = await containerRes.json() as any;
      if (container.error) throw new Error(container.error.message);

      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: token }),
      });
      const published = await publishRes.json() as any;
      if (published.error) throw new Error(published.error.message);

      res.json({ success: true, postId: published.id });
    } catch (error: any) {
      console.error("Instagram error:", error);
      res.status(500).json({ error: error.message || "Failed to post to Instagram" });
    }
  });

  app.post("/api/marketing/twitter", async (req, res) => {
    try {
      const { tweets } = req.body;
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

      if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        return res.status(400).json({
          error: "Twitter API credentials not configured",
          missing: ["TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN_SECRET"].filter(k => !process.env[k]),
        });
      }

      const { default: OAuth } = await import("oauth-1.0a");
      const { createHmac } = await import("crypto");

      const oauth = new OAuth({
        consumer: { key: apiKey, secret: apiSecret },
        signature_method: "HMAC-SHA1",
        hash_function(base_string: string, key: string) {
          return createHmac("sha1", key).update(base_string).digest("base64");
        },
      });

      const tweetList = Array.isArray(tweets) ? tweets : [tweets];
      const postedIds: string[] = [];
      let replyToId: string | undefined;

      for (const tweetText of tweetList) {
        const url = "https://api.twitter.com/2/tweets";
        const body: Record<string, any> = { text: tweetText };
        if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

        const token = { key: accessToken, secret: accessTokenSecret };
        const authHeader = oauth.toHeader(oauth.authorize({ url, method: "POST" }, token));

        const response = await fetch(url, {
          method: "POST",
          headers: {
            ...authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json() as any;
        if (data.errors || data.error) {
          throw new Error(data.errors?.[0]?.message || data.error || "Twitter API error");
        }

        replyToId = data.data?.id;
        postedIds.push(replyToId!);
      }

      res.json({ success: true, tweetIds: postedIds });
    } catch (error: any) {
      console.error("Twitter error:", error);
      res.status(500).json({ error: error.message || "Failed to post to X/Twitter" });
    }
  });

  app.post("/api/marketing/whatsapp", async (req, res) => {
    try {
      const { message, to } = req.body;
      const token = process.env.WHATSAPP_API_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!token) return res.status(400).json({ error: "WHATSAPP_API_TOKEN not configured", missing: ["WHATSAPP_API_TOKEN"] });
      if (!phoneNumberId) return res.status(400).json({ error: "WHATSAPP_PHONE_NUMBER_ID not configured", missing: ["WHATSAPP_PHONE_NUMBER_ID"] });
      if (!to) return res.status(400).json({ error: "Recipient phone number (to) is required" });

      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: true, body: message },
        }),
      });

      const data = await response.json() as any;
      if (data.error) throw new Error(data.error.message);

      res.json({ success: true, messageId: data.messages?.[0]?.id });
    } catch (error: any) {
      console.error("WhatsApp error:", error);
      res.status(500).json({ error: error.message || "Failed to send WhatsApp message" });
    }
  });

  app.get("/api/marketing/status", async (req, res) => {
    const channels = {
      email: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID),
      facebook: !!(process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID),
      instagram: !!(process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
      twitter: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
      whatsapp: !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    };
    res.json({ channels });
  });
}
