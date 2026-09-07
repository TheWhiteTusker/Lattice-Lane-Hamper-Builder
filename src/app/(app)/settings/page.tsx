import Link from "next/link";
import { requireRole } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import {
  CompanyForm,
  TermsForm,
  ListForm,
  DefaultForm,
  CategoryRow,
  AddCategoryForm,
  UserRoleForm,
} from "./forms";
import type { Category, Profile } from "@/lib/types";

export default async function SettingsPage() {
  const { supabase, profile } = await requireRole("admin");

  const [settings, { data: categories }, { data: profiles }] = await Promise.all([
    loadSettings(supabase),
    supabase.from("categories").select("*").order("sort_order").order("name").returns<Category[]>(),
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
  ]);

  const nextSortOrder = (categories ?? []).reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;

  return (
    <>
      <PageHeader title="Settings" subtitle="Company details, categories, pick-lists and users">
        <Link href="/admin/import" className="btn-secondary">
          Import spreadsheet
        </Link>
        <Link href="/admin/refresh-prices" className="btn-secondary">
          Refresh prices
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <CompanyForm company={settings.company} gstRate={settings.gst_rate} />
        <TermsForm terms={settings.quote_terms} />
      </div>

      {/* ---------------- categories ---------------- */}
      <section className="card mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="text-sm font-semibold">Categories</h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            &ldquo;Counts as an item&rdquo; decides what goes into a hamper&rsquo;s item count.
            Turn it off for boxes, filler and ribbon: they add cost, but a client does not
            count the box as one of the gifts.
          </p>
        </div>

        <table className="table">
          <tbody>
            {(categories ?? []).map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </tbody>
        </table>

        {(categories ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-[var(--color-muted)]">
            No categories yet. Import the Settings tab, or add them here.
          </p>
        )}

        <div className="border-t border-[var(--color-line)]">
          <AddCategoryForm nextSortOrder={nextSortOrder} />
        </div>
      </section>

      {/* ---------------- pick-lists ---------------- */}
      <section className="card mt-4 p-4">
        <h2 className="text-sm font-semibold">Pick-lists</h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          One value per line. These fill the dropdowns across the app.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ListForm
            settingKey="hamper_statuses"
            label="Hamper statuses"
            values={settings.hamper_statuses}
          />
          <ListForm
            settingKey="quote_statuses"
            label="Quotation statuses"
            hint="Only managers can move a quotation between these."
            values={settings.quote_statuses}
          />
          <ListForm
            settingKey="quote_structures"
            label="Quote structures"
            hint='Only "Combined Order" produces an order total.'
            values={settings.quote_structures}
          />
          <ListForm
            settingKey="collections"
            label="Collections / occasions"
            values={settings.collections}
          />
          <ListForm settingKey="sources" label="Sources / vendors" values={settings.sources} />
          <ListForm
            settingKey="validity_options"
            label="Validity options"
            values={settings.validity_options}
          />
          <ListForm
            settingKey="detail_modes"
            label="Contents shown on a quotation"
            hint='Anything containing "hide" hides contents, "summary" prints a count.'
            values={settings.detail_modes}
          />
          <ListForm
            settingKey="packaging_treatments"
            label="Packaging treatments"
            hint='Anything containing "absorb" folds packaging into the hamper.'
            values={settings.packaging_treatments}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <DefaultForm
            settingKey="default_detail_mode"
            label="Default contents setting"
            value={settings.default_detail_mode}
            options={settings.detail_modes}
          />
          <DefaultForm
            settingKey="default_packaging_treatment"
            label="Default packaging treatment"
            value={settings.default_packaging_treatment}
            options={settings.packaging_treatments}
          />
          <DefaultForm
            settingKey="default_validity"
            label="Default validity"
            value={settings.default_validity}
            options={settings.validity_options}
          />
        </div>
      </section>

      {/* ---------------- users ---------------- */}
      <section className="card mt-4 overflow-hidden">
        <div className="border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="text-sm font-semibold">Users</h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            People sign up themselves and start as Sales. Once your team is set up, turn off
            new sign-ups in the Supabase dashboard under Authentication → Providers.
          </p>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Can access</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <UserRoleForm key={p.id} profile={p} isSelf={p.id === profile.id} />
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
