"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { rupees } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Item = { name: string; qty: number; unit: string; price: number | null };
type Kind = "bill" | "receipt" | "quote" | "note" | "trip";

const DEFAULT_KIND: Record<string, Kind> = {
  shopkeeper: "bill",
  doctor: "receipt",
  tailor: "bill",
  teacher: "receipt",
  driver: "trip",
  painter: "quote",
};

const SPEECH_LANG: Record<string, string> = {
  hinglish: "hi-IN",
  hindi: "hi-IN",
  english: "en-IN",
  kannada: "kn-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  marathi: "mr-IN",
};

const EXAMPLES: Record<string, string> = {
  shopkeeper: "Sharma ji ko do kilo chawal, ek kilo dal, udhaar mein likh do",
  doctor: "Ravi ko bukhar, paracetamol teen din, fees 300 rupaye, cash diya",
  tailor: "Meena madam ka blouse stitching 800 rupaye, advance 300",
  teacher: "Aarav ki fees 1500 rupaye baaki hai",
  driver: "Airport trip 850 rupaye, cash",
  painter: "Gupta ji ka flat, teen kamre painting, 18000 rupaye",
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function VoiceEntry({ onSaved }: { onSaved: () => void }) {
  const { profile } = useProfile();
  const trade = profile.trade ?? "shopkeeper";

  const [stage, setStage] = useState<"input" | "parsing" | "review" | "saving">("input");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [paid, setPaid] = useState(false);
  const [statedTotal, setStatedTotal] = useState<number | null>(null);
  const [manualTotal, setManualTotal] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(DEFAULT_KIND[trade] ?? "bill");
  const [known, setKnown] = useState<{ id: string; name: string }[]>([]);

  const recRef = useRef<Recognition | null>(null);
  const canListen = getRecognition() !== null;

  useEffect(() => {
    supabase
      .from("customers")
      .select("id,name")
      .then(({ data }) => setKnown((data ?? []) as { id: string; name: string }[]));
  }, [savedNote]);

  // The browser ends a session on silence or after about a minute. We keep
  // listening until the user taps stop, by starting a fresh session each time.
  const wantListening = useRef(false);
  const textRef = useRef("");
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const stopListening = useCallback(() => {
    wantListening.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => stopListening, [stopListening]);

  const startSession = useCallback(() => {
    const Rec = getRecognition();
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = SPEECH_LANG[profile.language] ?? "hi-IN";
    rec.interimResults = true;
    rec.continuous = true;
    const base = textRef.current.trim();
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      setText(base ? `${base} ${spoken}` : spoken);
    };
    rec.onerror = (e) => {
      // Silence and aborted sessions are normal: onend restarts them.
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantListening.current = false;
      setListening(false);
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone is blocked. Allow it in your browser, or type instead."
          : "Lost the connection to the microphone. Tap to try again, or type.",
      );
    };
    rec.onend = () => {
      if (!wantListening.current) {
        setListening(false);
        return;
      }
      // Give the last words a moment to land in state, then continue.
      setTimeout(() => {
        if (wantListening.current) startSession();
      }, 200);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() throws if a session is already running; onend will retry.
    }
  }, [profile.language]);

  function toggleMic() {
    setError(null);
    if (listening) {
      stopListening();
      return;
    }
    if (!getRecognition()) {
      setError("This browser cannot listen. Type here, or dictate with Wispr Flow.");
      return;
    }
    wantListening.current = true;
    setListening(true);
    startSession();
  }

  async function makeBill() {
    setError(null);
    setSavedNote(null);
    stopListening();
    setStage("parsing");

    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) {
      setError("You are logged out. Please log in again.");
      setStage("input");
      return;
    }

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, trade }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      if (!body.items?.length) throw new Error("I could not find any items. Try saying it again.");

      setCustomerName(body.customer_name ?? "");
      setPaid(body.paid === true);
      setStatedTotal(typeof body.total === "number" ? body.total : null);
      setManualTotal(null);
      setKind(DEFAULT_KIND[trade] ?? "bill");
      setItems(
        body.items.map((i: { name: string; qty: number; unit: string | null; price: number | null }) => ({
          name: i.name,
          qty: i.qty,
          unit: i.unit ?? "",
          price: i.price,
        })),
      );
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("input");
    }
  }

  const itemsSum = items.reduce((sum, i) => sum + i.qty * (i.price ?? 0), 0);
  const hasOverride = manualTotal !== null || statedTotal !== null;
  const total =
    manualTotal !== null ? Number(manualTotal) || 0 : (statedTotal ?? itemsSum);
  const missingPrice = items.some((i) => i.price === null) && !hasOverride;
  // The speaker said a total that disagrees with the items they priced.
  const totalMismatch =
    statedTotal !== null &&
    manualTotal === null &&
    items.length > 0 &&
    items.every((i) => i.price !== null) &&
    Math.abs(itemsSum - statedTotal) > 0.5;

  const update = useCallback((idx: number, patch: Partial<Item>) => {
    // Editing a rate or quantity means the total should follow the items again.
    if ("price" in patch || "qty" in patch) {
      setStatedTotal(null);
      setManualTotal(null);
    }
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);

  async function save() {
    setError(null);
    if (!items.length) {
      setError("Add at least one item.");
      return;
    }
    setStage("saving");

    let customerId: string | null = null;
    const name = customerName.trim();
    if (name) {
      const match = known.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (match) {
        customerId = match.id;
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({ name })
          .select("id")
          .single();
        if (error) {
          setError(error.message);
          setStage("review");
          return;
        }
        customerId = data.id as string;
      }
    }

    const { error } = await supabase.from("entries").insert({
      customer_id: customerId,
      kind,
      items: items.map((i) => ({ ...i, price: i.price ?? 0 })),
      total,
      paid,
      raw_transcript: text,
    });
    if (error) {
      setError(error.message);
      setStage("review");
      return;
    }

    setSavedNote(`Saved: ${rupees(total)}${name ? ` for ${name}` : ""}.`);
    setText("");
    setItems([]);
    setCustomerName("");
    setStatedTotal(null);
    setManualTotal(null);
    setStage("input");
    onSaved();
  }

  const inputClass =
    "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-saffron";

  if (stage === "review" || stage === "saving") {
    return (
      <section className="rounded-3xl border border-line bg-white p-6">
        <h2 className="font-serif text-2xl">Check and save</h2>
        <p className="mt-1 text-sm text-muted">&ldquo;{text}&rdquo;</p>

        <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium">
          Customer
          <input
            list="known-customers"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Walk-in (leave empty)"
            className={inputClass}
          />
          <datalist id="known-customers">
            {known.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>

        <div className="mt-5 flex flex-col gap-3">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_4.5rem_4.5rem_5rem_auto] items-center gap-2">
              <input
                value={it.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                aria-label="Item"
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                step="any"
                value={it.qty}
                onChange={(e) => update(idx, { qty: Number(e.target.value) })}
                aria-label="Quantity"
                className={inputClass}
              />
              <input
                value={it.unit}
                onChange={(e) => update(idx, { unit: e.target.value })}
                placeholder="unit"
                aria-label="Unit"
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                step="any"
                value={it.price ?? ""}
                onChange={(e) =>
                  update(idx, { price: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder="₹ rate"
                aria-label="Rate in rupees"
                className={`${inputClass} ${it.price === null ? "border-saffron" : ""}`}
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                aria-label="Remove item"
                className="px-2 text-lg text-muted hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { name: "", qty: 1, unit: "", price: null }])}
            className="self-start text-sm font-medium text-leaf underline"
          >
            + Add item
          </button>
        </div>

        {missingPrice && (
          <p className="mt-3 text-xs text-saffron">
            Some items have no rate. Fill them in so the total is right.
          </p>
        )}
        {totalMismatch && (
          <p className="mt-3 rounded-lg bg-saffron-soft px-3 py-2 text-xs">
            The items add up to {rupees(itemsSum)}, but you said {rupees(statedTotal ?? 0)}.{" "}
            <button
              type="button"
              onClick={() => setStatedTotal(null)}
              className="font-medium text-leaf underline"
            >
              Use {rupees(itemsSum)}
            </button>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {[
              { v: false, l: "Udhaar" },
              { v: true, l: "Paid" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setPaid(o.v)}
                aria-pressed={paid === o.v}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  paid === o.v ? "border-leaf bg-leaf text-white" : "border-line bg-white"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            aria-label="Type"
            className={inputClass}
          >
            <option value="bill">Bill</option>
            <option value="receipt">Receipt</option>
            <option value="quote">Quote</option>
            <option value="note">Note</option>
            <option value="trip">Trip</option>
          </select>
          <label className="flex items-center gap-2 font-serif text-2xl">
            ₹
            <input
              type="number"
              min="0"
              step="any"
              value={total}
              onChange={(e) => setManualTotal(e.target.value)}
              aria-label="Total in rupees"
              className="w-28 rounded-lg border border-line bg-white px-3 py-1 text-right text-2xl outline-none focus:border-saffron"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={stage === "saving"}
            className="rounded-full bg-leaf px-6 py-3 font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {stage === "saving" ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setStage("input")}
            disabled={stage === "saving"}
            className="rounded-full border border-line px-6 py-3 font-medium hover:border-saffron"
          >
            Back
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-white px-6 py-8 text-center">
      <button
        type="button"
        onClick={toggleMic}
        aria-label={listening ? "Stop listening" : "Start speaking"}
        className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl text-white shadow-lg transition-transform ${
          listening ? "animate-pulse bg-red-500" : "bg-saffron hover:scale-105"
        }`}
      >
        {listening ? "■" : "🎤"}
      </button>
      <p className="text-sm text-muted">
        {listening
          ? "Listening... take your time, pause as long as you need. Tap the square to stop."
          : canListen
            ? "Tap and speak, or type below. Wispr Flow dictation works here too."
            : "Type below, or dictate with Wispr Flow."}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={`Try: ${EXAMPLES[trade] ?? EXAMPLES.shopkeeper}`}
        className="w-full resize-none rounded-2xl border border-line bg-background px-4 py-3 text-base outline-none focus:border-saffron"
      />

      {error && (
        <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {savedNote && (
        <p className="w-full rounded-lg bg-leaf-soft px-3 py-2 text-sm text-leaf">{savedNote}</p>
      )}

      <button
        type="button"
        onClick={makeBill}
        disabled={!text.trim() || stage === "parsing"}
        className="rounded-full bg-leaf px-8 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {stage === "parsing" ? "Reading..." : "Make entry"}
      </button>
    </section>
  );
}
