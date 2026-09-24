import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DisplayProduct = {
  id: string;
  url: string;
  name: string;
  category: string;
};

// Curated luxury gifting and bespoke hamper items for the 5-column display.
// Optimized image dimensions (w=360, q=75) drastically reduce GPU texture overhead and decodes.
const CURATED_FALLBACKS: DisplayProduct[] = [
  {
    id: "f-1",
    url: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=75&w=360&auto=format&fit=crop",
    name: "Artisan Chocolate Truffles",
    category: "Gourmet Confections",
  },
  {
    id: "f-2",
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=75&w=360&auto=format&fit=crop",
    name: "Handcrafted Ceramic Mug",
    category: "Artisanal Living",
  },
  {
    id: "f-3",
    url: "https://images.unsplash.com/photo-1603006905003-be475563bc59?q=75&w=360&auto=format&fit=crop",
    name: "Hand-Poured Amber Candle",
    category: "Home Fragrance",
  },
  {
    id: "f-4",
    url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=75&w=360&auto=format&fit=crop",
    name: "Single-Estate Darjeeling Tea",
    category: "Beverages",
  },
  {
    id: "f-5",
    url: "https://images.unsplash.com/photo-1528751014936-863e6e7a319c?q=75&w=360&auto=format&fit=crop",
    name: "Saffron Pistachios & Almonds",
    category: "Royal Dry Fruits",
  },
  {
    id: "f-6",
    url: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?q=75&w=360&auto=format&fit=crop",
    name: "Velvet Keepsake Hamper Box",
    category: "Packaging",
  },
  {
    id: "f-7",
    url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=75&w=360&auto=format&fit=crop",
    name: "Brushed Brass Barware Set",
    category: "Entertaining",
  },
  {
    id: "f-8",
    url: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?q=75&w=360&auto=format&fit=crop",
    name: "Monsoon Malabar Coffee Beans",
    category: "Specialty Roast",
  },
  {
    id: "f-9",
    url: "https://images.unsplash.com/photo-1512909006721-3d6018887383?q=75&w=360&auto=format&fit=crop",
    name: "Wax-Sealed Greeting Accents",
    category: "Finishing Touches",
  },
  {
    id: "f-10",
    url: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=75&w=360&auto=format&fit=crop",
    name: "Organic Acacia Honey with Dipper",
    category: "Gourmet Pantry",
  },
  {
    id: "f-11",
    url: "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?q=75&w=360&auto=format&fit=crop",
    name: "Bespoke Marble Coaster Quad",
    category: "Home Decor",
  },
  {
    id: "f-12",
    url: "https://images.unsplash.com/photo-1556881286-fc6915169721?q=75&w=360&auto=format&fit=crop",
    name: "Sparkling Botanical Elixir Flutes",
    category: "Celebration",
  },
  {
    id: "f-13",
    url: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=75&w=360&auto=format&fit=crop",
    name: "Handmade Brass Keepsake Diya",
    category: "Festive Tokens",
  },
  {
    id: "f-14",
    url: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=75&w=360&auto=format&fit=crop",
    name: "Heritage Wooden Gift Trunk",
    category: "Signature Hampers",
  },
  {
    id: "f-15",
    url: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=75&w=360&auto=format&fit=crop",
    name: "Artisanal Hazelnut Brittle",
    category: "Sweet Delights",
  },
  {
    id: "f-16",
    url: "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=75&w=360&auto=format&fit=crop",
    name: "Organic Belgian Linen Napkins",
    category: "Tableware",
  },
  {
    id: "f-17",
    url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=75&w=360&auto=format&fit=crop",
    name: "Hand-Bound Leather Journal",
    category: "Stationery & Desk",
  },
  {
    id: "f-18",
    url: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?q=75&w=360&auto=format&fit=crop",
    name: "Parisian Macaron Collection",
    category: "Patisserie",
  },
  {
    id: "f-19",
    url: "https://images.unsplash.com/photo-1608248597359-0a6e0339a9ec?q=75&w=360&auto=format&fit=crop",
    name: "Botanical Essential Oil Blend",
    category: "Wellness",
  },
  {
    id: "f-20",
    url: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?q=75&w=360&auto=format&fit=crop",
    name: "Roasted Spiced Cashews Jar",
    category: "Savouries",
  },
  {
    id: "f-21",
    url: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=75&w=360&auto=format&fit=crop",
    name: "Matte Ceramic Flora Bud Vase",
    category: "Artisanal Living",
  },
  {
    id: "f-22",
    url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?q=75&w=360&auto=format&fit=crop",
    name: "Gilded Fine Bone China Cup",
    category: "Drinkware",
  },
  {
    id: "f-23",
    url: "https://images.unsplash.com/photo-1544816155-12df9643f363?q=75&w=360&auto=format&fit=crop",
    name: "Loom-Woven Willow Basket",
    category: "Packaging",
  },
  {
    id: "f-24",
    url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=75&w=360&auto=format&fit=crop",
    name: "Single-Origin 72% Dark Chocolate",
    category: "Gourmet Confections",
  },
  {
    id: "f-25",
    url: "https://images.unsplash.com/photo-1602928321679-560bb453f190?q=75&w=360&auto=format&fit=crop",
    name: "Cedar & Bergamot Reed Diffuser",
    category: "Home Fragrance",
  },
  {
    id: "f-26",
    url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?q=75&w=360&auto=format&fit=crop",
    name: "Cardamom & Almond Biscotti",
    category: "Bakery",
  },
  {
    id: "f-27",
    url: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=75&w=360&auto=format&fit=crop",
    name: "Rosewood Pocket Game Board",
    category: "Luxury Leisure",
  },
  {
    id: "f-28",
    url: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?q=75&w=360&auto=format&fit=crop",
    name: "Celebration Ribbon & Tag Kit",
    category: "Packaging",
  },
];

