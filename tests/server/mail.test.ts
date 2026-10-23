import { expect, test } from "vitest";
import { buildResetPasswordMail } from "@/server/lib/mail";

test("再設定メールは日本語の4文とリンクを HTML とテキストで伝える", () => {
  const url = "https://routinemaker.test/reset-password?token=abc&email=Foo%2Bbar%40Example.com";
  const mail = buildResetPasswordMail(url);
  expect(mail.subject).toBe("パスワード再設定のお知らせ");
  for (const line of [
    "パスワード再設定のリクエストを受け付けました。",
    "以下のボタンからパスワードを再設定してください。",
    "このリンクの有効期限は60分です。",
    "心当たりがない場合は、このメールを無視してください。",
    "ボタンが押せない場合は、次の URL をブラウザで開いてください。",
  ]) {
    expect(mail.text).toContain(line);
    expect(mail.html).toContain(line);
  }
  expect(mail.text).toContain(url);
  expect(mail.html).toContain(url.replaceAll("&", "&amp;"));
  expect(mail.html).toContain("パスワードを再設定する");
  expect(mail.html).toMatch(/<a href="https:\/\/routinemaker\.test\/reset-password\?/);
  expect(mail.text + mail.html).not.toMatch(/Hello!|Regards|If you're having trouble/);
});
