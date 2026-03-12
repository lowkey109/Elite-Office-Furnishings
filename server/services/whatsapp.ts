import https from "https";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppTextPayload {
  to: string;
  message: string;
}

function validateWhatsAppNumber(number: string): boolean {
  return /^\+\d{10,15}$/.test(number.replace(/\s/g, ""));
}

export async function sendWhatsAppTextMessage(
  to: string,
  message: string
): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return {
      success: false,
      error: "WhatsApp not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID environment variables.",
    };
  }

  const cleanNumber = to.replace(/\s/g, "");
  if (!validateWhatsAppNumber(cleanNumber)) {
    return {
      success: false,
      error: `Invalid WhatsApp number format: ${to}. Must be in international format e.g. +8613392798732`,
    };
  }

  const recipientNumber = cleanNumber.startsWith("+") ? cleanNumber.slice(1) : cleanNumber;

  const payload = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientNumber,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "graph.facebook.com",
      path: `/v18.0/${phoneNumberId}/messages`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200 && parsed.messages?.[0]?.id) {
            resolve({ success: true, messageId: parsed.messages[0].id });
          } else {
            const errMsg = parsed.error?.message || parsed.error?.error_data?.details || `API error ${res.statusCode}`;
            resolve({ success: false, error: errMsg });
          }
        } catch {
          resolve({ success: false, error: `Failed to parse API response: ${data}` });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
