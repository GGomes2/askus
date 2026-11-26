import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asApiRole, createTestDatabase } from "../supabase-pglite";

const alice = "user_alice";
const bob = "user_bob";
const aliceProject = "c56cea7d-39da-446e-b441-528374fbbfa1";
const bobProject = "e56cea7d-39da-446e-b441-528374fbbfa1";
const bobConversation = "56d06d9b-9ecc-4e39-be19-e665995618c2";
const asService = { role: "service_role" } as const;
const asOwner = (subject: string | null) => ({ role: "authenticated", subject }) as const;
const embedding = JSON.stringify([1, ...Array<number>(1535).fill(0)]);

describe("database functions", () => {
  let db: PGlite;

  const call = <T = unknown>(sql: string, params: unknown[] = []) =>
    asApiRole(db, asService, (tx) => tx.query<T>(sql, params));

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 30_000);

  beforeEach(async () => {
    await db.exec("truncate public.accounts cascade");
    await call("insert into public.accounts (clerk_user_id) values ($1), ($2), ('new_owner')", [alice, bob]);
    await call(
      `insert into public.projects (id, owner_id, name, public_key, messages_used, period_start)
       values ($1, $2, 'Alice project', 'pk_alice', 100, '2000-01-01'),
              ($3, $4, 'Bob project', 'pk_bob', 3, default)`,
      [aliceProject, alice, bobProject, bob],
    );
    await call(
      "insert into public.conversations (id, project_id, visitor_id) values ($1, $2, 'bob_visitor')",
      [bobConversation, bobProject],
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  it("creates one project and one default config at the quota boundary", async () => {
    const attempts = await Promise.allSettled(
      ["First", "Second"].map((name) =>
        call("select * from public.create_project('new_owner', $1, 1)", [name]),
      ),
    );
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find((result) => result.status === "rejected")).toMatchObject({
      reason: { message: "Project limit reached" },
    });
    const { rows } = await call(
      `select p.public_key, w.button_color, w.position, w.animation, w.show_badge
       from public.projects p join public.widget_configs w on w.project_id = p.id
       where p.owner_id = 'new_owner'`,
    );
    expect(rows).toEqual([{
      public_key: expect.stringMatching(/^pk_[a-f0-9]{32}$/),
      button_color: "#000000", position: "bottom-right", animation: "fade", show_badge: true,
    }]);
  });

  it("shares a source quota between text and pending uploads", async () => {
    const reserve = "select * from public.reserve_knowledge_source($1, 'Source', $2, 2)";
    const text = await call(reserve, [aliceProject, "text"]);
    expect(text.rows).toEqual([expect.objectContaining({ status: "processing", storage_key: null })]);

    const attempts = await Promise.allSettled(
      ["pdf", "md"].map((type) => call<{ id: string; type: string; storage_key: string; status: string }>(
        reserve, [aliceProject, type],
      )),
    );
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const upload = attempts.find((result) => result.status === "fulfilled")?.value.rows[0];
    expect(upload).toMatchObject({ status: "uploading" });
    expect(upload?.storage_key).toBe(`${aliceProject}/${upload?.id}.${upload?.type}`);
    expect(attempts.find((result) => result.status === "rejected")).toMatchObject({
      reason: { message: "Knowledge source limit reached" },
    });
    expect((await call("select count(*)::integer as count from public.knowledge_sources")).rows)
      .toEqual([{ count: 2 }]);
  });

  it("resets monthly usage in UTC and charges only the remaining capacity", async () => {
    const consume = "select public.consume_message($1, 1) as accepted";
    const outcomes = await Promise.all([call(consume, [aliceProject]), call(consume, [aliceProject])]);
    expect(outcomes.flatMap(({ rows }) => rows)).toEqual([{ accepted: true }, { accepted: false }]);
    const { rows } = await call(
      `select messages_used, period_start = date_trunc('month', now() at time zone 'UTC')::date as current
       from public.projects where id = $1`,
      [aliceProject],
    );
    expect(rows).toEqual([{ messages_used: 1, current: true }]);
  });

  it("refuses to charge an existing conversation against a different project", async () => {
    await expect(call("select public.consume_message($1, 100, $2)", [aliceProject, bobConversation]))
      .rejects.toMatchObject({ code: "P0002" });
    expect((await call("select messages_used from public.projects where id = $1", [aliceProject])).rows)
      .toEqual([{ messages_used: 100 }]);
  });

  it("saves paired messages in order and rolls back a failed turn", async () => {
    const save = "select public.save_chat_turn($1, 'visitor', $2, $3, $4) as id";
    await expect(call(save, [aliceProject, "Fail", null, null])).rejects.toMatchObject({ code: "23502" });
    expect((await call("select id from public.conversations where project_id = $1", [aliceProject])).rows)
      .toEqual([]);

    const first = await call<{ id: string }>(save, [aliceProject, "Question", "Reply", null]);
    const id = first.rows[0]?.id;
    expect(id).toEqual(expect.any(String));
    expect((await call(save, [aliceProject, "Follow up", "Second reply", id])).rows).toEqual([{ id }]);
    await expect(call(save, [aliceProject, "Fail", null, id])).rejects.toMatchObject({ code: "23502" });
    await expect(call(save, [aliceProject, "Wrong project", "Fail", bobConversation]))
      .rejects.toMatchObject({ code: "P0002" });

    expect((await call(
      "select role, body from public.messages where conversation_id = $1 order by created_at", [id],
    )).rows).toEqual([
      { role: "visitor", body: "Question" }, { role: "bot", body: "Reply" },
      { role: "visitor", body: "Follow up" }, { role: "bot", body: "Second reply" },
    ]);
    expect((await call("select id from public.messages where conversation_id = $1", [bobConversation])).rows)
      .toEqual([]);
  });

  it("returns the five best ready chunks from the requested project", async () => {
    await call(
      `insert into public.knowledge_sources (project_id, title, type, status, storage_key)
       values ($1, 'Ready', 'text', 'ready', null), ($1, 'Processing', 'text', 'processing', null),
              ($1, 'Failed', 'text', 'failed', null), ($1, 'Uploading', 'txt', 'uploading', 'pending.txt'),
              ($2, 'Other tenant', 'text', 'ready', null)`,
      [aliceProject, bobProject],
    );
    await call(
      `insert into public.knowledge_chunks (project_id, source_id, content, embedding)
       select project_id, id, title || rank,
         case when title = 'Ready'
           then ('[1,' || rank || ',' || repeat('0,', 1533) || '0]')::extensions.vector
           else $1::extensions.vector
         end
       from public.knowledge_sources
       cross join lateral generate_series(1, case when title = 'Ready' then 6 else 1 end) as rank`,
      [embedding],
    );
    const { rows } = await call("select content from public.match_chunks($1, $2)", [aliceProject, embedding]);
    expect(rows).toEqual([1, 2, 3, 4, 5].map((rank) => ({ content: `Ready${rank}` })));
  });

  it("reports activity only for projects visible to the caller", async () => {
    await call("select public.reserve_knowledge_source($1, 'Source', 'text', 1)", [aliceProject]);
    for (const [subject, project_id, messages_used, knowledge_sources, conversations] of [
      [alice, aliceProject, 0, 1, 0], [bob, bobProject, 3, 0, 1],
    ] as const) {
      const { rows } = await asApiRole(db, asOwner(subject), (tx) => tx.query(
        "select project_id, messages_used, knowledge_sources::int, conversations::int from public.owner_activity()",
      ));
      expect(rows).toEqual([{ project_id, messages_used, knowledge_sources, conversations }]);
    }
    expect((await asApiRole(db, asOwner(null), (tx) => tx.query("select * from public.owner_activity()"))).rows)
      .toEqual([]);
  });

  it("limits each function to its documented roles and pins the search path", async () => {
    const { rows } = await db.query(
      `select proname, prosecdef, proconfig,
          has_function_privilege('anon', p.oid, 'execute') as anon,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
          has_function_privilege('service_role', p.oid, 'execute') as service_role
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' order by proname`,
    );
    expect(rows).toEqual([
      "consume_message", "create_project", "match_chunks", "owner_activity",
      "reserve_knowledge_source", "save_chat_turn",
    ].map((proname) => ({
      proname, prosecdef: false, proconfig: ['search_path=""'], anon: false,
      authenticated: proname === "owner_activity", service_role: true,
    })));
    await expect(asApiRole(db, { role: "anon" }, (tx) => tx.query("select * from public.owner_activity()")))
      .rejects.toMatchObject({ code: "42501" });
  });
});
