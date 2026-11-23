import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 px-3 py-10 text-neutral-950 [color-scheme:light]">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <SignUp />
      </Suspense>
    </main>
  );
}
