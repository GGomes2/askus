import "server-only";

import { createServiceClient } from "../supabase/service";

export async function provisionAccount(clerkUserId: string): Promise<void> {
  const { error } = await createServiceClient()
    .from("accounts")
    .upsert(
      { clerk_user_id: clerkUserId, plan: "free" },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error("Unable to provision the account.", { cause: error });
  }
}
