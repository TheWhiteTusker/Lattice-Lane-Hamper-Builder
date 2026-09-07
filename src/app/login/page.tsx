import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Rendered per request rather than prerendered.
 *
 * As a static page its HTML shipped as an uploaded asset, and Wrangler's
 * incremental asset upload left that HTML behind while replacing the JS
 * chunks around it. The stale page then asked for a chunk that no longer
 * existed, the request 404'd, React never hydrated, and the page sat on the
 * fallback below forever.
 *
 * Rendering on the Worker keeps the markup and the chunks it references from
 * the same build, always. Every other route in this app is already dynamic —
 * they read cookies — which is why this was the only page that broke. The cost
 * is nothing that matters: it is one small page, behind the proxy either way.
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      // useSearchParams still suspends, and the fallback matches the form's
      // sage ground so there is no white flash before it resolves.
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--color-brand)] px-4">
          <div className="card w-full max-w-sm p-6">
            <h1 className="text-lg font-semibold">Lattice Lane</h1>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">Loading…</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
