// Shown the moment a nav link is clicked, while the page's data loads.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-8 w-64 rounded-md bg-slate-200" />
      <div className="card h-96" />
    </div>
  );
}
