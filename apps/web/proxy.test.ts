import { type NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import proxy from "./proxy";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: (authenticate: typeof auth, request: NextRequest) => unknown) =>
    (request: NextRequest) => handler(auth, request),
}));

const signInUrl = "https://askwell.example/sign-in";
const redirectToSignIn = vi.fn(() => NextResponse.redirect(signInUrl));

function request(path: string, method = "GET") {
  const req = new NextRequest(new URL(path, "https://askwell.example"), { method });
  return proxy(req, {} as NextFetchEvent);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: null, redirectToSignIn });
});

describe("dashboard authentication", () => {
  it.each(["/dashboard", "/dashboard/projects"])("redirects a signed-out visit to %s", async (path) => {
    const response = await request(path);
    expect(response.headers.get("location")).toBe(signInUrl);
    expect(redirectToSignIn).toHaveBeenCalledOnce();
  });

  it("allows a signed-in dashboard visit", async () => {
    auth.mockResolvedValue({ userId: "user_test", redirectToSignIn });
    const response = await request("/dashboard");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });
});

describe("owner API authentication", () => {
  it.each([
    ["GET", "/api/projects"],
    ["POST", "/api/projects"],
    ["PATCH", "/api/projects/project-1"],
    ["DELETE", "/api/projects/project-1"],
    ["POST", "/api/projects/project-1/knowledge"],
    ["POST", "/api/projects/project-1/knowledge/upload-url"],
    ["POST", "/api/projects/project-1/knowledge/finalize"],
    ["GET", "/api/projects/project-1/conversations"],
    ["PATCH", "/api/projects/project-1/config"],
    ["DELETE", "/api/knowledge/source-1"],
    ["GET", "/api/conversations/conversation-1"],
  ])("requires a session for %s %s", async (method, path) => {
    const response = await request(path, method);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it("passes authenticated requests to their handlers", async () => {
    auth.mockResolvedValue({ userId: "user_test", redirectToSignIn });
    expect((await request("/api/projects")).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("public and system routes", () => {
  it.each([
    ["GET", "/"],
    ["GET", "/api/widget/config"],
    ["POST", "/api/widget/chat"],
    ["POST", "/api/clerk/webhook"],
    ["GET", "/api/posthog-config"],
    ["GET", "/dashboard-preview"],
    ["GET", "/api/projects-public"],
  ])("leaves %s %s reachable without Clerk", async (method, path) => {
    expect((await request(path, method)).headers.get("x-middleware-next")).toBe("1");
    expect(auth).not.toHaveBeenCalled();
  });

  it.each(["/sign-in", "/sign-up", "/sign-in/sso-callback", "/sign-up/verify-email-address"])(
    "allows a signed-out visit to %s",
    async (path) => {
      expect((await request(path)).headers.get("x-middleware-next")).toBe("1");
      expect(redirectToSignIn).not.toHaveBeenCalled();
    },
  );

  it("allows external sites to frame the widget", async () => {
    const response = await request("/embed");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });
});
