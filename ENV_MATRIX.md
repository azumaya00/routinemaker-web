# ENV Matrix (local vs production)

## routinemaker-web (Next.js)

### 必須設定（本番で必ず設定）

| Key | local | production (Vercel) | Used by | Notes |
|---|---|---|---|---|
| NEXT_PUBLIC_API_BASE_URL | http://localhost:8001 | https://routinemaker-api.yuru-labo.com | src/lib/api.ts | 本番では必ず設定（Vercel 環境変数で設定） |

## 参考: API側の環境変数

API側の環境変数については `routinemaker-api/ENV_MATRIX.md` を参照してください。

主な設定項目：
- `APP_ENV=production`
- `APP_DEBUG=false`
- `SESSION_DOMAIN=.yuru-labo.com`
- `SESSION_SECURE_COOKIE=true`
- `SANCTUM_STATEFUL_DOMAINS=routinemaker.yuru-labo.com`
- `CORS_ALLOWED_ORIGINS=https://routinemaker.yuru-labo.com`