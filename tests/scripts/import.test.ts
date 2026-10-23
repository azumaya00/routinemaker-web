import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestContext } from "../server/helpers";
import { histories, routines, userSettings, users } from "@/server/db/schema";
import { importInto, parseDump, toPgRows } from "../../scripts/import-from-mariadb";

const fixture = new URL("../fixtures/sample-dump.sql", import.meta.url);
const readDump = () => readFile(fixture, "utf8");

describe("MariaDB ダンプの移行", () => {
  test("対象の4テーブルだけを数え、列名で対応づける", async () => {
    const parsed = parseDump(await readDump());
    expect(Object.fromEntries(Object.entries(parsed).map(([name, rows]) => [name, rows.length]))).toEqual({
      users: 3, user_settings: 2, routines: 2, histories: 3,
    });
    expect(parsed.users[0]).toMatchObject({ id: 3, email: "obrien@example.com", remember_token: "remember-3" });
    expect(parseDump("INSERT INTO `users` (`email`, `id`, `name`) VALUES\n('order@example.com', 42, '順序');").users).toEqual([
      { email: "order@example.com", id: 42, name: "順序" },
    ]);
  });

  test("MariaDB の文字列エスケープを元に戻す", async () => {
    const parsed = parseDump(await readDump());
    expect(parsed.users[0].name).toBe("O'Brien\\研究員\n次行");
    expect(parsed.routines[0].title).toBe('朝の"支度"');
    expect(parsed.routines[0].tasks).toBe('["歯みがき","着替え"]');
  });

  test("真偽値、JSON、UTC 日時、NULL を PostgreSQL 用に変える", async () => {
    const rows = toPgRows(parseDump(await readDump()));
    expect(rows.users[0]).toMatchObject({ isAdmin: true, rememberToken: "remember-3" });
    expect(rows.users[1]).toMatchObject({ isAdmin: false, password: null, emailVerifiedAt: null });
    expect(rows.users[0].emailVerifiedAt).toEqual(new Date("2026-01-01T01:02:03.000Z"));
    expect(rows.user_settings[0]).toMatchObject({ showRemainingTasks: true, showElapsedTime: false, showCelebration: true });
    expect(rows.routines[0].tasks).toEqual(["歯みがき", "着替え"]);
    expect(rows.histories[1]).toMatchObject({ completed: false, finishedAt: null });
    expect(rows.histories[0].startedAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
  });

  test("投入後に件数、外部キー、退会日時、採番が保持される", async () => {
    const { db } = await createTestContext();
    await importInto(db, toPgRows(parseDump(await readDump())));
    expect((await db.select().from(users))).toHaveLength(3);
    expect((await db.select().from(userSettings))).toHaveLength(2);
    expect((await db.select().from(routines))).toHaveLength(2);
    expect((await db.select().from(histories))).toHaveLength(3);
    expect((await db.select().from(users).where(eq(users.id, 12)))[0].deletedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
    expect((await db.select().from(histories).where(eq(histories.id, 21)))[0]).toMatchObject({ userId: 3, routineId: 10 });
    const [created] = await db.insert(users).values({ name: "次", email: "next@example.com" }).returning();
    expect(created.id).toBe(13);
    const [setting] = await db.insert(userSettings).values({ userId: 12 }).returning();
    expect(setting.id).toBe(3);
    const [routine] = await db.insert(routines).values({ userId: 12, title: "次", tasks: [] }).returning();
    expect(routine.id).toBe(16);
    const [history] = await db.insert(histories).values({ userId: 12, routineId: routine.id, title: "次", tasks: [], startedAt: new Date() }).returning();
    expect(history.id).toBe(24);
  });

  test("histories の外部キーが不正なら、4テーブルへの投入をすべて取り消す", async () => {
    const { db } = await createTestContext();
    const rows = toPgRows(parseDump(await readDump()));
    rows.histories[0].routineId = 99999;

    await expect(importInto(db, rows)).rejects.toThrow();
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(userSettings)).toHaveLength(0);
    expect(await db.select().from(routines)).toHaveLength(0);
    expect(await db.select().from(histories)).toHaveLength(0);
  });

  test("空のテーブルは INSERT せず、採番を初期値に合わせる", async () => {
    const { db } = await createTestContext();
    await importInto(db, { users: [], user_settings: [], routines: [], histories: [] });

    const [created] = await db.insert(users).values({ name: "次", email: "next@example.com" }).returning();
    expect(created.id).toBe(1);
  });

  test("移行先のどれか1テーブルでも空でなければ、投入前に中止する", async () => {
    const { db } = await createTestContext();
    await db.execute(sql`SET session_replication_role = 'replica'`);
    await db.insert(histories).values({ id: 99, userId: 99, routineId: 99, title: "既存", tasks: [], startedAt: new Date() });
    await db.execute(sql`SET session_replication_role = 'origin'`);
    await expect(importInto(db, toPgRows(parseDump(await readDump())))).rejects.toThrow(/空ではありません/);
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(histories)).toHaveLength(1);
  });
});
