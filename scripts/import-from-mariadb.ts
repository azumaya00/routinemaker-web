import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { Db } from "../src/server/db/client.ts";
import * as schema from "../src/server/db/schema.ts";

const { users, userSettings, routines, histories } = schema;
const tableNames = ["users", "user_settings", "routines", "histories"] as const;
type TableName = typeof tableNames[number];
type Value = string | number | null;
type Row = Record<string, Value>;
export type Parsed = Record<TableName, Row[]>;
export type PgRows = {
  users: (typeof users.$inferInsert)[];
  user_settings: (typeof userSettings.$inferInsert)[];
  routines: (typeof routines.$inferInsert)[];
  histories: (typeof histories.$inferInsert)[];
};

function readValue(source: string, start: number): [Value, number] {
  if (source[start] === "'") {
    let value = "";
    for (let i = start + 1; i < source.length; i++) {
      const char = source[i];
      if (char === "\\") {
        if (i + 1 >= source.length) throw new Error("文字列のエスケープが途中で終わっています");
        const escaped = source[++i];
        value += escaped === "n" ? "\n" : escaped === "r" ? "\r" : escaped === "t" ? "\t" : escaped === "0" ? "\0" : escaped;
      } else if (char === "'") {
        if (source[i + 1] === "'") { value += "'"; i++; }
        else return [value, i + 1];
      } else {
        value += char;
      }
    }
    throw new Error("文字列が閉じられていません");
  }
  const match = /^(NULL|-?\d+)/.exec(source.slice(start));
  if (!match) throw new Error("対応していない SQL 値です");
  const value = match[1] === "NULL" ? null : Number(match[1]);
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("安全に扱えない整数です");
  return [value, start + match[0].length];
}

export function parseDump(source: string): Parsed {
  const parsed: Parsed = { users: [], user_settings: [], routines: [], histories: [] };
  const header = /INSERT INTO `([^`]+)`\s*\(([^)]*)\)\s*VALUES\s*/g;
  for (const match of source.matchAll(header)) {
    const table = match[1];
    if (!tableNames.some((name) => name === table)) continue;
    const name = table as TableName;
    const columns = [...match[2].matchAll(/`([^`]+)`/g)].map((column) => column[1]);
    if (columns.length === 0 || new Set(columns).size !== columns.length) throw new Error(`${name}: 列名が不正です`);
    let cursor = match.index + match[0].length;
    const skipSpace = () => { while (/\s/.test(source[cursor] ?? "")) cursor++; };
    while (true) {
      skipSpace();
      if (source[cursor++] !== "(") throw new Error(`${name}: 行の開始が不正です`);
      const values: Value[] = [];
      while (true) {
        skipSpace();
        const [value, next] = readValue(source, cursor);
        values.push(value);
        cursor = next;
        skipSpace();
        const delimiter = source[cursor++];
        if (delimiter === ")") break;
        if (delimiter !== ",") throw new Error(`${name}: 値の区切りが不正です`);
      }
      if (values.length !== columns.length) throw new Error(`${name}: 列数と値の数が一致しません`);
      parsed[name].push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
      skipSpace();
      const delimiter = source[cursor++];
      if (delimiter === ";") break;
      if (delimiter !== ",") throw new Error(`${name}: 行の区切りが不正です`);
    }
  }
  return parsed;
}

function number(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`${key}: 数値が必要です`);
  return value;
}
function string(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`${key}: 文字列が必要です`);
  return value;
}
function optionalString(row: Row, key: string): string | null {
  return row[key] === null ? null : string(row, key);
}
function date(row: Row, key: string): Date | null {
  const value = optionalString(row, key);
  if (value === null) return null;
  const result = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(result.getTime())) throw new Error(`${key}: 日時が不正です`);
  return result;
}
function requiredDate(row: Row, key: string): Date {
  const value = date(row, key);
  if (value === null) throw new Error(`${key}: 日時が必要です`);
  return value;
}
function bool(row: Row, key: string): boolean {
  const value = number(row, key);
  if (value !== 0 && value !== 1) throw new Error(`${key}: 真偽値が不正です`);
  return value === 1;
}
function tasks(row: Row): string[] {
  const value: unknown = JSON.parse(string(row, "tasks"));
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error("tasks: 文字列配列が必要です");
  return value;
}

