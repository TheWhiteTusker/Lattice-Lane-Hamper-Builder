"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Photo } from "@/lib/presentation";

const BUCKET = "product-images";
const LOGO_PATH = "brand/deck-logo.png";
const LOGO_SIZE = { width: 1600, height: 887 }; // public/brand/deck-logo.png

/**
 * The Lattice Lane logo for designs. It lives in storage so every slide and
 * hamper image keeps a stable URL whatever domain the app runs on; it is
 * copied from the app's own /brand/deck-logo.png the first time it's needed.
 */
export async function getBrandLogo(): Promise<Photo | null> {
  const supabase = await createClient();
  const url = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH).data.publicUrl;
  const { data: existing } = await supabase.storage.from(BUCKET).list("brand", { search: "deck-logo.png" });
  if (existing?.some((f) => f.name === "deck-logo.png")) return { url, size: LOGO_SIZE };

  try {
    const h = await headers();
    const host = h.get("host") ?? "";
    const local = host.startsWith("localhost") || host.startsWith("127.");
    const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
    const res = await fetch(`${proto}://${host}/brand/deck-logo.png`);
    if (!res.ok) return null;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(LOGO_PATH, await res.arrayBuffer(), { contentType: "image/png", upsert: false });
    if (error && !/exist|duplicate/i.test(error.message)) return null;
    return { url, size: LOGO_SIZE };
  } catch {
    return null;
  }
}
