"use client";

import { useState } from "react";
import ProfileForm from "@/components/ProfileForm";
import { useProfile } from "@/components/ProfileProvider";

export default function SettingsPage() {
  const { profile, email, reload } = useProfile();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {email}</p>
      </div>

      {saved && (
        <p className="rounded-lg bg-leaf-soft px-3 py-2 text-sm text-leaf">
          Saved.
        </p>
      )}

      <ProfileForm
        initial={profile}
        submitLabel="Save changes"
        onSaved={async () => {
          await reload();
          setSaved(true);
        }}
      />
    </div>
  );
}
