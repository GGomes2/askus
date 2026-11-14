import { APP_NAME } from "@askwell/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur-xl">
        <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-3 text-base text-neutral-300">The application is ready for its next phase.</p>
      </div>
    </main>
  );
}
