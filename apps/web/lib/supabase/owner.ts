import "server-only";

import type { Database } from "@askwell/db";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function createOwnerClient() {
  const { userId, getToken } = await auth({ acceptsToken: "session_token" });
  if (!userId) {
    throw new Error("A Clerk session is required to create an owner client.");
  }

  const token = await getToken();
  if (!token) {
    throw new Error("A Clerk session token is required to create an owner client.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
  }

  return createClient<Database>(url, key, {
    accessToken: async () => token,
  });
}
