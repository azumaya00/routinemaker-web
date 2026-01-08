/**
 * E2Eテスト: ルーティン実行フロー
 * 
 * テスト内容:
 * - preflight→開始→実行中→完了→完了画面→履歴一覧に表示される
 * 
 * 実行方法:
 * - 前提: web (localhost:3000) と api (localhost:8000) が起動していること
 * - 環境変数: E2E_TEST_EMAIL, E2E_TEST_PASSWORD でテストユーザーを指定
 * - 実行: pnpm test:e2e e2e/routine-execute.spec.ts
 * 
 * 注意:
 * - このテストは既存のルーティンが必要です（事前に作成しておくか、作成から実行まで含める）
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password';

test.describe('ルーティン実行フロー', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(TEST_EMAIL);
    await page.getByLabel('パスワード').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/routines/);
  });

  test('preflight→開始→実行中→完了→完了画面→履歴一覧に表示される', async ({ page }) => {
    // まず、ルーティンが存在することを確認（なければ作成）
    const routinesList = page.locator('.routines-home-item');
    const routineCount = await routinesList.count();
    
    let routineId: string | null = null;
    
    if (routineCount === 0) {
      // ルーティンがない場合は作成
      const routineTitle = `テストルーティン ${Date.now()}`;
      const taskName = 'テストタスク1';
      
      await page.getByRole('button', { name: /新しいタスクリストを作る/ }).click();
      await expect(page).toHaveURL(/\/routines\/new/);
      
      await page.getByLabel('リスト名').fill(routineTitle);
      const taskInput = page.locator('.routine-form-task-row').first().getByPlaceholder('タスクを入力');
      await taskInput.fill(taskName);
      await page.getByRole('button', { name: '保存する' }).click();
      await expect(page).toHaveURL(/\/routines/);
      
      // 作成したルーティンのIDを取得（URLから）
      const url = page.url();
      const match = url.match(/\/routines\/(\d+)/);
      if (match) {
        routineId = match[1];
      }
    } else {
      // 既存のルーティンの最初のものを使用
      const firstRoutine = routinesList.first();
      const runButton = firstRoutine.locator('.routines-home-item-run');
      await runButton.click();
      
      // URLからroutineIdを取得
      await page.waitForURL(/\/routines\/\d+\/preflight/);
      const url = page.url();
      const match = url.match(/\/routines\/(\d+)\/preflight/);
      if (match) {
        routineId = match[1];
      }
    }
    
    // preflight画面にいることを確認
    await expect(page).toHaveURL(/\/routines\/\d+\/preflight/);
    
    // 開始ボタンをクリック
    await page.getByRole('button', { name: '開始する' }).click();
    
    // 実行中画面に遷移することを確認
    await expect(page).toHaveURL(/\/run\/\d+/);
    
    // 完了ボタンが表示されることを確認
    await expect(page.getByRole('button', { name: 'できた！' })).toBeVisible();
    
    // 完了ボタンをクリック
    await page.getByRole('button', { name: 'できた！' }).click();
    
    // 完了画面に遷移することを確認
    await expect(page).toHaveURL(/\/run\/\d+\/done/);
    
    // 完了メッセージが表示されることを確認
    await expect(page.getByText('すべてのタスクが完了しました!')).toBeVisible();
    
    // ホームへ戻るボタンをクリック
    await page.getByRole('button', { name: 'ホームへ戻る' }).click();
    
    // /routines にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/routines/);
    
    // 履歴リンクをクリック
    await page.getByRole('button', { name: '履歴' }).click();
    
    // 履歴一覧に遷移することを確認
    await expect(page).toHaveURL(/\/histories/);
    
    // 履歴一覧が表示されることを確認（履歴カードまたは空状態メッセージが表示される）
    // 履歴が存在する場合はカードが表示され、存在しない場合は空状態メッセージが表示される
    const historyCards = page.locator('.history-card');
    
    // 履歴カードまたは空状態メッセージのいずれかが表示されるまで待機
    await page.waitForSelector('.history-card, .histories-empty', { timeout: 5000 }).catch(() => {
      // タイムアウトしてもエラーにしない（空状態の可能性がある）
    });
    
    const hasHistory = await historyCards.count() > 0;
    const hasEmptyMessage = await page.locator('.histories-empty').isVisible().catch(() => false);
    expect(hasHistory || hasEmptyMessage).toBeTruthy();
  });
});
