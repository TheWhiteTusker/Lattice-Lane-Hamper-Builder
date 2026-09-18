import { requireUser } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <>
      {/* LATTICE_DESKTOP is set by electron/main.cjs: no download button inside the app itself. */}
      <Nav profile={profile} desktop={process.env.LATTICE_DESKTOP === "1"} />
      <main id="top" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        {children}
      </main>
      <a href="#top" className="scroll-top no-print" aria-label="Scroll to top">
        <svg
          className="h-[25px] w-[25px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5" />
          <path d="M6.5 10.5 12 5l5.5 5.5" />
        </svg>
      </a>
    </>
  );
}
