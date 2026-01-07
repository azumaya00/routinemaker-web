"use client";

import Link from "next/link";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const Header = () => {
  const { status, logout, me } = useAuth();

  useEffect(() => {
    void me();
  }, [me]);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
      <div className="text-sm font-semibold">Routinemaker</div>
      <div className="flex items-center gap-2 text-sm">
        {status === "authenticated" ? (
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1"
            onClick={() => void logout()}
          >
            Logout
          </button>
        ) : (
          <Link className="rounded border border-slate-200 px-3 py-1" href="/login">
            Login
          </Link>
        )}
      </div>
    </header>
  );
};

export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  </AuthProvider>
);
