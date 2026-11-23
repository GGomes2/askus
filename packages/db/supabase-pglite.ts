import { readdir, readFile } from "node:fs/promises";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const migrations = new URL("../../supabase/migrations/", import.meta.url);

export async function createTestDatabase() {
  const db = await PGlite.create({ extensions: { vector } });
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      grant usage on schema auth to anon, authenticated, service_role;

      create function auth.jwt() returns jsonb
      language sql stable set search_path = ''
      as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

      -- Model the legacy hosted defaults so omissions in a migration fail tests.
      alter default privileges in schema public
        grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public
        grant execute on functions to anon, authenticated, service_role;
    `);
    for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
      const sql = await readFile(new URL(file, migrations), "utf8");
      await db.transaction((tx) => tx.exec(sql));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export function asApiRole<T>(
  db: PGlite,
  identity: { role: "authenticated"; subject: string | null } | { role: "anon" | "service_role" },
  run: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${identity.role}`);
    const claims = {
      role: identity.role,
      ...("subject" in identity && identity.subject !== null ? { sub: identity.subject } : {}),
    };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    return run(tx);
  });
}
