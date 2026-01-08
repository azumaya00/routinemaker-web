# E2Eテスト実行手順

## 前提条件

1. **routinemaker-web** が `localhost:3000` で起動していること
   ```bash
   cd routinemaker-web
   pnpm dev
   ```

2. **routinemaker-api** が `localhost:8000` で起動していること
   ```bash
   cd routinemaker-api
   php artisan serve
   ```

3. **テスト用ユーザー** が存在すること
   - 環境変数で指定するか、テスト内で新規登録する
   - デフォルト: `test@example.com` / `password`

## セットアップ

### 1. Playwrightのインストール

```bash
cd routinemaker-web
pnpm install
```

### 2. Playwrightブラウザのインストール

```bash
pnpm exec playwright install
```

## テスト実行

### 全テストを実行

```bash
pnpm test:e2e
```

### 特定のテストファイルを実行

```bash
# 認証フローのみ
pnpm test:e2e e2e/auth.spec.ts

# ルーティン作成フローのみ
pnpm test:e2e e2e/routine-create.spec.ts

# ルーティン実行フローのみ
pnpm test:e2e e2e/routine-execute.spec.ts
```

### UIモードで実行（デバッグ用）

```bash
pnpm test:e2e:ui
```

### ヘッド付きブラウザで実行（デバッグ用）

```bash
pnpm test:e2e:headed
```

## 環境変数

テスト用ユーザーの認証情報を環境変数で指定できます：

```bash
E2E_TEST_EMAIL=your-test@example.com E2E_TEST_PASSWORD=your-password pnpm test:e2e
```

または `.env.local` に設定：

```
E2E_TEST_EMAIL=your-test@example.com
E2E_TEST_PASSWORD=your-password
```

## テスト内容

### 1. 認証フロー (`auth.spec.ts`)
- ログイン → /routines表示 → ログアウトできる

### 2. ルーティン作成フロー (`routine-create.spec.ts`)
- ルーティン作成（タイトル＋タスク1）→保存→一覧に表示される

### 3. ルーティン実行フロー (`routine-execute.spec.ts`)
- preflight→開始→実行中→完了→完了画面→履歴一覧に表示される

## トラブルシューティング

### テストが失敗する場合

1. **webとapiが起動しているか確認**
   - `http://localhost:3000` にアクセスできるか
   - `http://localhost:8000` にアクセスできるか

2. **テスト用ユーザーが存在するか確認**
   - 環境変数で指定したユーザーがDBに存在するか
   - パスワードが正しいか

3. **ブラウザがインストールされているか確認**
   ```bash
   pnpm exec playwright install
   ```

4. **ログを確認**
   - テスト実行時に `--headed` オプションを付けて実行し、ブラウザの動作を確認
   - スクリーンショットは `test-results/` に保存される

## 注意事項

- テストは実際のDBを使用します（テスト用DBの分離は今後の課題）
- テスト実行前に既存のデータが影響する可能性があります
- CI環境では `CI=true` 環境変数が設定されると、リトライ回数が2回になります