async function getLandingData() {
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

export default async function LandingPage() {
  const { isLoggedIn, col1, col2, col4, col5 } = await getLandingData();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col select-none">
      {/* Top Glassmorphic Navigation Bar */}
      <header className="z-30 shrink-0 border-b border-[var(--color-line)]/80 bg-[var(--color-paper)]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group focus:outline-none">
            <Image
              src="/lattice-lane-logo-black.png"
              alt="Lattice Lane"
              width={1768}
              height={203}
              priority
              className="h-6 sm:h-7 w-auto object-contain transition-opacity group-hover:opacity-85"
            />
          </Link>
          <span className="hidden sm:inline-block text-[11px] uppercase tracking-widest text-[var(--color-muted)] font-semibold border-l border-[var(--color-line)] pl-3">
            House of Gifting
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="btn-primary text-xs sm:text-sm px-4 py-2 rounded-lg shadow-sm"
            >
              Open Dashboard &rarr;
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-secondary text-xs sm:text-sm px-3.5 py-1.5 rounded-lg font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="btn-primary text-xs sm:text-sm px-4 py-2 rounded-lg shadow-sm"
              >
                Enter Builder
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main 5-Vertical Stage */}
      <main className="relative flex-1 w-full overflow-hidden flex items-stretch px-2 sm:px-4 md:px-6 py-2">
        {/* Hardware-accelerated top and bottom edge fade overlays.
            Using static gradient overlays instead of CSS mask-image prevents continuous GPU repaints
            and makes the infinite vertical marquee silky smooth at 60fps/120fps. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--color-paper)] via-[var(--color-paper)]/85 to-transparent z-20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--color-paper)] via-[var(--color-paper)]/85 to-transparent z-20" />

        {/* 5 Vertical Layout Container */}
        <div className="relative w-full h-full flex items-stretch justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-5">
          {/* Column 1 (Outer Left) - Downward Marquee */}
          <div className="hidden xl:flex flex-1 min-w-0 flex-col h-full overflow-hidden group-pause">
            <ScrollingProductColumn
              items={col1}
              durationSeconds={52}
              label="Column 1"
            />
          </div>

          {/* Column 2 (Inner Left) - Downward Marquee */}
          <div className="hidden md:flex flex-1 min-w-0 flex-col h-full overflow-hidden group-pause">
            <ScrollingProductColumn
              items={col2}
              durationSeconds={68}
              label="Column 2"
            />
          </div>

          {/* Column 3 (Center Hero - Wider / Elevated) */}
          <div className="flex-[1.4] sm:flex-[1.3] md:flex-[1.35] lg:flex-[1.25] min-w-[290px] max-w-[480px] h-full flex flex-col justify-center items-center z-20 px-1 py-2">
            <div className="w-full max-h-[92vh] overflow-y-auto rounded-3xl bg-[var(--color-paper)]/95 backdrop-blur-xl border-2 border-[var(--color-gold)]/60 shadow-[0_20px_50px_rgba(44,51,47,0.12)] p-6 sm:p-8 flex flex-col items-center justify-between text-center relative transition-transform duration-300 hover:shadow-[0_25px_60px_rgba(44,51,47,0.18)]">
              {/* Subtle gold ornamental corner accents */}
              <div className="absolute top-3 left-3 h-3 w-3 border-t-2 border-l-2 border-[var(--color-gold)] opacity-70" />
              <div className="absolute top-3 right-3 h-3 w-3 border-t-2 border-r-2 border-[var(--color-gold)] opacity-70" />
              <div className="absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-[var(--color-gold)] opacity-70" />
              <div className="absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 border-[var(--color-gold)] opacity-70" />

              {/* Brand Lockup & Crest */}
              <div className="flex flex-col items-center pt-2">
                <span className="text-[10px] tracking-[0.25em] font-semibold text-[var(--color-brand)] uppercase mb-2">
                  Bespoke Corporate & Celebratory Gifting
                </span>
                <Image
                  src="/lattice-lane-lockup.png"
                  alt="Lattice Lane"
                  width={1600}
                  height={976}
                  priority
                  className="h-20 sm:h-24 w-auto object-contain drop-shadow-sm mb-1"
                />
                <div className="h-0.5 w-14 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent my-2" />
              </div>

              {/* Hero Narrative */}
              <div className="my-4 sm:my-5 space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-brand-dark)] leading-tight">
                  Hamper Builder &amp; Costing Suite
                </h1>
                <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed max-w-sm mx-auto">
                  Architect unforgettable impressions. Curate artisanal gifts, simulate container limits, calculate precise gross margins, and generate proforma quotations in seconds.
                </p>
              </div>

              {/* Feature Highlights Badges */}
              <div className="grid grid-cols-2 gap-2 w-full my-2 text-left">
                <div className="rounded-xl border border-[var(--color-line)] bg-white/80 px-3 py-2 text-xs">
                  <span className="font-semibold text-[var(--color-ink)] block">📦 Dynamic Canvas</span>
                  <span className="text-[11px] text-[var(--color-muted)]">Visual layout &amp; items</span>
                </div>
                <div className="rounded-xl border border-[var(--color-line)] bg-white/80 px-3 py-2 text-xs">
                  <span className="font-semibold text-[var(--color-ink)] block">⚡ Margin Control</span>
                  <span className="text-[11px] text-[var(--color-muted)]">Instant pricing &amp; GST</span>
                </div>
                <div className="rounded-xl border border-[var(--color-line)] bg-white/80 px-3 py-2 text-xs">
                  <span className="font-semibold text-[var(--color-ink)] block">📊 PowerPoint Deck</span>
                  <span className="text-[11px] text-[var(--color-muted)]">Automated pitch exports</span>
                </div>
                <div className="rounded-xl border border-[var(--color-line)] bg-white/80 px-3 py-2 text-xs">
                  <span className="font-semibold text-[var(--color-ink)] block">📜 Quotations &amp; PI</span>
                  <span className="text-[11px] text-[var(--color-muted)]">Print-ready proforma</span>
                </div>
              </div>

              {/* Call To Action Buttons */}
              <div className="w-full pt-4 space-y-2.5">
                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] text-white font-semibold py-3 px-6 text-sm shadow-md hover:bg-[var(--color-brand-dark)] hover:shadow-lg transition-all duration-200 group"
                >
                  <span>{isLoggedIn ? "Open Workspace" : "Enter Hamper Builder"}</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1 font-bold">
                    &rarr;
                  </span>
                </Link>

                {!isLoggedIn && (
                  <Link
                    href="/login"
                    className="w-full block text-center text-xs text-[var(--color-brand)] font-medium hover:underline py-1"
                  >
                    Team Sign In &bull; Lattice Lane Workspace
                  </Link>
                )}
              </div>

              {/* Footer Trust Indicator */}
              <div className="pt-4 border-t border-[var(--color-line)]/60 w-full mt-3">
                <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-semibold">
                  Private Enterprise System &bull; Lattice Lane
                </p>
              </div>
            </div>
          </div>

          {/* Column 4 (Inner Right) - Downward Marquee */}
          <div className="hidden md:flex flex-1 min-w-0 flex-col h-full overflow-hidden group-pause">
            <ScrollingProductColumn
              items={col4}
              durationSeconds={60}
              label="Column 4"
            />
          </div>

          {/* Column 5 (Outer Right) - Downward Marquee */}
          <div className="hidden xl:flex flex-1 min-w-0 flex-col h-full overflow-hidden group-pause">
            <ScrollingProductColumn
              items={col5}
              durationSeconds={48}
              label="Column 5"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Ultra-smooth infinite downward scrolling column.
 * Two identical sub-containers with identical vertical padding (pb-3) ensure the
 * translate3d(0, -50%, 0) to translate3d(0, 0, 0) transition is mathematically seamless
 * with zero subpixel jitter or seam jumping.
 */
