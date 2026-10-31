"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfileProvider } from "@/components/ProfileProvider";
import { supabase } from "@/lib/supabase";
import { TRADES } from "@/lib/trades";
import type { Profile } from "@/lib/types";

const TABS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      router.replace("/login");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id,business_name,trade,language,upi_id")
      .eq("id", s.session.user.id)
      .maybeSingle();
    if (error) {
      setError(error.message);
      return;
    }
    const row = data as Profile | null;
    if (!row || !row.trade) {
      router.replace("/setup");
      return;
    }
    setEmail(s.session.user.email ?? "");
    setProfile(row);
  }, [router]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [load, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md flex-1 px-6 py-16">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}. If this mentions a missing table, run supabase/schema.sql in
          the Supabase SQL editor.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  const tradeName = TRADES.find((t) => t.id === profile.trade)?.name;

  return (
    <ProfileProvider value={{ profile, email, reload: load }}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="font-serif text-2xl font-semibold text-leaf">
              Bhravo
            </span>
            <p className="truncate text-sm text-muted">
              {profile.business_name || "Your business"}
              {tradeName ? ` · ${tradeName}` : ""}
            </p>
          </div>
          <button
            onClick={signOut}
            className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:border-saffron"
          >
            Log out
          </button>
        </header>

        <nav className="mt-6 flex gap-2 border-b border-line pb-3">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  active
                    ? "bg-leaf text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 py-8">{children}</main>
      </div>
    </ProfileProvider>
  );
}
