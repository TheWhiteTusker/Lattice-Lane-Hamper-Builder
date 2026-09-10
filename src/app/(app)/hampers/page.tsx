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
  const collection = one(params.collection);
  const minItems = one(params.items).trim();
  const minCost = one(params.cost_min).trim();
  const maxCost = one(params.cost_max).trim();
  const minPrice = one(params.price_min).trim();
  const maxPrice = one(params.price_max).trim();

  const { supabase, profile } = await requireUser();
  const manage = canManage(profile.role);

  let query = supabase.from("hamper_summary").select("*").order("code");
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  if (collection) query = query.eq("collection", collection);
  // Items is a floor; cost and catalogue price are ranges, either end optional.
  if (minItems) query = query.gte("number_of_items", Number(minItems));
  if (minCost) query = query.gte("total_cp", Number(minCost));
  if (maxCost) query = query.lte("total_cp", Number(maxCost));
  if (minPrice) query = query.gte("final_catalogue_sp", Number(minPrice));
  if (maxPrice) query = query.lte("final_catalogue_sp", Number(maxPrice));

  const [{ data: hampers }, settings] = await Promise.all([
    query.returns<HamperSummary[]>(),
    loadSettings(supabase),
  ]);

  const rows = hampers ?? [];
  const filtered = !!(
    q ||
    collection ||
    minItems ||
    minCost ||
    maxCost ||
    minPrice ||
    maxPrice
  );

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
        <table className="table min-w-[1200px]">
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
              <th className="pb-2"></th>
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
                <Range name="cost" label="cost" min={minCost} max={maxCost} />
              </th>
              <th className="pb-2">
                <Range name="price" label="catalogue price" min={minPrice} max={maxPrice} />
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

/** A from-to pair on one numeric column; either end may be left blank. */
function Range({
  name,
  label,
  min,
  max,
}: {
  name: string;
  label: string;
  min: string;
  max: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        name={`${name}_min`}
        aria-label={`Minimum ${label}`}
        inputMode="decimal"
        defaultValue={min}
        placeholder="min"
        className="input input-num"
      />
      <span className="text-[var(--color-muted)]">–</span>
      <input
        name={`${name}_max`}
        aria-label={`Maximum ${label}`}
        inputMode="decimal"
        defaultValue={max}
        placeholder="max"
        className="input input-num"
      />
    </div>
  );
}
