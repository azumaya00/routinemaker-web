# routinemaker API の Hono への作り直し 設計書

作成日: 2026-10-23
関連: routinemaker-api リポジトリの `MIGRATION.md`（移行の経緯、タグ、バックアップ、データ変換の記録）

## 目的と背景

routinemaker は、子どものやることが多すぎてパニックになるのを和らげるために作ったアプリ。
最初はプログラミングを学び始めた頃に Laravel で作り、2026 年に AI を使って作り直したものが現行版になっている。
今回は同じアプリを、別の技術（TypeScript・サーバーレス・PostgreSQL）へ書き換える。

直接のきっかけは、mixhost で PHP の緊急脆弱性対応が続いたこと。
Laravel の実績ははんぷるで残すので、routinemaker は PHP をやめる。

ポートフォリオでは、次の点が伝わることを狙う。

- 実際の困りごとから生まれたアプリを、手放さずに育ててきたこと
- 利用者がいるアプリを、動作を変えず、データも失わずに別の技術へ移せること
- 移行の判断を記録に残して説明できること

## ゴール

- 現行 Laravel API の機能をすべて Hono で作り直し、利用者から見た動作を変えない
- 画面（Next.js）の変更は、API の呼び先とログイン手順（Sanctum 固有の CSRF 処理）の差し替えだけにする
- 既存の利用者データ（users・user_settings・routines・histories）を Neon に移し、全員が同じアカウントで使い続けられる
- 本人がコードを読んで理解できる構成にする。Laravel 版と見比べて対応が追える

## やらないこと

- 機能の追加、画面の見た目や文言の変更
- プラン（free / unlimited など）の仕組みの変更。値と制限はそのまま移す
- メールアドレスの確認（email_verified_at）など、現行で使っていない機能の実装

## 失敗とみなすこと

- 既存の利用者がログインできなくなる、またはデータが欠ける
- 画面の操作感や表示が変わる（エラー文言の変化を含む）
- 中身を本人が追えないほど、抽象化やライブラリ任せの部分が多い

## 制約

- 追加費用ゼロ。Vercel Hobby（非商用）と Neon Free の範囲で動かす
- 期限: rie-k.com のポートフォリオを作り始めるまで（2026-11-01 のイベント後）。急がない
- 新しいパッケージは、名前をユーザーに確認してから入れる
- pnpm の `minimum-release-age`（公開から21日未満の版は入れない）の方針に従う
- 実装は Codex に任せる。Codex にはブラウザを起動させない

## 決めた構成

| 項目 | 決定 |
|---|---|
| 置き場所 | routinemaker-web リポジトリに API を同居させ、Vercel の1プロジェクトで動かす |
| フレームワーク | Hono。Next.js の `src/app/api/[[...route]]/route.ts` から Hono アプリに渡す |
| 実行環境 | Vercel Functions（Node.js ランタイム） |
| DB | Neon（PostgreSQL） |
| ORM | Drizzle。接続は Neon の HTTP ドライバー |
| 入力チェック | zod |
| ログイン状態 | 自前のセッション（Neon の sessions 表 + httpOnly Cookie） |
| メール送信 | mixhost の SMTP（`ik10004.mixhost.jp`、465番、送信元 noreply@yuru-labo.com） |

画面と API が同じドメイン（routinemaker.yuru-labo.com）になるので、CORS と、ドメインをまたぐ Cookie の設定は要らない。

### 使う予定のパッケージ（導入前にユーザーへ確認する）

| 用途 | 候補 |
|---|---|
| API | `hono` |
| ORM | `drizzle-orm`、開発用に `drizzle-kit` |
| DB ドライバー | `@neondatabase/serverless` |
| 入力チェック | `zod`、`@hono/zod-validator` |
| パスワードのハッシュ化 | `bcryptjs`（既存の `$2y$` 形式を照合できるか、実装前に確かめる） |
| Google ログイン | なし。fetch で自前に書く（arctic を候補にしていたが、2026-10-23 に npm 側で「Package no longer supported」の表示が付いていたため取りやめた） |
| メール送信 | `nodemailer` |

## ファイル構成

Laravel 版と見比べやすいよう、役割ごとに分ける。

