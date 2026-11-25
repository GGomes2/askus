import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asApiRole, createTestDatabase } from "../supabase-pglite";

const tables = {
  accounts: "clerk_user_id",
  projects: "owner_id",
  widget_configs: "label",
  knowledge_sources: "title",
  knowledge_chunks: "content",
  conversations: "visitor_id",
  messages: "body",
} as const;

const alice = "user_alice";
const bob = "user_bob";
const asOwner = (subject: string | null) => ({ role: "authenticated", subject }) as const;
const aliceProject = "c56cea7d-39da-446e-b441-528374fbbfa1";
const asService = { role: "service_role" } as const;
const asAnon = { role: "anon" } as const;
const permissionDenied = { code: "42501" };

describe("initial schema", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDatabase();
    await asApiRole(db, asService, async (tx) => {
      await tx.query("insert into public.accounts (clerk_user_id) values ($1), ($2)", [alice, bob]);
      await tx.query(
        "insert into public.projects (id, owner_id, name, public_key) values ($1, $2, 'Alice project', 'pk_alice'), (gen_random_uuid(), $3, 'Bob project', 'pk_bob')",
        [aliceProject, alice, bob],
      );
      await tx.exec(`
        insert into public.widget_configs (project_id, button_color, label, header_text)
          select id, '#000000', owner_id, name from public.projects;
        insert into public.knowledge_sources (project_id, title, type, status)
          select id, owner_id, 'text', 'ready' from public.projects;
        insert into public.knowledge_chunks (project_id, source_id, content, embedding)
          select project_id, id, title, ('[1,' || repeat('0,', 1534) || '0]')::extensions.vector
          from public.knowledge_sources;
        insert into public.conversations (project_id, visitor_id)
          select id, owner_id from public.projects;
        insert into public.messages (conversation_id, role, body)
          select id, 'visitor', visitor_id from public.conversations;
      `);
    });
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it.each(Object.entries(tables))("scopes %s to each Clerk subject", async (table, ownerColumn) => {
    const sql = `select ${ownerColumn} as subject from public.${table} order by subject`;
    for (const subject of [alice, bob]) {
      const result = await asApiRole(db, asOwner(subject), (tx) => tx.query(sql));
      expect(result.rows).toEqual([{ subject }]);
    }
    expect((await asApiRole(db, asOwner(null), (tx) => tx.query(sql))).rows).toEqual([]);
    expect((await asApiRole(db, asService, (tx) => tx.query(sql))).rows).toEqual([
      { subject: alice },
      { subject: bob },
    ]);
    await expect(asApiRole(db, asAnon, (tx) => tx.query(sql))).rejects.toMatchObject(permissionDenied);
  });

  it("allows renaming only the caller's project", async () => {
    await asApiRole(db, asOwner(alice), async (tx) => {
      expect((await tx.query("update public.projects set name = 'B' where public_key = 'pk_bob'")).affectedRows).toBe(0);
      expect((await tx.query("update public.projects set name = 'Renamed' returning name")).rows).toEqual([
        { name: "Renamed" },
      ]);
    });
  });

  it.each([
    ["update public.projects set owner_id = 'user_bob'"],
    ["update public.projects set public_key = 'pk_changed'"],
    ["insert into public.projects (owner_id, name, public_key) values ('user_alice', 'Second', 'pk_second')"],
    ["update public.accounts set plan = 'pro'"],
    ["update public.widget_configs set show_badge = false"],
    ["delete from public.knowledge_sources"],
    ["delete from public.knowledge_chunks"],
    ["delete from public.conversations"],
    ["delete from public.messages"],
    ["select private.owned_project_ids()"],
    ["select private.owned_conversation_ids()"],
    ["truncate public.projects cascade"],
  ])("rejects an unauthorized owner operation: %s", async (sql) => {
    await expect(asApiRole(db, asOwner(alice), (tx) => tx.exec(sql))).rejects.toMatchObject(permissionDenied);
  });

  it("denies TRUNCATE to the service role too", async () => {
    await expect(asApiRole(db, asService, (tx) => tx.exec("truncate public.projects cascade")))
      .rejects.toMatchObject(permissionDenied);
  });

  it("rejects a chunk whose project disagrees with its source", async () => {
    await expect(asApiRole(db, asService, (tx) => tx.query(
      `insert into public.knowledge_chunks (project_id, source_id, content, embedding)
       select $1, source_id, content, embedding from public.knowledge_chunks where project_id <> $1`,
      [aliceProject],
    ))).rejects.toMatchObject({ code: "23503" });
  });

  it("creates a cosine HNSW index on embeddings", async () => {
    const { rows } = await db.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and indexname = 'knowledge_chunks_embedding_hnsw_idx'",
    );
    expect(rows[0]?.indexdef).toMatch(/using hnsw \(embedding .*vector_cosine_ops\)/i);
  });

  it("allows deleting the caller's project and cascades to its dependents", async () => {
    await asApiRole(db, asOwner(alice), async (tx) => {
      expect((await tx.query("delete from public.projects where public_key = 'pk_bob'")).affectedRows).toBe(0);
      expect((await tx.query("delete from public.projects returning id")).rows).toEqual([{ id: aliceProject }]);
    });
    await asApiRole(db, asService, async (tx) => {
      for (const [table, ownerColumn] of Object.entries(tables)) {
        if (table === "accounts") continue;
        expect((await tx.query(`select ${ownerColumn} as subject from public.${table}`)).rows)
          .toEqual([{ subject: bob }]);
      }
    });
  });
});
