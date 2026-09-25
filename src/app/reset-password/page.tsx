import { Suspense } from "react";
import { ResetForm } from "./reset-form";

// Same reasoning as /login: rendered on the Worker so markup and JS chunks
// always come from the same build. See login/page.tsx.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <Suspense
        fallback={
          <div className="w-full max-w-sm p-6 text-center">
            <h1 className="text-lg font-semibold tracking-wider text-amber-100">Lattice Lane</h1>
            <p className="mt-1 text-xs text-neutral-500">Opening your reset link…</p>
          </div>
        }
      >
        <ResetForm />
      </Suspense>
    </main>
  );
}