```
src/server/
  app.ts               Hono アプリの組み立て（routes/api.php と web.php に当たる）
  db/
    schema.ts          テーブル定義（マイグレーションに当たる）
    client.ts          Neon への接続
  middleware/
    auth.ts            ログイン必須（auth:sanctum に当たる）
    admin.ts           管理者のみ（EnsureAdmin に当たる）
    csrf.ts            Origin の確認
    rateLimit.ts       回数制限（throttle に当たる）
  routes/
    auth.ts            ログイン・登録・ログアウト・再設定（Auth/* コントローラーに当たる）
    google.ts          Google ログイン（GoogleAuthController）
    me.ts              MeController・TutorialDismissController
    routines.ts        RoutineController
    histories.ts       HistoryController・HistoriesController
    settings.ts        UserSettingController
    admin.ts           AdminController
  lib/
    session.ts         セッションの作成・確認・削除
    password.ts        ハッシュ化と照合
    mail.ts            メール送信と再設定メールの文面
    errors.ts          Laravel と同じ形のエラー応答を作る
src/app/api/[[...route]]/route.ts   Next.js から Hono へ渡すだけ
drizzle/                             drizzle-kit が出すマイグレーション
scripts/import-from-mariadb.ts       旧 DB のダンプから Neon へ移す一度きりのスクリプト
```

## エンドポイント

パスは `/api` の下にそろえる。
現行で `/login` などルート直下にあったものは、Next.js の画面（`/login` ページなど）とぶつかるため `/api` の下へ移し、画面側の呼び先を合わせて変える。

| メソッド・パス | 現行 | 認証 | 回数制限 |
|---|---|---|---|
| GET /api/health | 同じ | なし | なし |
| POST /api/login | POST /login | なし | 10回/分 |
| POST /api/register | POST /register | なし | 10回/分 |
| POST /api/logout | POST /logout と POST /api/logout | 必須 | なし |
| POST /api/forgot-password | 同じ | なし | 5回/分 |
| POST /api/reset-password | 同じ | なし | 5回/分 |
| GET /api/auth/google/redirect | 同じ | なし | 10回/分 |
| GET /api/auth/google/callback | 同じ | なし | 10回/分 |
| GET /api/me | 同じ | 必須 | なし |
| DELETE /api/me | 同じ | 必須 | なし |
| POST /api/tutorial/dismiss | 同じ | 必須 | なし |
| GET・POST /api/routines | 同じ | 必須 | なし |
| GET・PATCH・DELETE /api/routines/:id | 同じ | 必須 | なし |
| POST /api/routines/:id/start | 同じ | 必須 | なし |
| GET /api/histories | 同じ | 必須 | なし |
| GET /api/histories/:id | 同じ | 必須 | なし |
| POST /api/histories/:id/complete | 同じ | 必須 | なし |
| POST /api/histories/:id/abort | 同じ | 必須 | なし |
| GET・PATCH /api/settings | 同じ | 必須 | なし |
| GET /api/admin/ping | 同じ | 必須 + 管理者 | なし |

`GET /sanctum/csrf-cookie` はなくなる。画面側の呼び出しを消す。

## 動作の仕様（現行と同じにする点）

応答の JSON の形、ステータスコード、日本語のメッセージは、現行の Laravel 版と一字一句そろえる。
仕様の正は、`laravel-final` タグ時点の routinemaker-api のコントローラー。迷ったらそれを読む。
主な点を挙げる。

### 認証

- ログイン: 成功で 204。失敗は 422 で `{"message": "メールアドレスまたはパスワードが正しくありません。"}`。ログイン済みなら何もせず 204。退会済み（deleted_at あり）の人はログインできない
- 登録: パスワードは8文字以上で、英字と数字を1文字以上ずつ含む。`password_confirmation` と一致すること。既に使われているメールアドレス、退会済みのメールアドレスは、それぞれ現行のメッセージで 422。成功すると name をメールアドレスの @ より前にしてユーザーを作り、ログイン状態にして 204
- ログアウト: セッションを消して Cookie を削除し、204
- パスワード再設定の申請: 存在しないメールアドレスでも常に 200 と同じメッセージを返す（アカウントの有無を漏らさない）。退会済みの人にも送る。メールの件名・本文・ボタン・有効期限60分は現行の ResetPasswordNotification と同じ。リンクは `https://routinemaker.yuru-labo.com/reset-password?token=...&email=...`
- パスワード再設定の実行: トークンが正しく期限内なら、パスワードを変えて 200。退会済みの人はこの操作で復元される。成功したらその人のセッションをすべて消す。失敗は現行のメッセージで 422
- 再設定トークンは、Laravel と同じく、平文をメールで送り、DB にはハッシュを保存する。同じ人への再送は60秒あける（Laravel の既定の throttle）
- Google ログイン: provider_id には Google の `sub` を入れる（Socialite が保存していた値と同じ）。現行の GoogleAuthController の A・B・C の分岐をそのまま再現する（provider_id で照合し、退会済みなら復元して plan を free に戻す。provider_id で見つからずメールアドレスが既存または退会済みなら、それぞれのメッセージで 422。どれでもなければ新規作成）。成功したら `/routines` へリダイレクトする

### 入力エラーの形

Laravel と同じ形にする。画面側は `errors` の中身を並べて表示している。

```json
{
  "message": "パスワードが一致しません。",
  "errors": { "password": ["パスワードが一致しません。"] }
}
```

