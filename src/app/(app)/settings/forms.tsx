"use client";

import { useActionState } from "react";
import {
  saveCompany,
  saveTerms,
  saveList,
  saveDefault,
  saveCategory,
  deleteCategory,
  setUserRole,
} from "./actions";
import type { ActionState } from "@/lib/forms";
import type { Category, CompanySettings, Profile, UserRole } from "@/lib/types";
import { round2 } from "@/lib/pricing";

function Status({ state, pending }: { state: ActionState; pending: boolean }) {
  if (pending) return <span className="text-sm text-[var(--color-muted)]">Saving…</span>;
  if (state.error)
    return (
      <span role="alert" className="text-sm text-red-700">
        {state.error}
      </span>
    );
  if (state.ok) return <span className="text-sm text-green-800">Saved</span>;
  return null;
}

export function CompanyForm({
  company,
  gstRate,
}: {
  company: CompanySettings;
  gstRate: number;
}) {
  const [state, action, pending] = useActionState(saveCompany, {});

  return (
    <form action={action} className="card p-4">
      <h2 className="text-sm font-semibold">Company details</h2>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
        Printed at the top of every quotation and proforma invoice.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="company-name">
            Company name
          </label>
          <input id="company-name" name="name" defaultValue={company.name} className="input mt-1" required />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="company-address">
            Address
          </label>
          <textarea
            id="company-address"
            name="address"
            rows={2}
            defaultValue={company.address}
            className="input mt-1"
          />
        </div>

        <div>
          <label className="label" htmlFor="company-gstin">
            GSTIN
          </label>
          <input id="company-gstin" name="gstin" defaultValue={company.gstin} className="input mt-1 font-mono" />
        </div>

        <div>
          <label className="label" htmlFor="company-phone">
            Phone
          </label>
          <input id="company-phone" name="phone" defaultValue={company.phone} className="input mt-1" />
        </div>

        <div>
          <label className="label" htmlFor="company-email">
            Email
          </label>
          <input id="company-email" name="email" defaultValue={company.email} className="input mt-1" />
        </div>

        <div>
          <label className="label" htmlFor="company-website">
            Website
          </label>
          <input id="company-website" name="website" defaultValue={company.website} className="input mt-1" />
        </div>

        <div>
          <label className="label" htmlFor="gst_rate">
            Default GST %
          </label>
          <input
            id="gst_rate"
            name="gst_rate"
            inputMode="decimal"
            defaultValue={String(round2(gstRate * 100))}
            className="input input-num mt-1"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          Save
        </button>
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function TermsForm({ terms }: { terms: string }) {
  const [state, action, pending] = useActionState(saveTerms, {});

  return (
    <form action={action} className="card p-4">
      <h2 className="text-sm font-semibold">Default quotation terms</h2>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
        Copied into each new quotation, where it can still be edited.
      </p>

      <textarea
        name="quote_terms"
        rows={6}
        defaultValue={terms}
        className="input mt-3"
        aria-label="Default quotation terms"
      />

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          Save
        </button>
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function ListForm({
  settingKey,
  label,
  hint,
  values,
}: {
  settingKey: string;
  label: string;
  hint?: string;
  values: string[];
}) {
  const [state, action, pending] = useActionState(saveList, {});

  return (
    <form action={action} className="rounded-md border border-[var(--color-line)] p-3">
      <input type="hidden" name="key" value={settingKey} />

      <label className="label" htmlFor={`list-${settingKey}`}>
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p>}

      <textarea
        id={`list-${settingKey}`}
        name="values"
        rows={Math.min(Math.max(values.length + 1, 3), 8)}
        defaultValue={values.join("\n")}
        className="input mt-2 font-mono text-xs"
      />

      <div className="mt-2 flex items-center gap-3">
        <button type="submit" className="btn-secondary" disabled={pending}>
          Save
        </button>
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function DefaultForm({
  settingKey,
  label,
  value,
  options,
}: {
  settingKey: string;
  label: string;
  value: string;
  options: string[];
}) {
  const [state, action, pending] = useActionState(saveDefault, {});

  return (
    <form action={action} className="rounded-md border border-[var(--color-line)] p-3">
      <input type="hidden" name="key" value={settingKey} />

      <label className="label" htmlFor={`default-${settingKey}`}>
        {label}
      </label>

      <select
        id={`default-${settingKey}`}
        name="value"
        defaultValue={value}
        className="select mt-2"
      >
        {Array.from(new Set([...options, value].filter(Boolean))).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <div className="mt-2 flex items-center gap-3">
        <button type="submit" className="btn-secondary" disabled={pending}>
          Save
        </button>
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function CategoryRow({ category }: { category: Category }) {
  const [state, action, pending] = useActionState(saveCategory, {});
  const [delState, delAction, deleting] = useActionState(deleteCategory, {});

  return (
    <tr>
      <td colSpan={4} className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
          <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={category.id} />
            <input type="hidden" name="sort_order" value={category.sort_order} />

            <input
              name="name"
              defaultValue={category.name}
              aria-label="Category name"
              className="input max-w-[240px]"
            />

            <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                name="counts_as_item"
                defaultChecked={category.counts_as_item}
              />
              Counts as an item
            </label>

            <button type="submit" className="btn-secondary" disabled={pending}>
              Save
            </button>
            <Status state={state} pending={pending} />
          </form>

          <form action={delAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={category.id} />
            <button type="submit" className="btn-danger" disabled={deleting}>
              Delete
            </button>
            {delState.error && (
              <span role="alert" className="text-sm text-red-700">
                {delState.error}
              </span>
            )}
          </form>
        </div>
      </td>
    </tr>
  );
}

export function AddCategoryForm({ nextSortOrder }: { nextSortOrder: number }) {
  const [state, action, pending] = useActionState(saveCategory, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 p-3">
      <input type="hidden" name="sort_order" value={nextSortOrder} />

      <input
        name="name"
        placeholder="New category name"
        aria-label="New category name"
        className="input max-w-[240px]"
        required
      />

      <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
        <input type="checkbox" name="counts_as_item" defaultChecked />
        Counts as an item
      </label>

      <button type="submit" className="btn-primary" disabled={pending}>
        Add category
      </button>
      <Status state={state} pending={pending} />
    </form>
  );
}

const ROLE_HINT: Record<UserRole, string> = {
  admin: "Everything, including products, settings and users",
  manager: "Hampers, all quotations, and quote status",
  sales: "Their own quotations",
};

export function UserRoleForm({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const [state, action, pending] = useActionState(setUserRole, {});

  return (
    <tr>
      <td>
        {profile.full_name || "—"}
        {isSelf && <span className="badge ml-2">you</span>}
      </td>
      <td className="text-[var(--color-muted)]">{ROLE_HINT[profile.role]}</td>
      <td>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={profile.id} />
          <select name="role" defaultValue={profile.role} className="select max-w-[140px]">
            <option value="sales">Sales</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="btn-secondary" disabled={pending}>
            Save
          </button>
          <Status state={state} pending={pending} />
        </form>
      </td>
    </tr>
  );
}
