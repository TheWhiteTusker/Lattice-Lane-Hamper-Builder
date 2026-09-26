"use client";

import type { BinCounts, BinItemType } from "./bin-types";

export function BinHeader({
  counts,
  selectedTab,
  canManage,
  isAdmin,
  isPending,
  onEmptyBin,
  onPurgeExpired,
}: {
  counts: BinCounts;
  selectedTab: "all" | BinItemType;
  canManage: boolean;
  isAdmin: boolean;
  isPending: boolean;
  onEmptyBin: () => void;
  onPurgeExpired: () => void;
}) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4 bg-white border-line">
      <div className="text-sm text-(--color-muted)">
        <p>
          <strong className="text-(--color-ink)">30-Day Retention Policy:</strong> Deleted
          hampers, products, and photos are safely stored here for 30 days before being permanently
          removed. You can restore them to active use at any time within this window.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {counts.expired > 0 && canManage && (
          <button
            type="button"
            onClick={onPurgeExpired}
            disabled={isPending}
            className="btn-danger text-xs px-3 py-1.5"
          >
            Purge Expired ({counts.expired})
          </button>
        )}

        {(canManage || isAdmin) && counts.all > 0 && (
          <button
            type="button"
            onClick={onEmptyBin}
            disabled={isPending}
            className="btn-secondary text-xs px-3 py-1.5 hover:border-red-300 hover:text-red-700"
          >
            Empty {selectedTab === "all" ? "Bin" : selectedTab}
          </button>
        )}
      </div>
    </div>
  );
}
