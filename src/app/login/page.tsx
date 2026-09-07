import { Suspense } from "react";
import { LoginForm } from "./login-form";

// useSearchParams needs a Suspense boundary to be prerendered.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
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
