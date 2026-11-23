import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { APP_NAME } from "@askwell/shared";
import "./globals.css";

export const metadata: Metadata = { title: APP_NAME, description: "AI support chat for your website" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/dashboard"
          afterSignOutUrl="/sign-in"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
