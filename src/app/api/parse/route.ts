import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPT = `You read short spoken sentences from Indian small-business owners (shopkeepers, doctors, tailors, teachers, drivers, painters). The speech may be Hindi, English, Hinglish or another Indian language, written in any script.

Return JSON only, with:
- customer_name: the customer, patient, parent or client named, or null if none is named. Keep honorifics like "ji" out of the name only if they are clearly separate words; "Sharma ji" stays "Sharma ji".
- paid: true if the speech says it was paid in cash/UPI/"de diya"/"paid"; false if it says udhaar/baaki/"likh do"/credit; null if not stated.
- items: every thing sold, done or charged. Each item has name, qty (number, default 1), unit (kg, g, litre, piece, dozen, hour, trip, etc., or null) and price.

Rules for price:
- price is the rate PER UNIT in rupees. If the speaker gives a total for the line (for example "chawal 200 rupaye" for 2 kilo), divide by qty.
- If no price is spoken for an item, price is null. Never invent or guess a price.
- Fees and charges ("fees 300", "visit charge 500", "stitching 800") become their own item with qty 1.
- Convert number words in any language to digits (do=2, teen=3, paanch=5, sau=100, dedh=1.5, dhai=2.5).
- Write item names in simple English where obvious (chawal -> Rice, dal -> Dal), otherwise keep the spoken word.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    customer_name: { type: ["string", "null"] },
    paid: { type: ["boolean", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          qty: { type: "number" },
          unit: { type: ["string", "null"] },
          price: { type: ["number", "null"] },
        },
        required: ["name", "qty"],
      },
    },
  },
  required: ["items"],
};

// Tried in order; Google retires model names often, so keep a fallback.
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

type InteractionStep = {
  type?: string;
  content?: { type?: string; text?: string }[];
};

async function askGemini(
  apiKey: string,
  models: string[],
  input: string,
): Promise<{ text: string } | { status: number }> {
  let lastStatus = 502;
  for (const model of models) {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          store: false,
          system_instruction: SYSTEM_PROMPT,
          input,
          generation_config: { temperature: 0 },
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: RESPONSE_SCHEMA,
          },
        }),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { steps?: InteractionStep[] };
      const text = (data.steps ?? [])
        .filter((s) => s.type === "model_output")
        .flatMap((s) => s.content ?? [])
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("");
      if (text) return { text };
    }
    lastStatus = res.status;
    // Try the next model on "gone" or "busy"; stop on real client errors.
    if (![404, 429, 500, 502, 503, 504].includes(res.status) && !res.ok) break;
  }
  return { status: lastStatus };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL?.trim();

  if (!supaUrl || !supaAnon) {
    return json({ error: "Server is missing Supabase settings." }, 500);
  }

  // Only logged-in users may spend the AI key.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please log in again." }, 401);
  const { data: auth, error: authError } = await createClient(
    supaUrl,
    supaAnon,
  ).auth.getUser(token);
  if (authError || !auth.user) {
    return json({ error: "Please log in again." }, 401);
  }

  if (!geminiKey) {
    return json(
      { error: "The AI key is not set up yet. Add GEMINI_API_KEY." },
      503,
    );
  }

  let body: { text?: unknown; trade?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "Nothing to read. Speak or type first." }, 400);
  if (text.length > 1500) return json({ error: "That is too long." }, 400);
  const trade = typeof body.trade === "string" ? body.trade : "shopkeeper";

  const answer = await askGemini(
    geminiKey,
    [...(model ? [model] : []), ...FALLBACK_MODELS],
    `Business type: ${trade}\nSpeech: ${text}`,
  );

  if ("status" in answer) {
    console.error("Gemini request failed with status", answer.status);
    const detail =
      answer.status === 429
        ? "Too many requests. Try again in a minute."
        : answer.status === 401 || answer.status === 403
          ? "The AI key was rejected. Check GEMINI_API_KEY."
          : "The AI could not read that. Try again.";
    return json({ error: detail }, 502);
  }
  const raw = answer.text;

  let parsed: {
    customer_name?: string | null;
    paid?: boolean | null;
    items?: { name?: string; qty?: number; unit?: string | null; price?: number | null }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "The AI reply was not readable. Try again." }, 502);
  }

  const items = (parsed.items ?? [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name!.trim(),
      qty: Number.isFinite(i.qty) && (i.qty as number) > 0 ? (i.qty as number) : 1,
      unit: i.unit?.trim() || null,
      price:
        typeof i.price === "number" && Number.isFinite(i.price) && i.price >= 0
          ? i.price
          : null,
    }));

  return json({
    customer_name: parsed.customer_name?.trim() || null,
    paid: typeof parsed.paid === "boolean" ? parsed.paid : null,
    items,
  });
}
