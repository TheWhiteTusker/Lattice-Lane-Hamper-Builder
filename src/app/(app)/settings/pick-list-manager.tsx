"use client";

import { useState, useMemo, useTransition, useEffect, useRef } from "react";
import { Search, X, Plus, Check, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import type { Settings } from "@/lib/types";
import { addPickListItem, removePickListItem } from "./actions";

export type PickListKey =
  | "hamper_statuses"
  | "quote_statuses"
  | "quote_structures"
  | "collections"
  | "sources"
  | "validity_options"
  | "detail_modes"
  | "packaging_treatments"
  | "product_colors";

export type PickListConfig = {
  key: PickListKey;
  label: string;
  hint?: string;
};

export const PICK_LIST_CONFIGS: PickListConfig[] = [
  {
    key: "hamper_statuses",
    label: "Hamper statuses",
    hint: "Statuses used in the hamper builder (e.g. Draft, Approved, Active, Discontinued).",
  },
  {
    key: "quote_statuses",
    label: "Quotation statuses",
    hint: "Only managers can move a quotation between these statuses.",
  },
  {
    key: "quote_structures",
    label: "Quote structures",
    hint: 'Only "Combined Order" produces an order total.',
  },
  {
    key: "collections",
    label: "Collections / occasions",
    hint: "Occasions and collections for categorising hampers (e.g. Festive, Corporate, Wedding).",
  },
  {
    key: "sources",
    label: "Sources / vendors",
    hint: "Vendor types and sources for products (e.g. In-house, Outsourced, Hybrid).",
  },
  {
    key: "validity_options",
    label: "Validity options",
    hint: "Validity durations offered when creating a quotation (e.g. 7 Days, 15 Days).",
  },
  {
    key: "detail_modes",
    label: "Contents shown on a quotation",
    hint: 'Anything containing "hide" hides contents, "summary" prints a count.',
  },
  {
    key: "packaging_treatments",
    label: "Packaging treatments",
    hint: 'Anything containing "absorb" folds packaging cost into the hamper.',
  },
  {
    key: "product_colors",
    label: "Product colors / finishes",
    hint: "Standard color variants available for catalog products.",
  },
];

export function PickListManager({ settings }: { settings: Settings }) {
  // Initialize state with all pick-lists from settings
  const [lists, setLists] = useState<Record<PickListKey, string[]>>({
    hamper_statuses: settings.hamper_statuses ?? [],
    quote_statuses: settings.quote_statuses ?? [],
    quote_structures: settings.quote_structures ?? [],
    collections: settings.collections ?? [],
    sources: settings.sources ?? [],
    validity_options: settings.validity_options ?? [],
    detail_modes: settings.detail_modes ?? [],
    packaging_treatments: settings.packaging_treatments ?? [],
    product_colors: settings.product_colors ?? [],
  });

  const [selectedKey, setSelectedKey] = useState<PickListKey>("hamper_statuses");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConfig = useMemo(
    () => PICK_LIST_CONFIGS.find((c) => c.key === selectedKey) ?? PICK_LIST_CONFIGS[0],
    [selectedKey],
  );

  const activeItems = useMemo(
    () => lists[selectedKey] ?? [],
    [lists, selectedKey],
  );

  // Filter items in real time based on search input
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter((item) => item.toLowerCase().includes(q));
  }, [activeItems, search]);

  // Check if search query exactly matches an existing item
  const hasExactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeItems.some((item) => item.toLowerCase() === q);
  }, [activeItems, search]);

  // Open modal with pre-filled search term
  function openAddModal(prefill?: string) {
    const val = (prefill ?? search).trim();
    setNewItemValue(val);
    setModalError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setNewItemValue("");
    setModalError(null);
  }

  // Focus modal input on open
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => modalInputRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  // Auto-dismiss status messages after 4 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Handle adding new item
  function handleAddItem(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = newItemValue.trim();

    if (!trimmed) {
      setModalError("Please enter an option name.");
      return;
    }

    if (activeItems.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setModalError(`"${trimmed}" already exists in ${activeConfig.label}.`);
      return;
    }

    startTransition(async () => {
      // Optimistic update
      const previous = [...activeItems];
      const updated = [...previous, trimmed];
      setLists((prev) => ({ ...prev, [selectedKey]: updated }));
      closeModal();
      setSearch(""); // Reset search so the newly added item is in view

      const res = await addPickListItem(selectedKey, trimmed);
      if (res.error) {
        // Rollback
        setLists((prev) => ({ ...prev, [selectedKey]: previous }));
        setStatusMessage({ type: "error", text: res.error });
      } else {
        setStatusMessage({
          type: "success",
          text: `Added "${trimmed}" to ${activeConfig.label}.`,
        });
      }
    });
  }

  // Handle removing an item
  function handleRemoveItem(itemToRemove: string) {
    startTransition(async () => {
      // Optimistic update
      const previous = [...activeItems];
      const updated = previous.filter((item) => item !== itemToRemove);
      setLists((prev) => ({ ...prev, [selectedKey]: updated }));

      const res = await removePickListItem(selectedKey, itemToRemove);
      if (res.error) {
        // Rollback
        setLists((prev) => ({ ...prev, [selectedKey]: previous }));
        setStatusMessage({ type: "error", text: res.error });
      } else {
        setStatusMessage({
          type: "success",
          text: `Removed "${itemToRemove}" from ${activeConfig.label}.`,
        });
      }
    });
  }

  // Clear search text box and refocus
  function handleClearSearch() {
    setSearch("");
    searchInputRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      {/* 1. Pick-list Dropdown selector and Add button */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" id="picklist-label">
            Select Pick-list
          </label>
          <div className="mt-1 flex items-center gap-2">
            {/* Custom Dropdown with green selection highlight */}
            <div ref={dropdownRef} className="relative flex-1">
              <button
                type="button"
                id="picklist-selector"
                aria-haspopup="listbox"
                aria-expanded={isDropdownOpen}
                aria-labelledby="picklist-label picklist-selector"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setIsDropdownOpen(true);
                  } else if (e.key === "Escape") {
                    setIsDropdownOpen(false);
                  }
                }}
                className="select flex w-full items-center justify-between font-medium cursor-pointer text-left"
              >
                <span className="truncate">
                  {activeConfig.label} ({activeItems.length}{" "}
                  {activeItems.length === 1 ? "value" : "values"})
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform duration-150 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div
                  role="listbox"
                  aria-labelledby="picklist-label"
                  className="absolute left-0 top-full z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[var(--color-line)] bg-white py-1 shadow-lg"
                >
                  {PICK_LIST_CONFIGS.map((config) => {
                    const count = (lists[config.key] ?? []).length;
                    const isSelected = config.key === selectedKey;
                    return (
                      <button
                        key={config.key}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedKey(config.key);
                          setSearch("");
                          setIsDropdownOpen(false);
                        }}
                        className={`group flex w-full select-none items-center justify-between px-3 py-2 text-left text-sm cursor-pointer text-[var(--color-ink)] hover:bg-[var(--color-brand)] hover:text-white focus:bg-[var(--color-brand)] focus:text-white focus:outline-none ${
                          isSelected ? "font-semibold" : "font-medium"
                        }`}
                      >
                        <span className="truncate">
                          {config.label} ({count} {count === 1 ? "value" : "values"})
                        </span>
                        {isSelected && (
                          <Check
                            strokeWidth={3.2}
                            className="h-4.5 w-4.5 shrink-0 text-[var(--color-brand)] group-hover:text-white group-focus:text-white"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => openAddModal()}
              className="btn-primary shrink-0 gap-1"
              title={`Add new item to ${activeConfig.label}`}
            >
              <Plus className="h-4 w-4" />
              <span>Add new</span>
            </button>
          </div>

          {activeConfig.hint && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">{activeConfig.hint}</p>
          )}
        </div>
      </div>

      {/* 2. Search Text Box with Clear Button on the Right */}
      <div className="relative max-w-md">
        <label className="label" htmlFor="picklist-search">
          Search options
        </label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            ref={searchInputRef}
            id="picklist-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim() && !hasExactMatch) {
                e.preventDefault();
                openAddModal(search.trim());
              }
            }}
            placeholder={`Search in ${activeConfig.label.toLowerCase()}...`}
            className="input pl-9 pr-10"
          />

          {/* Clear button on the right side of the text box */}
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition-colors"
              title="Clear search"
              aria-label="Clear search text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Search helper: If user searches something that isn't matched, offer Add New prompt */}
      {search.trim() && !hasExactMatch && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-muted)]">
              Not found in this list: <strong>&ldquo;{search.trim()}&rdquo;</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => openAddModal(search.trim())}
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add &ldquo;{search.trim()}&rdquo; as new option</span>
          </button>
        </div>
      )}

      {/* Status Feedback banner */}
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 4. Display list of items */}
      <div className="rounded-lg border border-[var(--color-line)] bg-white p-3.5">
        <div className="mb-2.5 flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
            {search.trim() && ` matching "${search.trim()}" (out of ${activeItems.length})`}
          </span>
          {isPending && (
            <span className="flex items-center gap-1 text-[var(--color-brand)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving changes…
            </span>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-sm">
            {search.trim() ? (
              <div>
                <p className="text-[var(--color-muted)]">
                  No matching options for &ldquo;{search.trim()}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => openAddModal(search.trim())}
                  className="btn-primary mt-3 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add &ldquo;{search.trim()}&rdquo; now</span>
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[var(--color-muted)]">
                  No options in {activeConfig.label} yet.
                </p>
                <button
                  type="button"
                  onClick={() => openAddModal()}
                  className="btn-secondary mt-3 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add the first option</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredItems.map((item) => (
              <div
                key={item}
                className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] py-1 pl-3 pr-1.5 text-xs text-[var(--color-ink)] transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                <span className="font-medium">{item}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item)}
                  disabled={isPending}
                  title={`Remove "${item}"`}
                  aria-label={`Remove ${item}`}
                  className="rounded-full p-0.5 text-[var(--color-muted)] hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. "Add New" Pop-up Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-modal-title"
            className="card w-full max-w-md p-5 shadow-xl transition-all scale-100"
          >
            <div className="flex items-start justify-between border-b border-[var(--color-line)] pb-3">
              <div>
                <h3 id="add-modal-title" className="text-base font-semibold text-[var(--color-ink)]">
                  Add new option
                </h3>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  Adding to <strong>{activeConfig.label}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-ink)] transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="new-picklist-item">
                  Option value
                </label>
                <input
                  ref={modalInputRef}
                  id="new-picklist-item"
                  type="text"
                  required
                  value={newItemValue}
                  onChange={(e) => {
                    setNewItemValue(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  placeholder="e.g. Festival Special"
                  className="input mt-1"
                />
                {modalError && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{modalError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary gap-1.5"
                  disabled={isPending || !newItemValue.trim()}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add option</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
