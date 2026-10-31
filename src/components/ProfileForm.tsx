"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { LANGUAGES, TRADES, type TradeId } from "@/lib/trades";
import type { Profile } from "@/lib/types";

const UPI_PATTERN = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;

type Props = {
  initial: Pick<Profile, "business_name" | "trade" | "language" | "upi_id">;
  submitLabel: string;
  onSaved: () => void | Promise<void>;
};

export default function ProfileForm({ initial, submitLabel, onSaved }: Props) {
  const [trade, setTrade] = useState<TradeId | null>(initial.trade);
  const [businessName, setBusinessName] = useState(initial.business_name ?? "");
  const [language, setLanguage] = useState(initial.language || "hinglish");
  const [upi, setUpi] = useState(initial.upi_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!trade) {
      setError("Please choose what kind of business you run.");
      return;
    }
    const upiValue = upi.trim();
    if (upiValue && !UPI_PATTERN.test(upiValue)) {
      setError("That UPI ID does not look right. Example: name@okaxis");
      return;
    }

    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      setError("You are logged out. Please log in again.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      trade,
      business_name: businessName.trim() || null,
      language,
      upi_id: upiValue || null,
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await onSaved();
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-medium">Your business</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TRADES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrade(t.id)}
              aria-pressed={trade === t.id}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                trade === t.id
                  ? "border-saffron bg-saffron-soft"
                  : "border-line bg-white hover:border-saffron"
              }`}
            >
              <span className="block font-serif text-lg">{t.name}</span>
              <span className="mt-1 block text-xs text-muted">{t.line}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Business name
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Sharma General Store"
          className="rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-saffron"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Language you speak
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-saffron"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        UPI ID (optional)
        <input
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="name@okaxis"
          autoCapitalize="none"
          className="rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-saffron"
        />
        <span className="text-xs font-normal text-muted">
          Bills will carry a pay link to this UPI ID.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-leaf px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
