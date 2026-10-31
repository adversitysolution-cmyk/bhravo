"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!email) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="font-serif text-2xl font-semibold text-leaf">
          Bhravo
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted sm:inline">{email}</span>
          <button
            onClick={signOut}
            className="rounded-full border border-line bg-white px-4 py-2 font-medium hover:border-saffron"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <button
          disabled
          aria-label="Speak (coming soon)"
          className="flex h-28 w-28 items-center justify-center rounded-full bg-saffron text-5xl text-white shadow-lg opacity-80"
        >
          🎤
        </button>
        <h1 className="font-serif text-3xl">Your dashboard is ready</h1>
        <p className="max-w-sm text-muted">
          Voice billing, khata and reminders are coming next. You are logged in
          and your data stays private to you.
        </p>
      </main>
    </div>
  );
}
