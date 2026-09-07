"use client";

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

  // The storefront logo is white artwork on transparency, so it needs the sage
  // header behind it — same pairing the site uses.
  return (
    <header className="no-print bg-[var(--color-brand)]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="Lattice Lane — dashboard" className="shrink-0">
          <Image
            src="/lattice-lane-logo.png"
            alt="Lattice Lane"
            width={600}
            height={115}
            priority
            className="h-6 w-auto"
          />
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-[var(--color-paper)] font-medium text-[var(--color-brand-dark)]"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
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
