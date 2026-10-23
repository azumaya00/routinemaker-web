# セットアップ

## ローカル開発

1. `pnpm install` を実行します。
2. [ENV_MATRIX.md](ENV_MATRIX.md) のローカル列を参考に、`.env.local` に開発用の `DATABASE_URL`、`APP_URL`、Google OAuth、SMTP の環境変数を設定します。`APP_URL` は `http://localhost:3000`、`GOOGLE_REDIRECT_URI` は `http://localhost:3000/api/auth/google/callback` です。
3. 開発用 Neon ブランチに対して `pnpm db:migrate` を実行します。
4. `pnpm dev` を実行し、`http://localhost:3000/api/health` で API を確認します。ログイン画面は `http://localhost:3000/login` です。

画面と API は同じサーバーで動きます。利用者の登録は画面の `/signup` から行います。

## Vercel

Production には本番用の Neon ブランチを、`staging` ブランチの Preview には確認用の Neon ブランチを接続します。各環境の値は [ENV_MATRIX.md](ENV_MATRIX.md) に従って設定します。

`staging.routinemaker.yuru-labo.com` を `staging` ブランチに割り当てます。Cloudflare の CNAME と Google Cloud Console の承認済みリダイレクト URI には、本番と確認用の両方の URL を登録します。
