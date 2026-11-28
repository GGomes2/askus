import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOwnerClient } from "./owner";
import { createServiceClient } from "./service";

const { auth, createClient } = vi.hoisted(() => ({
  auth: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const url = "https://dev.example.test";
const publishableKey = "publishable-test-key";
const secretKey = "secret-test-key";
const client = {};
const getToken = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey);
  vi.stubEnv("SUPABASE_SECRET_KEY", secretKey);
  auth.mockResolvedValue({ userId: "user_test", getToken });
  getToken.mockResolvedValue("clerk-session-token");
  createClient.mockReturnValue(client);
});

afterEach(() => vi.unstubAllEnvs());

describe("createOwnerClient", () => {
  it("uses the publishable key and the verified Clerk session token", async () => {
    expect(await createOwnerClient()).toBe(client);
    expect(auth).toHaveBeenCalledExactlyOnceWith({ acceptsToken: "session_token" });
    expect(getToken).toHaveBeenCalledExactlyOnceWith();
    expect(createClient).toHaveBeenCalledExactlyOnceWith(url, publishableKey, {
      accessToken: expect.any(Function),
    });
    expect(await createClient.mock.calls[0][2].accessToken()).toBe("clerk-session-token");
  });

  it("rejects a signed-out request before retrieving a token", async () => {
    auth.mockResolvedValue({ userId: null, getToken });

    await expect(createOwnerClient()).rejects.toThrow("A Clerk session is required");
    expect(getToken).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a missing token before constructing a client", async () => {
    getToken.mockResolvedValue(null);

    await expect(createOwnerClient()).rejects.toThrow("A Clerk session token is required");
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])(
    "rejects missing %s",
    async (name) => {
      vi.stubEnv(name, undefined);

      await expect(createOwnerClient()).rejects.toThrow(name);
      expect(createClient).not.toHaveBeenCalled();
    },
  );
});

describe("createServiceClient", () => {
  it("uses the secret key without Clerk or session persistence", () => {
    expect(createServiceClient()).toBe(client);
    expect(auth).not.toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledExactlyOnceWith(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"])("rejects missing %s", (name) => {
    vi.stubEnv(name, undefined);

    expect(() => createServiceClient()).toThrow(name);
    expect(createClient).not.toHaveBeenCalled();
  });
});
