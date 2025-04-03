'use client';

import { SessionProvider } from "next-auth/react";

// This component is intentionally empty as we're using server-side NextAuth.js
// and don't need the client-side SessionProvider
export function AuthProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
