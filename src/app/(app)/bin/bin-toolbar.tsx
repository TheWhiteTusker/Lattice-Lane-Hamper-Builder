"use client";

import type { BinCounts, BinItemType } from "./bin-types";

const TABS: { key: "all" | BinItemType; label: string; countKey: keyof BinCounts }[] = [
  { key: "all", label: "All Items", countKey: "all" },
  { key: "hamper", label: "Hampers", countKey: "hampers" },
  { key: "product", label: "Products", countKey: "products" },
  { key: "image", label: "Photos", countKey: "images" },
];

export function BinToolbar({
  counts,
  selectedTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: {
  counts: BinCounts;
  selectedTab: "all" | BinItemType;
  onTabChange: (tab: "all" | BinItemType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1 shadow-2xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              selectedTab === t.key
                ? "bg-(--color-brand) text-white"
                : "text-(--color-muted) hover:text-(--color-ink)"
            }`}
          >
            {t.label} ({counts[t.countKey]})
          </button>
        ))}
      </div>

      {/* Search within Bin */}
      <div className="min-w-55">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by name or code…"
          className="input text-xs"
        />
      </div>
    </div>
  );
}
