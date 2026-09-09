import Link from "next/link";
import { requireUser, canManage } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { formatMoney, formatPct } from "@/lib/pricing";
import type { HamperSummary } from "@/lib/types";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function HampersPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = one(params.q).trim();
  const status = one(params.status);
  const collection = one(params.collection);
  const minItems = one(params.items).trim();
  const minCost = one(params.cost).trim();
  const minPrice = one(params.price).trim();

  const { supabase, profile } = await requireUser();
  const manage = canManage(profile.role);

  let query = supabase.from("hamper_summary").select("*").order("code");
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (collection) query = query.eq("collection", collection);
  // The numeric boxes are floors - "at least this many items / this much money".
  if (minItems) query = query.gte("number_of_items", Number(minItems));
  if (minCost) query = query.gte("total_cp", Number(minCost));
  if (minPrice) query = query.gte("final_catalogue_sp", Number(minPrice));

  const [{ data: hampers }, settings] = await Promise.all([
    query.returns<HamperSummary[]>(),
    loadSettings(supabase),
  ]);

  const rows = hampers ?? [];
  const filtered = !!(q || status || collection || minItems || minCost || minPrice);

  return (
    <>
      <PageHeader title="Hampers" subtitle={`${rows.length} hamper${rows.length === 1 ? "" : "s"}`}>
        {profile.role === "admin" && (
          <Link href="/admin/refresh-prices" className="btn-secondary">
            Refresh prices
          </Link>
        )}
        {manage && (
          <Link href="/hampers/new" className="btn-primary">
            New hamper
          </Link>
        )}
      </PageHeader>

      {/* The form wraps the whole table so every filter can sit in the header
          cell of the column it filters. */}
      <form className="card overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th>Code</th>
              <th>Hamper</th>
              <th>Collection</th>
              <th>Status</th>
              <th className="num">Items</th>
              <th className="num">Cost</th>
              <th className="num">Catalogue price</th>
              <th className="num">Profit</th>
              <th className="num">Margin</th>
            </tr>

            <tr>
              <th colSpan={2} className="pb-2">
                <input
                  name="q"
                  aria-label="Search name or code"
                  defaultValue={q}
                  placeholder="Name or code"
                  className="input"
                />
              </th>
              <th className="pb-2">
                <input
                  name="collection"
                  aria-label="Filter by collection"
                  list="collection-options"
                  defaultValue={collection}
                  placeholder="Any"
                  className="input"
                />
                <datalist id="collection-options">
                  {settings.collections.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </th>
              <th className="pb-2">
                <select
                  name="status"
                  aria-label="Filter by status"
                  defaultValue={status}
                  className="select"
                >
                  <option value="">Any</option>
                  {settings.hamper_statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </th>
              <th className="pb-2">
                <input
                  name="items"
                  aria-label="Minimum items"
                  inputMode="decimal"
                  defaultValue={minItems}
                  placeholder="min"
                  className="input input-num"
                />
              </th>
              <th className="pb-2">
                <input
                  name="cost"
                  aria-label="Minimum cost"
                  inputMode="decimal"
                  defaultValue={minCost}
                  placeholder="min"
                  className="input input-num"
                />
              </th>
              <th className="pb-2">
                <input
                  name="price"
                  aria-label="Minimum catalogue price"
                  inputMode="decimal"
                  defaultValue={minPrice}
                  placeholder="min"
                  className="input input-num"
                />
              </th>
              <th colSpan={2} className="pb-2">
                <div className="flex items-center justify-end gap-2">
                  {filtered && (
                    <Link href="/hampers" className="btn-secondary">
                      Clear
                    </Link>
                  )}
                  <button type="submit" className="btn-secondary">
                    Apply
                  </button>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-[var(--color-muted)]">
                  {filtered ? "No hampers match that search." : "No hampers yet."}
                  {manage && !filtered && (
                    <Link href="/hampers/new" className="ml-2 underline">
                      Build the first one
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((h) => (
                <tr key={h.id}>
                  <td className="font-mono whitespace-nowrap">
                    <Link href={`/hampers/${encodeURIComponent(h.code)}`} className="hover:underline">
                      {h.code}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/hampers/${encodeURIComponent(h.code)}`} className="hover:underline">
                      {h.name}
                    </Link>
                  </td>
                  <td className="text-[var(--color-muted)]">{h.collection ?? "—"}</td>
                  <td>
                    <span className="badge">{h.status}</span>
                  </td>
                  <td className="num">{h.number_of_items}</td>
                  <td className="num">{formatMoney(h.total_cp)}</td>
                  <td className="num">
                    {h.final_catalogue_sp == null ? (
                      <span className="text-[var(--color-muted)]">not priced</span>
                    ) : (
                      formatMoney(h.final_catalogue_sp)
                    )}
                  </td>
                  <td
                    className={`num ${h.gross_profit != null && h.gross_profit < 0 ? "text-red-700" : ""}`}
                  >
                    {h.gross_profit == null ? "—" : formatMoney(h.gross_profit)}
                  </td>
                  <td
                    className={`num ${h.final_margin != null && h.final_margin < 0 ? "text-red-700" : ""}`}
                  >
                    {h.final_margin == null ? "—" : formatPct(h.final_margin)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </form>
    </>
  );
}
