"use client";

import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { rupees } from "@/lib/format";
import { payLink, reminderMessage, waLink, type Tone } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/types";

type Row = Customer & { due: number };

export default function CustomersPage() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<Tone>("gentle");

  const load = useCallback(async () => {
    const [cust, unpaid] = await Promise.all([
      supabase
        .from("customers")
        .select("id,name,phone,created_at")
        .order("name"),
      supabase.from("entries").select("customer_id,total").eq("paid", false),
    ]);
    if (cust.error || unpaid.error) {
      setError((cust.error ?? unpaid.error)!.message);
      return;
    }
    const dueBy = new Map<string, number>();
    for (const e of unpaid.data ?? []) {
      if (!e.customer_id) continue;
      dueBy.set(e.customer_id, (dueBy.get(e.customer_id) ?? 0) + Number(e.total));
    }
    setRows(
      ((cust.data ?? []) as Customer[]).map((c) => ({
        ...c,
        due: dueBy.get(c.id) ?? 0,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("customers")
      .insert({ name: name.trim(), phone: phone.trim() || null });
    if (error) {
      setError(error.message);
    } else {
      setName("");
      setPhone("");
      await load();
    }
    setBusy(false);
  }

  function remind(c: Row) {
    const business = profile.business_name || "Bhravo";
    const payUrl = profile.upi_id
      ? payLink(window.location.origin, profile.upi_id, business, c.due)
      : null;
    const text = reminderMessage({
      business,
      customer: c.name,
      due: c.due,
      tone,
      english: profile.language === "english",
      payUrl,
    });
    window.open(waLink(c.phone, text), "_blank", "noopener");
  }

  async function markPaid(c: Row) {
    if (!window.confirm(`Mark all of ${c.name}'s ${rupees(c.due)} as paid?`)) return;
    setError(null);
    const { error } = await supabase
      .from("entries")
      .update({ paid: true })
      .eq("customer_id", c.id)
      .eq("paid", false);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-muted">
          Your khata. Each customer&apos;s pending balance shows here.
        </p>
      </div>

      <form
        onSubmit={addCustomer}
        className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Sharma ji)"
          required
          className="rounded-xl border border-line px-4 py-3 outline-none focus:border-saffron"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="WhatsApp number"
          inputMode="tel"
          className="rounded-xl border border-line px-4 py-3 outline-none focus:border-saffron"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-leaf px-6 py-3 font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Adding..." : "Add"}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {rows && rows.some((c) => c.due > 0) && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Reminder tone</span>
          {(["gentle", "firm"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              aria-pressed={tone === t}
              className={`rounded-full border px-4 py-1.5 font-medium capitalize ${
                tone === t ? "border-leaf bg-leaf text-white" : "border-line bg-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {rows === null && !error && <p className="text-muted">Loading...</p>}
      {rows && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No customers yet. Add your first one above.
        </p>
      )}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted">{c.phone || "No number"}</p>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`mr-1 font-medium ${
                    c.due > 0 ? "text-saffron" : "text-leaf"
                  }`}
                >
                  {c.due > 0 ? `${rupees(c.due)} due` : "Clear"}
                </p>
                {c.due > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => remind(c)}
                      className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Remind
                    </button>
                    <button
                      type="button"
                      onClick={() => markPaid(c)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-saffron"
                    >
                      Mark paid
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
