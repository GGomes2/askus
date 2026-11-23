"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-neutral-100 p-8 text-neutral-950">
      <h1 className="text-2xl font-semibold">Couldn’t load the dashboard</h1>
      <button type="button" onClick={reset} className="mt-4 rounded-lg border border-black/15 bg-white px-3 py-2">
        Try again
      </button>
    </main>
  );
}
