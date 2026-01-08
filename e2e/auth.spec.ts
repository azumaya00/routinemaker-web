/**
 * E2Eテスト: 認証フロー
 * 
 * テスト内容:
 * - ログイン → /routines表示 → ログアウトできる
 * 
 * 実行方法:
 * - 前提: web (localhost:3000) と api (localhost:8000) が起動していること
 * - 環境変数: E2E_TEST_EMAIL, E2E_TEST_PASSWORD でテストユーザーを指定
 * - 実行: pnpm test:e2e e2e/auth.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password';

test.describe('認証フロー', () => {
  test('ログイン → /routines表示 → ログアウトできる', async ({ page }) => {
    // ログインページに移動
    await page.goto('/login');
    
    // ログインフォームが表示されることを確認
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
    
    // メールアドレスとパスワードを入力
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    
    // ログインボタンをクリック
    await page.getByRole('button', { name: 'ログイン' }).click();
    
    // /routines にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/routines/);
    
    // ルーティン一覧が表示されることを確認
    await expect(page.getByRole('button', { name: /新しいタスクリストを作る/ })).toBeVisible();
    
    // メニューを開く
    await page.getByRole('button', { name: 'メニュー' }).click();
    
    // メニューが表示されることを確認
    await expect(page.getByRole('dialog', { name: 'メニュー' })).toBeVisible();
    
    // ログアウトボタンをクリック
    await page.getByRole('button', { name: 'ログアウト' }).click();
    
    // トップページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');
    
    // ログインページにアクセスできることを確認（未認証状態）
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });
});
