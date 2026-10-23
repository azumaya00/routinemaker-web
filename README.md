# routinemaker-web

## 管理者の付け外し

対象環境の Neon SQL エディタで、メールアドレスを確認してから実行します。`<メール>` は対象のアドレスに置き換えてください。

```sql
update users set is_admin = true where lower(email) = lower('<メール>');
```

管理者から外すときは次を実行します。

```sql
update users set is_admin = false where lower(email) = lower('<メール>');
```
