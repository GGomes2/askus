import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./page";

const { protect, from, upsert } = vi.hoisted(() => ({
  protect: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect } }));
vi.mock("../../components/dashboard/shell", () => ({ DashboardShell: () => null }));
vi.mock("../../lib/supabase/service", () => ({ createServiceClient: () => ({ from }) }));

const userId = "user_test";

beforeEach(() => {
  vi.resetAllMocks();
  protect.mockResolvedValue({ userId });
  from.mockReturnValue({ upsert });
  upsert.mockResolvedValue({ error: null });
});

describe("dashboard account provisioning", () => {
  it("provisions Free using the verified Clerk user ID before rendering", async () => {
    await Dashboard();

    expect(from).toHaveBeenCalledExactlyOnceWith("accounts");
    expect(upsert).toHaveBeenCalledExactlyOnceWith(
      { clerk_user_id: userId, plan: "free" },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );
  });

  it.each([undefined, "pro"] as const)(
    "keeps one account on parallel visits with initial plan %s",
    async (initialPlan) => {
      const accounts = new Map<string, string>();
      if (initialPlan) accounts.set(userId, initialPlan);
      upsert.mockImplementation(async ({ clerk_user_id, plan }, { onConflict, ignoreDuplicates }) => {
        if (onConflict !== "clerk_user_id") throw new Error("Unexpected conflict target");
        if (!ignoreDuplicates || !accounts.has(clerk_user_id)) accounts.set(clerk_user_id, plan);
        return { error: null };
      });

      await Promise.all([Dashboard(), Dashboard()]);
      await Dashboard();

      expect(upsert).toHaveBeenCalledTimes(3);
      expect([...accounts]).toEqual([[userId, initialPlan ?? "free"]]);
    },
  );

  it("skips the database when Clerk rejects the session", async () => {
    const redirect = new Error("Sign-in redirect");
    protect.mockRejectedValue(redirect);

    await expect(Dashboard()).rejects.toBe(redirect);
    expect(from).not.toHaveBeenCalled();
  });

  it("fails dashboard entry when the account write fails", async () => {
    const error = { code: "42501", message: "permission denied" };
    upsert.mockResolvedValue({ error });

    await expect(Dashboard()).rejects.toMatchObject({ cause: error });
  });
});
