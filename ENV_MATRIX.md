# 環境変数

画面と Hono API は同じ Next.js アプリで動きます。API リクエストは同じドメインの `/api` へ送ります。

| Key | ローカル (`.env.local`) | Production (Vercel) | staging ブランチの Preview (Vercel) |
|---|---|---|---|
| `DATABASE_URL` | 開発用 Neon ブランチの接続文字列 | 本番用 Neon ブランチの接続文字列 | 確認用 Neon ブランチの接続文字列 |
| `APP_URL` | `http://localhost:3000` | `https://routinemaker.yuru-labo.com` | `https://staging.routinemaker.yuru-labo.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | Google OAuth クライアント ID | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | Google OAuth クライアントシークレット | Google OAuth クライアントシークレット |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` | `https://routinemaker.yuru-labo.com/api/auth/google/callback` | `https://staging.routinemaker.yuru-labo.com/api/auth/google/callback` |
| `MAIL_HOST` | SMTP ホスト | mixhost の SMTP ホスト | mixhost の SMTP ホスト |
| `MAIL_PORT` | SMTP ポート | mixhost の SMTP ポート | mixhost の SMTP ポート |
| `MAIL_USERNAME` | SMTP ユーザー名 | mixhost の SMTP ユーザー名 | mixhost の SMTP ユーザー名 |
| `MAIL_PASSWORD` | SMTP パスワード | mixhost の SMTP パスワード | mixhost の SMTP パスワード |
| `MAIL_FROM_ADDRESS` | 送信元アドレス | mixhost の送信元アドレス | mixhost の送信元アドレス |

`DATABASE_URL`、`APP_URL`、`GOOGLE_REDIRECT_URI` は本番と確認用で分けます。確認用 DB は Neon の別ブランチを使い、本番データには触れません。CSRF の Origin 判定には各環境の `APP_URL` を使います。
