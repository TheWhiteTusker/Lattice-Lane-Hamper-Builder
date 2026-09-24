"use client";

import { useState, useTransition, useMemo } from "react";
import type { BinItem, BinCounts, BinItemType } from "./bin-types";
import { BinItemRow } from "./bin-item-row";
import { emptyBinAction, purgeExpiredAction } from "./actions";

export function BinView({
  initialItems,
  counts,
  canManage,
  isAdmin,
}: {
  initialItems: BinItem[];
  counts: BinCounts;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const [selectedTab, setSelectedTab] = useState<"all" | BinItemType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(() => {
    return initialItems.filter((item) => {
      if (selectedTab !== "all" && item.type !== selectedTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesCode = (item.code || "").toLowerCase().includes(q);
        const matchesSubtitle = (item.subtitle || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesSubtitle) return false;
      }
      return true;
    });
  }, [initialItems, selectedTab, searchQuery]);

  function handleEmptyBin() {
    const scopeLabel =
      selectedTab === "all"
        ? "all items"
        : selectedTab === "hamper"
          ? "all deleted hampers"
          : selectedTab === "product"
            ? "all deleted products"
            : "all deleted photos";

    if (
      !confirm(
        `Permanently delete ${scopeLabel} from the Bin? This will delete all records and stored images permanently and cannot be undone.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await emptyBinAction(selectedTab);
      if (res.error) {
        setNotification({ text: res.error, error: true });
      } else {
        setNotification({ text: res.message || "Bin emptied successfully." });
      }
    });
  }

  function handlePurgeExpired() {
    startTransition(async () => {
      const res = await purgeExpiredAction();
      if (res.error) {
        setNotification({ text: res.error, error: true });
      } else {
        setNotification({ text: res.message || "Expired items purged." });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Informational notification or feedback toast */}
      {notification && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all ${
            notification.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[var(--color-line)] bg-[#faf8ee] text-[var(--color-ink)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                notification.error ? "bg-red-500" : "bg-[var(--color-brand)]"
              }`}
            />
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs font-semibold uppercase hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview & explanation banner */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 bg-white border-[var(--color-line)]">
        <div className="text-sm text-[var(--color-muted)]">
          <p>
            <strong className="text-[var(--color-ink)]">30-Day Retention Policy:</strong> Deleted
            hampers, products, and photos are safely stored here for 30 days before being permanently
            removed. You can restore them to active use at any time within this window.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {counts.expired > 0 && canManage && (
            <button
              type="button"
              onClick={handlePurgeExpired}
              disabled={isPending}
              className="btn-danger text-xs px-3 py-1.5"
            >
              Purge Expired ({counts.expired})
            </button>
          )}

          {(canManage || isAdmin) && counts.all > 0 && (
            <button
              type="button"
              onClick={handleEmptyBin}
              disabled={isPending}
              className="btn-secondary text-xs px-3 py-1.5 hover:border-red-300 hover:text-red-700"
            >
              Empty {selectedTab === "all" ? "Bin" : selectedTab}
            </button>
          )}
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setSelectedTab("all")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              selectedTab === "all"
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            All Items ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("hamper")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              selectedTab === "hamper"
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Hampers ({counts.hampers})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("product")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              selectedTab === "product"
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Products ({counts.products})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("image")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              selectedTab === "image"
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Photos ({counts.images})
          </button>
        </div>

        {/* Search within Bin */}
        <div className="min-w-[220px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name or code…"
            className="input text-xs"
          />
        </div>
      </div>

      {/* Items Table */}
      {filteredItems.length > 0 ? (
        <div className="card overflow-x-auto shadow-2xs">
          <table className="table min-w-[850px]">
            <thead>
              <tr>
                <th className="w-14"></th>
                <th className="w-24">Type</th>
                <th className="w-32">Code</th>
                <th>Item Details</th>
                <th>Deleted On</th>
                <th>Retention</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <BinItemRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  canManage={canManage}
                  isAdmin={isAdmin}
                  onNotify={setNotification}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-paper)] border border-[var(--color-line)] text-xl text-[var(--color-muted)]">
            🗑️
          </div>
          <h3 className="font-display text-base font-semibold text-[var(--color-ink)]">
            {searchQuery
              ? "No matching items found"
              : selectedTab === "all"
                ? "The Bin is empty"
                : `No deleted ${selectedTab}s in the Bin`}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-[var(--color-muted)]">
            {searchQuery
              ? "Try adjusting your search query or switching tabs."
              : "When hampers, products, or photos are deleted, they will sit here for 30 days before permanent deletion."}
          </p>
        </div>
      )}
    </div>
  );
}
