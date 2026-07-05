/** Auth + session store (Zustand, persisted to localStorage). Holds the JWT, user, org, capabilities. */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse, SessionUser, OrganizationDTO, Capabilities, Locale } from "@shopmaster/shared";

interface AuthState {
  token: string | null;
  user: SessionUser | null;
  organization: OrganizationDTO | null;
  capabilities: Capabilities | null;
  locale: Locale;
  deviceId: string | null;
  setSession: (r: AuthResponse & { device?: { id: string } }) => void;
  setLocale: (l: Locale) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      organization: null,
      capabilities: null,
      locale: "en",
      deviceId: null,
      setSession: (r) =>
        set({
          token: r.token,
          user: r.user,
          organization: r.organization,
          capabilities: r.capabilities,
          locale: r.organization.locale,
          deviceId: r.device?.id ?? null,
        }),
      setLocale: (locale) => set({ locale }),
      logout: () => set({ token: null, user: null, organization: null, capabilities: null }),
    }),
    { name: "shopmaster-auth" },
  ),
);
