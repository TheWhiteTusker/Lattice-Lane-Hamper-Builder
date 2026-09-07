"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadSettings, mergeList } from "@/lib/settings";
import { buildImport, type ImportInput } from "@/lib/import";
import { describeError } from "@/lib/forms";

export type ImportReport = {
  ok: boolean;
  applied: boolean;
  counts?: Record<string, number>;
  warnings?: string[];
  error?: string;
};

const CHUNK = 500;

async function inChunks<T>(rows: T[], fn: (batch: T[]) => PromiseLike<{ error: unknown }>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await fn(rows.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

/**
 * Dry run by default. Nothing is written unless `apply` is true, so the page
 * can show exactly what will land before anyone commits to it.
 *
 * Everything is upserted on the natural key (product code, hamper code,
 * document number), which makes re-running the import safe: a second pass
 * updates rather than duplicates.
 */
export async function runImport(
  input: ImportInput,
  apply: boolean,
): Promise<ImportReport> {
  const result = buildImport(input);

  if (!apply) {
    return { ok: true, applied: false, counts: result.counts, warnings: result.warnings };
  }

  const supabase = await createClient();

  try {
    // ---- categories ------------------------------------------------
    if (result.categories.length) {
      await inChunks(result.categories, (batch) =>
        supabase.from("categories").upsert(batch, { onConflict: "name" }),
      );
    }

    const { data: categoryRows } = await supabase.from("categories").select("id, name");
    const categoryId = new Map(
      (categoryRows ?? []).map((c: { id: string; name: string }) => [
        c.name.trim().toLowerCase(),
        c.id,
      ]),
    );

    // ---- products --------------------------------------------------
    if (result.products.length) {
      const rows = result.products.map(({ category_name, ...p }) => ({
        ...p,
        category_id: category_name
          ? (categoryId.get(category_name.trim().toLowerCase()) ?? null)
          : null,
      }));

      await inChunks(rows, (batch) =>
        supabase.from("products").upsert(batch, { onConflict: "code" }),
      );
    }

    // ---- hampers ---------------------------------------------------
    if (result.hampers.length) {
      await inChunks(result.hampers, (batch) =>
        supabase.from("hampers").upsert(batch, { onConflict: "code" }),
      );
    }

    const { data: hamperRows } = await supabase.from("hampers").select("id, code");
    const hamperId = new Map(
      (hamperRows ?? []).map((h: { id: string; code: string }) => [h.code, h.id]),
    );

    const { data: productRows } = await supabase.from("products").select("id, code");
    const productId = new Map(
      (productRows ?? []).map((p: { id: string; code: string }) => [p.code, p.id]),
    );

    if (result.hamperItems.length) {
      // Replace the lines of every hamper being imported, so a re-run does not
      // append a second copy of each line.
      const touched = [...new Set(result.hamperItems.map((i) => i.hamper_code))]
        .map((code) => hamperId.get(code))
        .filter((id): id is string => !!id);

      for (let i = 0; i < touched.length; i += CHUNK) {
        const { error } = await supabase
          .from("hamper_items")
          .delete()
          .in("hamper_id", touched.slice(i, i + CHUNK));
        if (error) throw error;
      }

      const rows = result.hamperItems
        .filter((i) => hamperId.has(i.hamper_code))
        .map(({ hamper_code, product_code, ...item }) => ({
          ...item,
          product_code,
          hamper_id: hamperId.get(hamper_code)!,
          product_id: product_code ? (productId.get(product_code) ?? null) : null,
        }));

      await inChunks(rows, (batch) => supabase.from("hamper_items").insert(batch));
    }

    // ---- quotes ----------------------------------------------------
    if (result.quotes.length) {
      await inChunks(result.quotes, (batch) =>
        supabase.from("quotes").upsert(batch, { onConflict: "doc_no" }),
      );
    }

    const { data: quoteRows } = await supabase.from("quotes").select("id, doc_no");
    const quoteId = new Map(
      (quoteRows ?? []).map((q: { id: string; doc_no: string }) => [q.doc_no, q.id]),
    );

    if (result.quoteItems.length) {
      const touched = [...new Set(result.quoteItems.map((i) => i.doc_no))]
        .map((docNo) => quoteId.get(docNo))
        .filter((id): id is string => !!id);

      for (let i = 0; i < touched.length; i += CHUNK) {
        const { error } = await supabase
          .from("quote_items")
          .delete()
          .in("quote_id", touched.slice(i, i + CHUNK));
        if (error) throw error;
      }

      const rows = result.quoteItems
        .filter((i) => quoteId.has(i.doc_no))
        .map(({ doc_no, hamper_code, ...item }) => ({
          ...item,
          hamper_code,
          quote_id: quoteId.get(doc_no)!,
          hamper_id: hamper_code ? (hamperId.get(hamper_code) ?? null) : null,
        }));

      await inChunks(rows, (batch) => supabase.from("quote_items").insert(batch));
    }

    // ---- pick-lists ------------------------------------------------
    // Real strings from the spreadsheet beat the defaults we guessed at.
    const settings = await loadSettings(supabase);

    const updates: { key: string; value: unknown }[] = [
      { key: "collections", value: mergeList(settings.collections, result.hampers.map((h) => h.collection)) },
      { key: "sources", value: mergeList(settings.sources, result.products.map((p) => p.source)) },
      { key: "hamper_statuses", value: mergeList(settings.hamper_statuses, result.hampers.map((h) => h.status)) },
      { key: "quote_statuses", value: mergeList(settings.quote_statuses, result.quotes.map((q) => q.status)) },
      { key: "quote_structures", value: mergeList(settings.quote_structures, result.quotes.map((q) => q.quote_structure)) },
      { key: "validity_options", value: mergeList(settings.validity_options, result.quotes.map((q) => q.validity)) },
      { key: "detail_modes", value: mergeList(settings.detail_modes, [result.defaultDetailMode, ...result.quoteItems.map((i) => i.detail_mode)]) },
      { key: "packaging_treatments", value: mergeList(settings.packaging_treatments, result.quoteItems.map((i) => i.packaging_treatment)) },
    ];

    if (result.defaultDetailMode) {
      updates.push({ key: "default_detail_mode", value: result.defaultDetailMode });
    }

    const { error: settingsError } = await supabase.from("app_settings").upsert(updates, {
      onConflict: "key",
    });
    if (settingsError) throw settingsError;

    // ---- numbering -------------------------------------------------
    // Continue from the highest imported H### / LLQT-### / LLPI-###.
    const { error: counterError } = await supabase.rpc("sync_doc_counters");
    if (counterError) throw counterError;
  } catch (error) {
    return { ok: false, applied: false, error: describeError(error) };
  }

  revalidatePath("/", "layout");

  return { ok: true, applied: true, counts: result.counts, warnings: result.warnings };
}
