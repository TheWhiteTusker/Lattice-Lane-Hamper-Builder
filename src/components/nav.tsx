"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
};

export function Nav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/hampers", label: "Hampers" },
    { href: "/quotes", label: "Quotes" },
    { href: "/products", label: "Products" },
    ...(profile.role === "admin" ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="no-print border-b border-[var(--color-line)] bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <Link href="/" className="font-semibold tracking-tight">
          Lattice&nbsp;Lane
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand-dark)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-paper)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--color-muted)]">
            {profile.full_name || "Account"}
            <span className="badge ml-2">{ROLE_LABEL[profile.role]}</span>
          </span>
          <button type="button" onClick={signOut} className="btn-secondary">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
