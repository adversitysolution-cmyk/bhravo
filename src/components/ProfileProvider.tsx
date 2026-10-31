"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/lib/types";

export type ProfileContextValue = {
  profile: Profile;
  email: string;
  reload: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider = ProfileContext.Provider;

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside the dashboard");
  return ctx;
}