`message` には、最初のエラーの文言を入れる。2件目以降があると、Laravel と同じく「 (and 1 more error)」「 (and 2 more errors)」を末尾に付ける。

現行の Laravel には日本語の翻訳ファイルがない。独自のメッセージを指定していない入力エラーは、Laravel 標準の英語の文言のまま返っている（例: 「The title field is required.」「Tasks must not exceed 10 for this plan.」）。
新しい API でも、これらは同じ英語の文言で返す。日本語化は今回やらない。

### ルーティン

- 一覧は自分の分を id 順で返す
- 作成: plan が free で既に10件あれば 422 で「無料プランではタスクリストは10件までです。」
- tasks は文字列（各255文字以内）の配列。plan が unlimited 以外は11個以上で 422
- 更新は title・tasks の部分更新
- 他人のルーティンは 404

### 履歴

- 開始: ルーティンの title と tasks を写して作り、201
- 完了・中断: finished_at を今にして、completed をそれぞれ true・false にする
- 一覧: 自分の分を started_at の新しい順に20件ずつ返す（`page` で送る）。項目は id・routine_id・title・started_at・finished_at・completed。`meta.next_page_url`・`meta.prev_page_url` を返す。画面側は `next_page_url` があるかどうかだけを見ている
- 詳細: 他人の履歴は 404

### 自分の情報・設定

- GET /api/me: 現行と同じ形（user に id・name・email・plan・is_admin・has_password・provider・tutorial_dismissed_at・tutorial_should_show、ほかに plan と settings）。設定がなければ既定値で作る
- DELETE /api/me: パスワードを持つ人は再入力が必要。一致しなければ現行のメッセージで 422。Google の人は不要。退会は deleted_at を入れるソフト削除で、ログアウトも行う
- 設定の更新: theme は light・soft・dark、dark_mode は off・on・system、show_* の3つは真偽値

### 日時

日時は ISO 8601 の文字列（UTC）で返す。
Laravel は `2026-01-07T00:12:29.000000Z` の形で返していた（tutorial_dismissed_at だけは `+00:00` の形）。画面は `new Date()` に渡すだけでこの形に依存していないので、ミリ秒以下の桁数は合わせなくてよい。
アプリも DB も UTC で動いていた（ダンプにも `SET time_zone = "+00:00"` がある）。

### 履歴の一覧の件数

画面は `per_page=100` を付けて呼ぶが、Laravel は無視して20件に固定している。新しい API も `per_page` は無視して20件にする。

### メールアドレスの大文字・小文字

MariaDB の照合順序は大文字・小文字を区別しないため、現行では `Foo@example.com` と `foo@example.com` が同じ人として扱われている。
PostgreSQL は区別するので、検索は `lower(email)` で比べ、一意の制約も `lower(email)` に付ける。保存する値は入力のまま（設計者の判断）。

### 管理者の付け外し

Laravel 版には user:make-admin などのコマンドがあった。新しい API では専用のスクリプトは作らず、Neon の SQL エディタで `is_admin` を書き換える手順を README に書く（設計者の判断）。

## ログイン状態の仕組み

- ログインに成功したら、推測できないランダムな値を作る。その値を httpOnly・Secure・SameSite=Lax の Cookie に入れる
- DB の sessions 表には、その値のハッシュ、ユーザー ID、有効期限を保存する
- リクエストごとに、Cookie の値をハッシュして sessions 表を引き、期限内で、ユーザーが退会していなければログイン中とみなす
- 有効期限は現行の Laravel の設定（SESSION_LIFETIME=120）に合わせて120分にする。Laravel と同じく、最後にアクセスしてからの時間で数え、アクセスのたびに延ばす。DB への書き込みを減らすため、延長は残りが半分を切ったときだけ行う（設計者の判断）
- ログイン・登録・Google ログインの成功時は、新しいセッションを作る（ログイン前の値を使い回さない）
- 管理者の確認は users.is_admin を見る。is_admin は外部の入力から変えられないようにする

### CSRF の対策

画面と API が同じドメインになるので、Cookie は SameSite=Lax で外部サイトからの POST に付かない。
そのうえで、GET 以外のリクエストは Origin ヘッダーが自分のドメインと一致するかを確かめる。
Laravel の XSRF-TOKEN の仕組みは使わない。

## 回数制限

サーバーレスではリクエストごとに別のプロセスが動くことがあるので、メモリでは数えられない。
Neon に「どの操作を、どの IP から、いつ行ったか」を記録する表を作り、直近1分の件数で判断する。
上限を超えたら 429 を返す。
古い記録は、記録するついでに消す。

## メール

