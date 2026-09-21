"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
};

export function Nav({ profile, desktop }: { profile: Profile; desktop: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [isDesktopClient, setIsDesktopClient] = useState(desktop);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { electron?: { isDesktop?: boolean } }).electron?.isDesktop) {
      setIsDesktopClient(true);
    }
  }, []);

  async function checkUpdates() {
    setCheckingUpdate(true);
    try {
      if (typeof window !== "undefined" && (window as unknown as { electron?: { checkForUpdates?: () => Promise<void> } }).electron?.checkForUpdates) {
        await (window as unknown as { electron: { checkForUpdates: () => Promise<void> } }).electron.checkForUpdates();
      } else {
        const res = await fetch("/updates/latest.json", { cache: "no-store" });
        if (res.ok) {
          const { version } = await res.json();
          alert(`Latest available desktop version is v${version}`);
        } else {
          alert("Could not reach update server.");
        }
      }
    } catch {
      alert("Update check failed. Please check your internet connection.");
    } finally {
      setCheckingUpdate(false);
    }
  }

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/hampers", label: "Hampers" },
    { href: "/presentations", label: "Presentations" },
    { href: "/quotes", label: "Quotes" },
    { href: "/clients", label: "Clients" },
    { href: "/products", label: "Products" },
    { href: "/cost-calculator", label: "Cost Calculator" },
    ...(profile.role === "admin" ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // The header lockup is white artwork on transparency, so it needs the sage
  // bar behind it — same pairing the storefront uses.
  return (
    <header className="no-print bg-[var(--color-brand)]">
      <div className="flex items-center gap-6 whitespace-nowrap px-6 py-3">
        <Link href="/" aria-label="Lattice Lane — dashboard" className="shrink-0">
          <Image
            src="/lattice-lane-logo.png"
            alt="Lattice Lane"
            width={1768}
            height={203}
            priority
            className="h-7 w-auto"
          />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-[var(--color-paper)] font-medium text-[var(--color-brand-dark)]"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 text-sm">
          {!isDesktopClient ? (
            // Plain <a>: a file download, not a page for the router to prefetch.
            <a
              href="/updates/Lattice-Lane-Setup.exe"
              className="btn rounded-full border border-white/30 text-white hover:bg-white/10"
            >
              Download app
            </a>
          ) : (
            <button
              type="button"
              onClick={checkUpdates}
              disabled={checkingUpdate}
              className="btn rounded-full border border-white/30 text-white hover:bg-white/10 text-xs px-3 py-1 flex items-center gap-1.5"
            >
              <svg
                className={`h-3.5 w-3.5 ${checkingUpdate ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {checkingUpdate ? "Checking…" : "Check for updates"}
            </button>
          )}
          <span className="text-white/75">
            {profile.full_name || "Account"}
            <span className="ml-2 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white">
              {ROLE_LABEL[profile.role]}
            </span>
          </span>
          <button
            type="button"
            onClick={signOut}
            className="btn rounded-full border border-white/30 text-white hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
