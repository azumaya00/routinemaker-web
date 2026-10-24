import nodemailer from "nodemailer";
import type { Mailer } from "../types";

export function createSmtpMailer(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string
}): Mailer {
  const transport = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.port === 465,
    auth: {
      user: opts.user,
      pass: opts.pass
    },
  });
  return {
    send: async (msg) => {
      await transport.sendMail({
        ...msg,
        from: opts.from
      });
    }
  };
}

export function buildResetPasswordMail(resetUrl: string): {
  subject: string;
  text: string;
  html: string
} {
  const lines = [
    "パスワード再設定のリクエストを受け付けました。",
    "以下のボタンからパスワードを再設定してください。",
    "このリンクの有効期限は60分です。",
    "心当たりがない場合は、このメールを無視してください。",
  ];
  const help = "ボタンが押せない場合は、次の URL をブラウザで開いてください。";
  const escapedUrl = resetUrl
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return {
    subject: "パスワード再設定のお知らせ",
    text: [lines[0], lines[1], resetUrl, lines[2], lines[3], help, resetUrl].join("\n\n"),
    html: [
      `<div><p>${lines[0]}</p>`,
      `<p>${lines[1]}</p>`,
      `<p><a href="${escapedUrl}">パスワードを再設定する</a></p>`,
      `<p>${lines[2]}</p>`,
      `<p>${lines[3]}</p>`,
      `<p>${help}</p>`,
      `<p>${escapedUrl}</p></div>`,
    ].join(""),
  };
}
