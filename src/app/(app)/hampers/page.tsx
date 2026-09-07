import Link from "next/link";
import { requireUser, canManage } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatMoney, formatPct } from "@/lib/pricing";
import type { HamperSummary } from "@/lib/types";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function HampersPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const q = one(params.q).trim();
  const status = one(params.status);
  const collection = one(params.collection);

  const { supabase, profile } = await requireUser();
  const manage = canManage(profile.role);

  let query = supabase.from("hamper_summary").select("*").order("code");
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (collection) query = query.eq("collection", collection);

  const [{ data: hampers }, settings] = await Promise.all([
    query.returns<HamperSummary[]>(),
    loadSettings(supabase),
  ]);

  const rows = hampers ?? [];

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

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Name or code" className="input mt-1" />
        </div>

        <div className="min-w-[150px]">
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="select mt-1">
            <option value="">Any status</option>
            {settings.hamper_statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[170px]">
          <label className="label" htmlFor="collection">
            Collection
          </label>
          <input
            id="collection"
            name="collection"
            list="collection-options"
            defaultValue={collection}
            className="input mt-1"
          />
          <datalist id="collection-options">
            {settings.collections.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <button type="submit" className="btn-secondary">
          Apply
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={q || status || collection ? "No hampers match that search" : "No hampers yet"}
          hint={
            manage
              ? "Build one from the Product Master, or import your existing hampers from the spreadsheet."
              : "Ask a manager to build the first hamper."
          }
          actionHref={manage ? "/hampers/new" : undefined}
          actionLabel={manage ? "New hamper" : undefined}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[900px]">
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
            </thead>
            <tbody>
              {rows.map((h) => (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
