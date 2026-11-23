import { APP_NAME } from "@askwell/shared";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 [color-scheme:light]">
      <header className="border-b border-black/10 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link className="text-xl font-bold tracking-tight" href="/dashboard">{APP_NAME}</Link>
          <nav aria-label="Dashboard" className="flex items-center gap-4 text-sm">
            <a className="hover:underline" href="#projects">Projects</a>
            <SignOutButton redirectUrl="/sign-in">
              <button type="button" className="rounded-lg border border-black/15 bg-white px-3 py-2 font-medium hover:bg-neutral-100">
                Sign out
              </button>
            </SignOutButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">{children}</main>
    </div>
  );
}
