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

3) Open `http://localhost:3000/login` and login, then open `http://localhost:3000`.

- `/login` → login succeeds
- `/` → /api/me が表示され、401 or 200 で認証状態が分かる

## Phase 3 (routines)

1) Login at `http://localhost:3000/login`
2) Open `http://localhost:3000/routines`
3) Create a routine (title + tasks) and save
4) Edit tasks/title, save, and delete to confirm CRUD

## Create a test user (API)

If `you@example.com` does not exist yet, create a user in the API container:

```bash
docker compose exec api php artisan tinker
```

```php
\\App\\Models\\User::create([\n    'name' => 'Dev User',\n    'email' => 'you@example.com',\n    'password' => 'password',\n    'plan' => 'free',\n]);
```
