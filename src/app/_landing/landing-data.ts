import { createClient } from "@/lib/supabase/server";
import { CURATED_FALLBACKS, type DisplayProduct } from "./fallbacks";

/** Whether someone is signed in, and the photos for the four scrolling columns. */
export async function getLandingData() {
  const supabase = await createClient();
  const [{ data: userClaims }, { data: dbProducts }, { data: dbProductImages }, { data: dbHampers }] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from("products")
        .select("id, name, image_url, code, category_id")
        .eq("is_active", true)
        .not("image_url", "is", null)
        .limit(40),
      supabase
        .from("product_images")
        .select("id, url, caption, product_id")
        .not("url", "is", null)
        .limit(40),
      supabase
        .from("hampers")
        .select("id, name, image_url, code")
        .not("image_url", "is", null)
        .limit(20),
    ]);

  const unique = new Map<string, DisplayProduct>();

  // 1. Add database products if any
  for (const p of dbProducts ?? []) {
    if (p.image_url && !unique.has(p.image_url)) {
      unique.set(p.image_url, {
        id: p.id,
        url: p.image_url,
        name: p.name,
        category: p.code || "Catalog Product",
      });
    }
  }

  // 2. Add extra product gallery images if any
  for (const img of dbProductImages ?? []) {
    if (img.url && !unique.has(img.url)) {
      unique.set(img.url, {
        id: img.id,
        url: img.url,
        name: img.caption || "Curated Item",
        category: "Product Gallery",
      });
    }
  }

  // 3. Add hamper photos if any
  for (const h of dbHampers ?? []) {
    if (h.image_url && !unique.has(h.image_url)) {
      unique.set(h.image_url, {
        id: h.id,
        url: h.image_url,
        name: h.name,
        category: "Hamper Presentation",
      });
    }
  }

  // 4. Fill in with curated fallbacks ensuring zero duplicate URLs
  for (const fallback of CURATED_FALLBACKS) {
    if (!unique.has(fallback.url)) {
      unique.set(fallback.url, fallback);
    }
  }

  const allItems = Array.from(unique.values());

  // Distribute items strictly into 4 disjoint partitions for the 4 scrolling columns.
  // Because Set_1 ∩ Set_2 ∩ Set_4 ∩ Set_5 = ∅, no duplicate image can ever appear
  // in multiple columns simultaneously.
  const col1: DisplayProduct[] = [];
  const col2: DisplayProduct[] = [];
  const col4: DisplayProduct[] = [];
  const col5: DisplayProduct[] = [];

  allItems.forEach((item, index) => {
    const bucket = index % 4;
    if (bucket === 0) col1.push(item);
    else if (bucket === 1) col2.push(item);
    else if (bucket === 2) col4.push(item);
    else col5.push(item);
  });

  return {
    isLoggedIn: !!userClaims?.claims?.sub,
    col1,
    col2,
    col4,
    col5,
  };
}
