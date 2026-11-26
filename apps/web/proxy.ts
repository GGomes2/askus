import { clerkMiddleware } from "@clerk/nextjs/server";
import type { ApiError } from "@askwell/shared";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isOwnerApi = /^\/api\/(projects|knowledge|conversations)(\/|$)/;
const isDashboard = /^\/dashboard(\/|$)/;
const isAuthPage = /^\/(sign-in|sign-up)(\/|$)/;

const authenticate = clerkMiddleware(async (auth, request) => {
  const { userId, redirectToSignIn } = await auth();
  if (userId) return NextResponse.next();

  if (isDashboard.test(request.nextUrl.pathname)) return redirectToSignIn();
  if (isOwnerApi.test(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } } satisfies ApiError,
      { status: 401 },
    );
  }

  return NextResponse.next();
}, { signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const needsClerk = isDashboard.test(pathname) || isOwnerApi.test(pathname) || isAuthPage.test(pathname);
  const response = (needsClerk ? await authenticate(request, event) : null) ?? NextResponse.next();

  if (pathname !== "/embed" && pathname !== "/embed/") {
    response.headers.append("Content-Security-Policy", "frame-ancestors 'self'");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