function ScrollingProductColumn({
  items,
  durationSeconds,
  label,
}: {
  items: DisplayProduct[];
  durationSeconds: number;
  label: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-col animate-marquee-down"
      style={{ animationDuration: `${durationSeconds}s` }}
      aria-label={label}
    >
      {/* Group 1 */}
      <div className="flex flex-col gap-3 pb-3">
        {items.map((item) => (
          <ProductCard key={`g1-${item.id}`} item={item} />
        ))}
      </div>

      {/* Group 2 (Identical clone for continuous seam-free loop) */}
      <div className="flex flex-col gap-3 pb-3" aria-hidden="true">
        {items.map((item) => (
          <ProductCard key={`g2-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ item }: { item: DisplayProduct }) {
  return (
    <article className="shrink-0 w-full rounded-2xl bg-white p-2.5 border border-[var(--color-line)] shadow-xs transition-shadow duration-200 group cursor-default">
      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-[var(--color-paper)] relative">
        <img
          src={item.url}
          alt={item.name}
          decoding="async"
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />
      </div>
      <div className="mt-2 text-left px-0.5">
        <p className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-[var(--color-muted)] truncate">
          {item.category}
        </p>
        <h3 className="text-xs sm:text-sm font-medium text-[var(--color-ink)] truncate group-hover:text-[var(--color-brand)] transition-colors">
          {item.name}
        </h3>
      </div>
    </article>
  );
}
