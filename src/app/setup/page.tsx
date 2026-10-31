"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProfileForm from "@/components/ProfileForm";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export default function SetupPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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
      setProfile(
        (data as Profile | null) ?? {
          id: s.session.user.id,
          business_name: null,
          trade: null,
          language: "hinglish",
          upi_id: null,
        },
      );
    })();
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <span className="font-serif text-2xl font-semibold text-leaf">Bhravo</span>
      <h1 className="mt-8 font-serif text-4xl leading-tight">
        Set up your <span className="italic text-saffron">dukaan</span>
      </h1>
      <p className="mt-2 text-muted">
        One minute, once. This decides your templates and the language you
        speak.
      </p>

      <div className="mt-8">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}. If this mentions a missing table, run supabase/schema.sql
            in the Supabase SQL editor.
          </p>
        )}
        {!profile && !error && <p className="text-muted">Loading...</p>}
        {profile && (
          <ProfileForm
            initial={profile}
            submitLabel="Continue to dashboard"
            onSaved={() => router.replace("/dashboard")}
          />
        )}
      </div>
    </div>
  );
}
