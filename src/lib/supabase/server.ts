import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Profile, UserRole } from "@/lib/types";
import { supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** Current user + profile, or a redirect to /login. Use in every page. */
export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Auth row exists but the profile trigger has not caught up yet.
  if (!profile) redirect("/login?error=no-profile");

  return { supabase, profile };
}

/**
 * Gate a page on role. The database enforces this too (see 0002_rls.sql);
 * this only spares the user a confusing permission error.
 */
export async function requireRole(...roles: UserRole[]) {
  const ctx = await requireUser();
  if (!roles.includes(ctx.profile.role)) redirect("/?error=forbidden");
  return ctx;
}

export const canManage = (role: UserRole) => role === "admin" || role === "manager";
export const isAdmin = (role: UserRole) => role === "admin";
