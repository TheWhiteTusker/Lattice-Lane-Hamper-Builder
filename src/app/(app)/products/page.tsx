import Link from "next/link";
import Image from "next/image";
import { requireUser, isAdmin } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatMoney, formatPct } from "@/lib/pricing";
import type { Category, ProductWithCategory } from "@/lib/types";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ProductsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = one(params.q).trim();
  const category = one(params.category);
  const showInactive = one(params.inactive) === "1";

  const { supabase, profile } = await requireUser();
  const admin = isAdmin(profile.role);

  let query = supabase
    .from("products")
    .select("*, categories(name, counts_as_item)")
    .order("code");

  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,source.ilike.%${q}%`);
  if (category) query = query.eq("category_id", category);
  if (!showInactive) query = query.eq("is_active", true);

  const [{ data: products }, { data: categories }] = await Promise.all([
    query.returns<ProductWithCategory[]>(),
    supabase.from("categories").select("*").order("sort_order").order("name").returns<Category[]>(),
  ]);

  const rows = products ?? [];

  return (
    <>
      <PageHeader
        title="Product Master"
        subtitle={`${rows.length} product${rows.length === 1 ? "" : "s"}${showInactive ? " including inactive" : ""}`}
      >
        <Link href="/cost-calculator" className="btn-secondary">
          Cost Calculator
        </Link>
        <a href="/api/products/export" className="btn-secondary">
          Export CSV
        </a>
        {admin && (
          <>
            <Link href="/admin/import" className="btn-secondary">
              Import
            </Link>
            <Link href="/products/new" className="btn-primary">
              New product
            </Link>
          </>
        )}
      </PageHeader>

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Name, code or source"
            className="input mt-1"
          />
        </div>

        <div className="min-w-[180px]">
          <label className="label" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" defaultValue={category} className="select mt-1">
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} />
          Show inactive
        </label>

        <button type="submit" className="btn-secondary">
          Apply
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={q || category ? "No products match that search" : "No products yet"}
          hint={
            admin
              ? "Import your Product Master sheet, or add products one at a time."
              : "An admin needs to add products before hampers can be built."
          }
          actionHref={admin ? "/admin/import" : undefined}
          actionLabel={admin ? "Import from spreadsheet" : undefined}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12 text-center">Photo</th>
                <th>Code</th>
                <th>Product</th>
                <th>Category</th>
                <th>Source</th>
                <th className="num">Cost</th>
                <th className="num">Markup</th>
                <th className="num">Margin</th>
                <th className="num">Selling price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.is_active ? "" : "opacity-55"}>
                  <td className="w-12 py-1.5 px-2 text-center">
                    {p.image_url ? (
                      <div className="relative mx-auto h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-2xs">
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[9px] font-bold text-slate-300">
                        IMG
                      </div>
                    )}
                  </td>
                  <td className="font-mono whitespace-nowrap">{p.code}</td>
                  <td>
                    {p.name}
                    {!p.is_active && <span className="badge ml-2">Inactive</span>}
                  </td>
                  <td className="text-[var(--color-muted)]">{p.categories?.name ?? "—"}</td>
                  <td className="text-[var(--color-muted)]">{p.source ?? "—"}</td>
                  <td className="num">{formatMoney(p.cost_price)}</td>
                  <td className="num">{p.markup_pct != null ? `${p.markup_pct}%` : "—"}</td>
                  <td className="num">{formatPct(p.target_margin, 0)}</td>
                  <td className="num">{formatMoney(p.default_sp)}</td>
                  <td className="num">
                    <div className="flex items-center justify-end gap-2.5">
                      <Link
                        href={`/cost-calculator?product=${encodeURIComponent(p.code)}`}
                        className="text-[var(--color-brand)] hover:underline font-medium"
                      >
                        Costing
                      </Link>
                      {admin && (
                        <Link
                          href={`/products/${encodeURIComponent(p.code)}`}
                          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
