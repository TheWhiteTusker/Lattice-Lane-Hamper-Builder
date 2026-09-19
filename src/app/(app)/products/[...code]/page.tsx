import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { resolveColors } from "@/lib/product-code";
import { formatMoney } from "@/lib/pricing";
import { PageHeader } from "@/components/ui";
import { ImagePreview } from "@/components/image-preview";
import { ProductForm } from "../product-form";
import type { Category, Product, ProductImage } from "@/lib/types";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string | string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const editing = (await searchParams).edit === "1";
  const rawCode = Array.isArray(code) ? code.join("/") : code;
  const decodedCode = decodeURIComponent(rawCode);
  const { supabase } = await requireRole("admin");

  const [{ data: product }, { data: categories }, settings] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("code", decodedCode)
      .maybeSingle<Product>(),
    supabase.from("categories").select("*").order("sort_order").order("name").returns<Category[]>(),
    loadSettings(supabase),
  ]);

  if (!product) notFound();

  const { data: images } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", product.id)
    .order("sort_order")
    .order("created_at")
    .returns<ProductImage[]>();

  const href = `/products/${encodeURIComponent(product.code)}`;

  if (editing) {
    return (
      <>
        <PageHeader title={`Edit ${product.name}`} subtitle={product.code}>
          <Link href={href} className="btn-secondary">
            Cancel
          </Link>
        </PageHeader>
        <ProductForm
          product={product}
          initialImages={images ?? []}
          categories={categories ?? []}
          sources={settings.sources}
          allColors={resolveColors(settings.product_colors, settings.color_hex)}
        />
      </>
    );
  }

  const category = categories?.find((c) => c.id === product.category_id);
  const colors = resolveColors(product.colors ?? [], settings.color_hex);
  const photos = images ?? [];

  const fields: [string, string][] = [
    ["Code", product.code],
    ["Category", category?.name ?? "—"],
    ["Source / vendor", product.source ?? "—"],
    ["Status", product.is_active ? "Active" : "Inactive"],
    ["Cost price", formatMoney(product.cost_price)],
    ["Markup", product.markup_pct != null ? `${product.markup_pct}%` : "—"],
    ["Selling price", formatMoney(product.default_sp)],
  ];

  return (
    <>
      <PageHeader title={product.name} subtitle={product.code}>
        <Link
          href={`/cost-calculator?product=${encodeURIComponent(product.code)}`}
          className="btn-secondary"
        >
          Cost Calculator
        </Link>
        <Link href={`${href}?edit=1`} className="btn-primary">
          Edit
        </Link>
      </PageHeader>

      <div className="card max-w-2xl p-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="mt-0.5 text-sm text-[var(--color-ink)]">{value}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="label">Colors / finishes</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {colors.length === 0 && <span className="text-sm">—</span>}
              {colors.map((c) => (
                <span
                  key={c.name}
                  className="flex items-center gap-2 rounded-full bg-[var(--color-sheet)] px-3 py-1 text-xs font-medium"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name} ({c.code})
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card mt-4 max-w-2xl p-5">
        <h3 className="text-sm font-bold text-[var(--color-ink)]">Photos</h3>
        {photos.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            No photos yet. Use Edit to upload them.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((img) => (
              <figure key={img.id}>
                <ImagePreview
                  src={img.url}
                  alt={`${product.name}${img.color ? ` — ${img.color}` : ""}`}
                  sizes="(max-width: 640px) 50vw, 160px"
                  className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-100"
                />
                <figcaption className="mt-1 text-[11px] text-[var(--color-muted)]">
                  {img.color || "General"}
                  {img.is_primary && " · ★ Primary"}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