- nodemailer で `ik10004.mixhost.jp`（465番、SSL）に、noreply@yuru-labo.com のアカウントで接続して送る
- 接続情報は Vercel の環境変数に入れる
- 送信に失敗しても、再設定の申請には常に同じ応答を返す。失敗はログに残す
- 文面は、件名「パスワード再設定のお知らせ」、本文の4行、ボタン「パスワードを再設定する」、有効期限60分を現行と同じにする。Laravel の標準テンプレートが自動で入れていた英語の定型文（「Hello!」「Regards, ...」、ボタンが押せないときの英語の案内、ヘッダーとフッター）は外し、簡素な HTML とテキストの2種類で送る（ユーザーの決定）。ボタンが押せないとき用に、URL そのものは日本語の案内を付けて本文に載せる
- 再設定リンクの宛先は、環境変数 APP_URL のドメインにする（確認用の環境では確認用のドメインになる）

## DB

テーブルは users・user_settings・routines・histories・password_reset_tokens・sessions・rate_limits の7つ。
users から histories までの列は、現行と同じ名前にする。
型の変換は MIGRATION.md の表に従う（`bigint` の identity、`boolean`、`jsonb`、`timestamptz`）。
外部キーと「削除したら連動して消す」設定は現行どおり。user_settings.user_id は一意にする。

### データの移行

- 移すのは users・user_settings・routines・histories の4つ。id はそのまま移し、移したあとで採番の続きを最大値に合わせる
- password_reset_tokens と sessions は移さない（切り替え時に全員一度ログアウトされる）
- `scripts/import-from-mariadb.ts` で、phpMyAdmin のダンプ（SQL）を読んで Neon に入れる。ダンプには個人情報が入っているので、リポジトリには置かない
- 移したあと、件数と、いくつかの行の中身が旧 DB と一致するかを確かめる

## 環境変数（Vercel）

| 名前 | 内容 |
|---|---|
| DATABASE_URL | Neon の接続文字列 |
| GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET | 現行と同じ Google の認証情報 |
| GOOGLE_REDIRECT_URI | `https://routinemaker.yuru-labo.com/api/auth/google/callback` |
| MAIL_HOST・MAIL_PORT・MAIL_USERNAME・MAIL_PASSWORD・MAIL_FROM_ADDRESS | mixhost の SMTP |
| APP_URL | `https://routinemaker.yuru-labo.com` |

`NEXT_PUBLIC_API_BASE_URL` は不要になる（同じドメインなので相対パスで呼ぶ）。

### 確認用の環境（ユーザーの決定）

切り替え前に Google ログインまで試せるよう、固定の確認用ドメイン `staging.routinemaker.yuru-labo.com` を用意する。

- Vercel で `staging` ブランチにこのドメインを割り当てる
- DATABASE_URL・APP_URL・GOOGLE_REDIRECT_URI は、本番（Production）と確認用（staging ブランチの Preview）で別の値にする。確認用の DB は Neon のブランチを使い、本番のデータには触れない
- Origin の確認で許すドメインは APP_URL から決める
- 確認用ドメインの DNS（Cloudflare の CNAME）と、Google Cloud Console の「承認済みのリダイレクト URI」への2つの URL（本番・確認用）の追加は、ユーザーが行う

## 動作が同じことの確かめ方

- API の各エンドポイントに、現行の仕様（上の「動作の仕様」）どおりの応答を返すかのテストを書く。テスト用の DB は Neon のブランチか、ローカルの PostgreSQL を使う
- 画面側にある Playwright の E2E テスト（auth・routine-create・routine-execute）を、新しい API につないで通す
- 切り替え前に、確認用の環境（staging.routinemaker.yuru-labo.com）で、本人が一通りの操作（登録、ログイン、Google ログイン、ルーティンの作成から実行、履歴、設定、パスワード再設定、退会）を試す

## 切り替えの手順

1. Neon を用意し、本番用と確認用のブランチにテーブルを作る
2. 確認用の環境で、新しい API と画面を確かめる（データは試験用。旧 DB のダンプを確認用ブランチに入れて、移行スクリプトの試運転もする）
3. 当日: 旧 API を止める → 最新のダンプを取る → Neon に移す → 件数を確かめる → 新しい版を本番に出す → 本人のアカウントと Google ログインで確かめる
4. routinemaker-api.yuru-labo.com を routinemaker.yuru-labo.com へ転送する
5. しばらく様子を見てから、routinemaker-api の DNS レコードと mixhost 上のファイルを消す

## 実装する人に任せること

- Hono・Drizzle・zod の細かい書き方
- テストのフレームワーク（Vitest を想定）とテスト用 DB の用意の仕方
- セッションの値の長さやハッシュの方式（十分に推測できない長さと、SHA-256 程度）
- 回数制限の表の具体的な列
- コメントは、自明でない箇所に「なぜそうしているか」だけを書く
