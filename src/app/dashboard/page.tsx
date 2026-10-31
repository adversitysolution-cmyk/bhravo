"use client";

import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import VoiceEntry from "@/components/VoiceEntry";
import { isToday, rupees, shortDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { EntryRow } from "@/lib/types";

export default function DashboardHome() {
  const { profile } = useProfile();
  const [entries, setEntries] = useState<EntryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("entries")
      .select("id,kind,total,paid,created_at,customer_id,customers(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setError(error.message);
      return;
    }
    setEntries((data ?? []) as unknown as EntryRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = (entries ?? []).filter((e) => isToday(e.created_at));
  const todayTotal = today.reduce((sum, e) => sum + Number(e.total), 0);
  const dues = (entries ?? [])
    .filter((e) => !e.paid)
    .reduce((sum, e) => sum + Number(e.total), 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl">
        {profile.business_name ? `Namaste, ${profile.business_name}` : "Namaste"}
      </h1>

      <VoiceEntry onSaved={load} />

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Today" value={rupees(todayTotal)} />
        <Stat label="Dues pending" value={rupees(dues)} />
        <Stat label="Entries today" value={String(today.length)} />
      </section>

      <section>
        <h2 className="font-serif text-xl">Recent entries</h2>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {!error && entries === null && (
          <p className="mt-3 text-muted">Loading...</p>
        )}
        {entries && entries.length === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            No entries yet. Your first spoken bill will show up here.
          </p>
        )}
        {entries && entries.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {entries.slice(0, 10).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {e.customers?.name ?? "Walk-in"}
                  </p>
                  <p className="text-xs capitalize text-muted">
                    {e.kind} · {shortDate(e.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">{rupees(Number(e.total))}</p>
                  <p
                    className={`text-xs ${e.paid ? "text-leaf" : "text-saffron"}`}
                  >
                    {e.paid ? "Paid" : "Udhaar"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </div>
  );
}
