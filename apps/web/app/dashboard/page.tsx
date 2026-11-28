import { auth } from "@clerk/nextjs/server";
import { DashboardShell } from "../../components/dashboard/shell";
import { provisionAccount } from "../../lib/accounts/provision";

export default async function Dashboard() {
  const { userId } = await auth.protect();
  await provisionAccount(userId);

  return (
    <DashboardShell>
      <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
      <section id="projects" aria-labelledby="projects-heading" className="mt-8 rounded-2xl border border-black/10 bg-white/75 p-6 shadow-sm backdrop-blur-xl sm:p-8">
        <h2 id="projects-heading" className="text-xl font-semibold">Projects</h2>
        <p className="mt-2 text-neutral-600">No projects yet.</p>
      </section>
    </DashboardShell>
  );
}