export function toPgRows(parsed: Parsed): PgRows {
  return {
    users: parsed.users.map((row) => ({
      id: number(row, "id"), name: string(row, "name"), email: string(row, "email"),
      emailVerifiedAt: date(row, "email_verified_at"), password: optionalString(row, "password"),
      plan: string(row, "plan"), tutorialDismissedAt: date(row, "tutorial_dismissed_at"),
      isAdmin: bool(row, "is_admin"), rememberToken: optionalString(row, "remember_token"),
      provider: optionalString(row, "provider"), providerId: optionalString(row, "provider_id"),
      createdAt: date(row, "created_at"), updatedAt: date(row, "updated_at"), deletedAt: date(row, "deleted_at"),
    })),
    user_settings: parsed.user_settings.map((row) => ({
      id: number(row, "id"), userId: number(row, "user_id"), theme: string(row, "theme"),
      darkMode: string(row, "dark_mode"), showRemainingTasks: bool(row, "show_remaining_tasks"),
      showElapsedTime: bool(row, "show_elapsed_time"), showCelebration: bool(row, "show_celebration"),
      createdAt: date(row, "created_at"), updatedAt: date(row, "updated_at"),
    })),
    routines: parsed.routines.map((row) => ({
      id: number(row, "id"), userId: number(row, "user_id"), title: string(row, "title"),
      tasks: tasks(row), createdAt: date(row, "created_at"), updatedAt: date(row, "updated_at"),
    })),
    histories: parsed.histories.map((row) => ({
      id: number(row, "id"), userId: number(row, "user_id"), routineId: number(row, "routine_id"),
      title: string(row, "title"), tasks: tasks(row), startedAt: requiredDate(row, "started_at"),
      finishedAt: date(row, "finished_at"), completed: bool(row, "completed"),
      createdAt: date(row, "created_at"), updatedAt: date(row, "updated_at"),
    })),
  };
}

export async function importInto(db: Db, rows: PgRows): Promise<void> {
  const targets = [users, userSettings, routines, histories] as const;
  // neon-http は通常のトランザクションを持たないため、書き込み前に全対象を確認する。
  for (const table of targets) {
    const existing = await db.select({ id: table.id }).from(table).limit(1);
    if (existing.length > 0) throw new Error(`${tableNames[targets.indexOf(table)]} は空ではありません。移行を中止しました`);
  }
  if (rows.users.length) await db.insert(users).values(rows.users);
  if (rows.user_settings.length) await db.insert(userSettings).values(rows.user_settings);
  if (rows.routines.length) await db.insert(routines).values(rows.routines);
  if (rows.histories.length) await db.insert(histories).values(rows.histories);
  for (const name of tableNames) {
    const maxId = rows[name].reduce((max, row) => Math.max(max, row.id ?? 0), 0);
    if (maxId > 0) await db.execute(sql`SELECT setval(pg_get_serial_sequence(${name}, 'id'), ${maxId}, true)`);
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません");
  const dumpPath = process.argv[2];
  if (!dumpPath) throw new Error("使い方: DATABASE_URL=... node scripts/import-from-mariadb.ts <ダンプのパス>");
  const rows = toPgRows(parseDump(await readFile(dumpPath, "utf8")));
  const db: Db = drizzle(url, { schema });
  await importInto(db, rows);
  for (const [name, table] of [["users", users], ["user_settings", userSettings], ["routines", routines], ["histories", histories]] as const) {
    const [{ total }] = await db.select({ total: count() }).from(table);
    console.log(`${name}: ${total}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error && error.message === "DATABASE_URL が設定されていません"
      ? error.message
      : "移行に失敗しました。ダンプと移行先の状態を確認してください");
    process.exitCode = 1;
  });
}
