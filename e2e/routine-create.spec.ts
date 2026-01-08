/**
 * E2Eテスト: ルーティン作成フロー
 * 
 * テスト内容:
 * - ルーティン作成（タイトル＋タスク1）→保存→一覧に表示される
 * 
 * 実行方法:
 * - 前提: web (localhost:3000) と api (localhost:8000) が起動していること
 * - 環境変数: E2E_TEST_EMAIL, E2E_TEST_PASSWORD でテストユーザーを指定
 * - 実行: pnpm test:e2e e2e/routine-create.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password';

test.describe('ルーティン作成フロー', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/routines/);
  });

  test('ルーティン作成（タイトル＋タスク1）→保存→一覧に表示される', async ({ page }) => {
    const routineTitle = `テストルーティン ${Date.now()}`;
    const taskName = 'テストタスク1';

    // 新しいタスクリストを作るボタンをクリック
    await page.getByRole('button', { name: /新しいタスクリストを作る/ }).click();
    
    // 新規作成画面に遷移することを確認
    await expect(page).toHaveURL(/\/routines\/new/);
    await expect(page.getByRole('heading', { name: /新しいタスクリストを作る/ })).toBeVisible();
    
    // リスト名を入力
    await page.getByLabel('リスト名').fill(routineTitle);
    
    // タスクを入力（最初の入力欄に）
    const taskInput = page.locator('.routine-form-task-row').first().getByPlaceholder('タスクを入力');
    await taskInput.fill(taskName);
    
    // 保存ボタンをクリック
    await page.getByRole('button', { name: '保存する' }).click();
    
    // /routines にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/routines/);
    
    // 作成したルーティンが一覧に表示されることを確認
    await expect(page.getByText(routineTitle)).toBeVisible();
  });
});
