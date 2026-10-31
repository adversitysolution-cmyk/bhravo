"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { rupees } from "@/lib/format";
import { billMessage, payLink, spokenSummary, waLink } from "@/lib/share";
import { SPEECH_LANG, speak } from "@/lib/speech";
import { supabase } from "@/lib/supabase";

// amount is what the line costs in total, the way people say it aloud.
type Item = { name: string; qty: number; unit: string; amount: number | null };
type Kind = "bill" | "receipt" | "quote" | "note" | "trip";

const DEFAULT_KIND: Record<string, Kind> = {
  shopkeeper: "bill",
  doctor: "receipt",
  tailor: "bill",
  teacher: "receipt",
  driver: "trip",
  painter: "quote",
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
  const [known, setKnown] = useState<
    { id: string; name: string; phone: string | null }[]
  >([]);
  const [lastSaved, setLastSaved] = useState<{
    customer: string | null;
    phone: string | null;
    kind: Kind;
    items: { name: string; qty: number; unit: string; price: number; amount: number }[];
    total: number;
    paid: boolean;
  } | null>(null);

  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const [flowHint, setFlowHint] = useState(false);

  // Catch text that a dictation tool put in the box without an input event.
  useEffect(() => {
    if (stage !== "input") return;
    const id = window.setInterval(() => {
      const v = boxRef.current?.value;
      if (v !== undefined && v !== textRef.current) setText(v);
    }, 400);
    return () => window.clearInterval(id);
  }, [stage]);

  const recRef = useRef<Recognition | null>(null);
  const canListen = getRecognition() !== null;

  useEffect(() => {
    supabase
      .from("customers")
      .select("id,name,phone")
      .then(({ data }) =>
        setKnown((data ?? []) as { id: string; name: string; phone: string | null }[]),
      );
  }, [savedNote]);

  function shareOnWhatsApp(s: NonNullable<typeof lastSaved>) {
    const payUrl =
      profile.upi_id && !s.paid && s.total > 0
        ? payLink(window.location.origin, profile.upi_id, profile.business_name ?? "", s.total)
        : null;
    const message = billMessage({
      business: profile.business_name || "Bhravo",
      customer: s.customer,
      kind: s.kind,
      items: s.items,
      total: s.total,
      paid: s.paid,
      payUrl,
    });
    window.open(waLink(s.phone, message), "_blank", "noopener");
  }

  function readAloud(customer: string | null, list: Item[], sum: number, isPaid: boolean) {
    const ok = speak(
      spokenSummary({
        customer,
        items: list.map((i) => ({
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          price: null,
          amount: i.amount,
        })),
        total: sum,
        paid: isPaid,
      }),
      profile.language,
    );
    if (!ok) setError("This browser cannot read aloud.");
  }

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

  // `value` is read straight from the box, because dictation tools such as
  // Wispr Flow can change it without React seeing an input event.
  async function makeBill(value: string = text) {
    if (!value.trim()) return;
    setText(value);
    setError(null);
    setSavedNote(null);
    setLastSaved(null);
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
        body: JSON.stringify({ text: value, trade }),
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
          amount:
            i.price === null ? null : Math.round(i.price * i.qty * 100) / 100,
        })),
      );
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("input");
    }
  }

  const itemsSum = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const hasOverride = manualTotal !== null || statedTotal !== null;
  const total =
    manualTotal !== null ? Number(manualTotal) || 0 : (statedTotal ?? itemsSum);
  const missingPrice = items.some((i) => i.amount === null) && !hasOverride;
  // The speaker said a total that disagrees with the items they priced.
  const totalMismatch =
    statedTotal !== null &&
    manualTotal === null &&
    items.length > 0 &&
    items.every((i) => i.amount !== null) &&
    Math.abs(itemsSum - statedTotal) > 0.5;

  const update = useCallback((idx: number, patch: Partial<Item>) => {
    // Editing an amount means the total should follow the items again.
    if ("amount" in patch) {
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

    // Store both the line amount and the per-unit rate derived from it.
    const priced = items.map((i) => {
      const amount = i.amount ?? 0;
      return {
        name: i.name,
        qty: i.qty,
        unit: i.unit,
        amount,
        price: i.qty > 0 ? Math.round((amount / i.qty) * 10000) / 10000 : 0,
      };
    });

    let customerId: string | null = null;
    let customerPhone: string | null = null;
    const name = customerName.trim();
    if (name) {
      const match = known.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (match) {
        customerId = match.id;
        customerPhone = match.phone;
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
      items: priced,
      total,
      paid,
      raw_transcript: text,
    });
    if (error) {
      setError(error.message);
      setStage("review");
      return;
    }

    setLastSaved({
      customer: name || null,
      phone: customerPhone,
      kind,
      items: priced,
      total,
      paid,
    });
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
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem_5rem_auto] gap-2 text-xs font-medium text-muted">
            <span>Item</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Amount ₹</span>
            <span className="w-6" />
          </div>
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
                value={it.amount ?? ""}
                onChange={(e) =>
                  update(idx, { amount: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder="₹ amount"
                aria-label="Amount for this item in rupees"
                className={`${inputClass} ${it.amount === null ? "border-saffron" : ""}`}
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
            onClick={() => setItems((prev) => [...prev, { name: "", qty: 1, unit: "", amount: null }])}
            className="self-start text-sm font-medium text-leaf underline"
          >
            + Add item
          </button>
        </div>

        {missingPrice && (
          <p className="mt-3 text-xs text-saffron">
            Some items have no amount. Fill them in so the total is right.
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
          <button
            type="button"
            onClick={() => readAloud(customerName.trim() || null, items, total, paid)}
            className="rounded-full border border-line px-6 py-3 font-medium hover:border-saffron"
          >
            🔊 Read aloud
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

      <button
        type="button"
        onClick={() => {
          boxRef.current?.focus();
          setFlowHint(true);
        }}
        className="rounded-full border border-line px-5 py-2 text-sm font-medium hover:border-saffron"
      >
        Dictate with Wispr Flow
      </button>
      {flowHint && (
        <p className="text-xs text-leaf">
          The box below is ready. Start Flow with your shortcut and speak. Your words appear here, then press
          Ctrl or Cmd + Enter to make the entry.
        </p>
      )}

      <textarea
        ref={boxRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && stage === "input") {
            e.preventDefault();
            void makeBill(e.currentTarget.value);
          }
        }}
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
      {lastSaved && (
        <div className="flex w-full flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => shareOnWhatsApp(lastSaved)}
            className="rounded-full bg-[#25D366] px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Send on WhatsApp
          </button>
          <button
            type="button"
            onClick={() =>
              readAloud(
                lastSaved.customer,
                lastSaved.items,
                lastSaved.total,
                lastSaved.paid,
              )
            }
            className="rounded-full border border-line px-6 py-3 font-medium hover:border-saffron"
          >
            🔊 Read aloud
          </button>
          {!lastSaved.phone && lastSaved.customer && (
            <p className="w-full text-xs text-muted">
              No number saved for {lastSaved.customer}. WhatsApp will ask you to pick a contact. Add the number in Customers to skip that.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => void makeBill(boxRef.current?.value ?? text)}
        disabled={!text.trim() || stage === "parsing"}
        className="rounded-full bg-leaf px-8 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {stage === "parsing" ? "Reading..." : "Make entry"}
      </button>
    </section>
  );
}
