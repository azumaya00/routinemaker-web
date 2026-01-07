# Setup

pnpm install
pnpm dev

## API connectivity (local)

1) Create `routinemaker-web/.env.local` with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

2) Start the API (Docker) and the Web app:

```bash
# API (from routinemaker-api)
docker compose up

# Web (from routinemaker-web)
pnpm dev
```

3) Open `http://localhost:3000/dev` and run:

- `GET /sanctum/csrf-cookie` (sets `XSRF-TOKEN` cookie)
- `POST /login` (requires `X-XSRF-TOKEN` header from cookie)
- `GET /api/me` (should return 200 after login)
- `POST /logout` (should return 204)

## Create a test user (API)

If `you@example.com` does not exist yet, create a user in the API container:

```bash
docker compose exec api php artisan tinker
```

```php
\\App\\Models\\User::create([\n    'name' => 'Dev User',\n    'email' => 'you@example.com',\n    'password' => 'password',\n    'plan' => 'free',\n]);
```
