/**
 * NEXT_PUBLIC_* values are inlined by the compiler at BUILD time, not read at
 * runtime. If they are absent when the build runs, they are baked in as
 * undefined and every request fails — setting them on the deployed service
 * afterwards changes nothing without a rebuild.
 *
 * Passing undefined into createServerClient throws "supabaseUrl is required",
 * which surfaces as a bare 500 on every route and says nothing about the
 * cause. This turns that into a message naming the missing variable.
 */
export class SupabaseConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Supabase is not configured: ${missing.join(" and ")} ` +
        `${missing.length > 1 ? "were" : "was"} empty when this build ran. ` +
        `Set them as build-time environment variables and rebuild — on Cloudflare ` +
        `that is the Worker's Settings → Variables, then a fresh deployment.`,
    );
    this.name = "SupabaseConfigError";
  }
}

export function supabaseEnv(): { url: string; key: string } {
  // Written as full literals so the compiler can substitute them at build time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((v): v is string => typeof v === "string");

  if (missing.length) throw new SupabaseConfigError(missing);

  return { url: url!, key: key! };
}
