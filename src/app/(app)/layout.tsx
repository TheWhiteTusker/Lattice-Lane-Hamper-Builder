import { requireUser } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <>
      <Nav profile={profile} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>
    </>
  );
}
