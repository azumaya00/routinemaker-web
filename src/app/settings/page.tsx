"use client";

// 設定画面: リスト作成/編集画面と同じUI構造に揃える
// 各設定項目にツールチップを追加

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth, invalidateMeCache } from "@/hooks/useAuth";
import { type UserSettings, deleteAccount, getCsrfCookie } from "@/lib/api";
import { useFlash } from "@/components/FlashMessageProvider";
import Tooltip from "@/components/Tooltip";
import ConfirmDialog from "@/components/ConfirmDialog";

const emptySettings: UserSettings = {
  theme: "light",
  dark_mode: "system",
  show_remaining_tasks: false,
  show_elapsed_time: false,
  show_celebration: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const {
    status,
    user,
    settings,
    me,
    saveSettings,
    isLoggingOut,
    finishLogout,
    startLoggingOut,
  } = useAuth();
  const { showFlash } = useFlash();
  const [local, setLocal] = useState<UserSettings>(emptySettings);
  const [saving, setSaving] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const requiresPassword = user?.has_password !== false; // passwordがnullならfalseを想定（未提供ならtrue扱いで従来挙動）
  // 元の設定テーマを保持（保存せずに遷移した場合に元に戻すため）
  const originalThemeRef = useRef<string | null>(null);
  const originalDarkModeRef = useRef<string | null>(null);
  const isSavingRef = useRef(false); // 保存中かどうかを追跡

  // 認証判定は /api/me の成否に統一する。
  useEffect(() => {
    void me();
  }, [me]);

  // /api/me の settings を初期値として扱う。
  useEffect(() => {
    if (settings) {
      setLocal(settings);
      // 元の設定テーマを保存（保存せずに遷移した場合に元に戻すため）
      originalThemeRef.current = settings.theme;
      originalDarkModeRef.current = settings.dark_mode;
    }
  }, [settings]);

  // テーマ変更を即座にプレビューとして適用
  useEffect(() => {
    const root = document.documentElement;
    
    // 設定画面内でテーマを変更したら、即座に適用（プレビュー）
    if (local.theme) {
      root.dataset.theme = local.theme;
    }
    
    // ダークモードも即座に適用（プレビュー）
    // AppShellと同じロジックを使用
    const applyDarkMode = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (local.dark_mode === "on") {
      applyDarkMode(true);
    } else if (local.dark_mode === "off") {
      applyDarkMode(false);
    } else if (local.dark_mode === "system") {
      // システム設定に合わせる
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      applyDarkMode(media.matches);
      
      // システム設定の変更を監視（設定画面にいる間のみ）
      const handler = (event: MediaQueryListEvent) => applyDarkMode(event.matches);
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
  }, [local.theme, local.dark_mode]);

  // 設定画面を離れるときに、保存されていない変更があれば元のテーマに戻す
  useEffect(() => {
    return () => {
      // 保存中でない場合のみ、元のテーマに戻す
      if (!isSavingRef.current && originalThemeRef.current !== null) {
        const root = document.documentElement;
        // 元のテーマに戻す
        if (originalThemeRef.current) {
          root.dataset.theme = originalThemeRef.current;
        } else {
          delete root.dataset.theme;
        }
        
        // 元のダークモード設定に戻す
        // AppShellと同じロジックを使用
        const applyDarkMode = (isDark: boolean) => {
          if (isDark) {
            root.classList.add("dark");
          } else {
            root.classList.remove("dark");
          }
        };
        
        if (originalDarkModeRef.current === "on") {
          applyDarkMode(true);
        } else if (originalDarkModeRef.current === "off") {
          applyDarkMode(false);
        } else if (originalDarkModeRef.current === "system") {
          const media = window.matchMedia("(prefers-color-scheme: dark)");
          applyDarkMode(media.matches);
        }
      }
    };
  }, []); // マウント時のみ実行

  // スクロール状態を監視して、下部固定エリアのシャドウを制御
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const canSave = useMemo(() => status === "authenticated", [status]);

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    isSavingRef.current = true; // 保存中フラグを立てる（クリーンアップで元に戻さないようにする）
    const result = await saveSettings(local);
    if (result.status === 200) {
      // 保存成功後、元の設定テーマも更新（次回のプレビュー用）
      originalThemeRef.current = local.theme;
      originalDarkModeRef.current = local.dark_mode;
      // ホームに遷移してフラッシュメッセージを表示
      showFlash("success", "設定を保存しました");
      router.push("/routines");
    } else {
      // 保存失敗時はエラーフラッシュメッセージを表示
      // 技術的詳細はコンソールに出力（ユーザーには見せない）
      console.error("Save settings failed:", result.status, result.body);
      showFlash("error", "保存に失敗しました。もう一度お試しください。");
      setSaving(false);
      isSavingRef.current = false; // 保存失敗時はフラグを戻す
    }
  };

  return (
    <section className="routine-form-container">
      {/* 戻るボタン: 上部に配置（誤タップを防ぐ、リスト作成/編集画面と統一） */}
      <button
        type="button"
        className="routine-form-back-btn"
        onClick={() => router.push("/routines")}
      >
        ← 戻る
      </button>

      <h1 className="routine-form-title">設定</h1>

      {/* 説明文: 実行中に影響する項目について */}
      <p className="settings-description">
        実行中に影響する項目は、次回の実行から反映されます。
      </p>

      {/* 設定項目: 各項目は横並び（左にラベル、右にコントロール） */}
      <div className="settings-items">
        {/* 残りタスク数を表示する */}
        <div className="settings-item">
          <div className="settings-item-label">
            <label htmlFor="show_remaining_tasks" className="settings-item-label-text">
              残りタスク数を表示する
              <Tooltip content="実行中に、残りのタスク数を表示します。">
                <span className="settings-help-icon" aria-label="ヘルプ">
                  ?
                </span>
              </Tooltip>
            </label>
          </div>
          <div className="settings-item-control">
            <label className="settings-toggle">
              <input
                id="show_remaining_tasks"
                type="checkbox"
                checked={local.show_remaining_tasks}
                onChange={(event) =>
                  setLocal((prev) => ({
                    ...prev,
                    show_remaining_tasks: event.target.checked,
                  }))
                }
              />
              <span
                className={`settings-toggle-slider ${
                  local.show_remaining_tasks ? "on" : "off"
                }`}
              >
                <span className="settings-toggle-label">
                  {local.show_remaining_tasks ? "ON" : "OFF"}
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* 経過時間を表示する */}
        <div className="settings-item">
          <div className="settings-item-label">
            <label htmlFor="show_elapsed_time" className="settings-item-label-text">
              経過時間を表示する
              <Tooltip content="実行を開始してからの経過時間を表示します。">
                <span className="settings-help-icon" aria-label="ヘルプ">
                  ?
                </span>
              </Tooltip>
            </label>
          </div>
          <div className="settings-item-control">
            <label className="settings-toggle">
              <input
                id="show_elapsed_time"
                type="checkbox"
                checked={local.show_elapsed_time}
                onChange={(event) =>
                  setLocal((prev) => ({
                    ...prev,
                    show_elapsed_time: event.target.checked,
                  }))
                }
              />
              <span
                className={`settings-toggle-slider ${
                  local.show_elapsed_time ? "on" : "off"
                }`}
              >
                <span className="settings-toggle-label">
                  {local.show_elapsed_time ? "ON" : "OFF"}
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* 完了演出を表示する */}
        <div className="settings-item">
          <div className="settings-item-label">
            <label htmlFor="show_celebration" className="settings-item-label-text">
              完了演出を表示する
              <Tooltip content="すべてのタスク完了時に、ちょっとした演出を表示します。">
                <span className="settings-help-icon" aria-label="ヘルプ">
                  ?
                </span>
              </Tooltip>
            </label>
          </div>
          <div className="settings-item-control">
            <label className="settings-toggle">
              <input
                id="show_celebration"
                type="checkbox"
                checked={local.show_celebration}
                onChange={(event) =>
                  setLocal((prev) => ({
                    ...prev,
                    show_celebration: event.target.checked,
                  }))
                }
              />
              <span
                className={`settings-toggle-slider ${
                  local.show_celebration ? "on" : "off"
                }`}
              >
                <span className="settings-toggle-label">
                  {local.show_celebration ? "ON" : "OFF"}
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* テーマ */}
        <div className="settings-item">
          <div className="settings-item-label">
            <label htmlFor="theme" className="settings-item-label-text">
              テーマ
              <Tooltip content="画面の見た目を選びます。">
                <span className="settings-help-icon" aria-label="ヘルプ">
                  ?
                </span>
              </Tooltip>
            </label>
          </div>
          <div className="settings-item-control">
            <select
              id="theme"
              className="rm-select"
              value={local.theme}
              onChange={(event) =>
                setLocal((prev) => ({
                  ...prev,
                  theme: event.target.value as UserSettings["theme"],
                }))
              }
            >
              <option value="light">ライト</option>
              <option value="soft">ソフト</option>
              <option value="dark">ダーク</option>
            </select>
          </div>
        </div>

        {/* ダークモード */}
        <div className="settings-item">
          <div className="settings-item-label">
            <label htmlFor="dark_mode" className="settings-item-label-text">
              ダークモード
              <Tooltip content="ダークモードの設定方法を選びます。&#10;「システム」は端末の設定に合わせます。">
                <span className="settings-help-icon" aria-label="ヘルプ">
                  ?
                </span>
              </Tooltip>
            </label>
          </div>
          <div className="settings-item-control">
            <select
              id="dark_mode"
              className="rm-select"
              value={local.dark_mode}
              onChange={(event) =>
                setLocal((prev) => ({
                  ...prev,
                  dark_mode: event.target.value as UserSettings["dark_mode"],
                }))
              }
            >
              <option value="system">システム</option>
              <option value="on">オン</option>
              <option value="off">オフ</option>
            </select>
          </div>
        </div>
      </div>

      {/* 退会セクション */}
      <div className="settings-section">
        <h2 className="settings-section-title" style={{ marginBottom: "20px" }}>退会</h2>
        <div className="settings-section-content">
          <p className="settings-description">
            アカウントを削除すると、すべてのデータが削除され、復元できません。
        </p>
          <button
            type="button"
            className="rm-btn settings-delete-btn"
            onClick={() => setShowDeleteDialog(true)}
            style={{ marginBottom: "40px" }}
          >
            アカウントを削除する
          </button>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="アカウントを削除しますか？"
        description="この操作は取り消せません。すべてのデータが削除されます。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (requiresPassword && !deletePassword) {
            showFlash("error", "パスワードを入力してください。");
            return;
          }
          setIsDeleting(true);
          try {
            await getCsrfCookie();
            const result = await deleteAccount(
              requiresPassword ? deletePassword : undefined
            );
            if (result.status === 204) {
              // 退会処理で既にセッションが無効化されているため、認証状態を更新する
              // ガードを無効化するためにisLoggingOutを設定
              startLoggingOut();
              
              // キャッシュを無効化
              invalidateMeCache();
              
              // テーマを明示的にリセット（非ログイン領域ではデフォルトテーマを使用）
              const root = document.documentElement;
              delete root.dataset.theme;
              root.classList.remove("dark");
              
              showFlash("success", "アカウントを削除しました。");
              
              // LPにリダイレクト（isLoggingOutが設定されているため、ガードは発動しない）
              // replaceを使用して履歴を残さない
              router.replace("/");
              
              // 認証状態を更新（LP側のHeaderで自動的にme()が呼ばれる）
              // LPはpublicPathなので、statusがunauthenticatedになってもガードは発動しない
              // また、isLoggingOutが設定されているため、/settingsページにいる状態でもガードは発動しない
              // LPに遷移後、AppShell.tsxの84-89行目でfinishLogout()が呼ばれる
            } else {
              const errorMessage = (() => {
                try {
                  const payload = JSON.parse(result.body) as {
                    message?: string;
                  };
                  return payload.message ?? "アカウント削除に失敗しました。";
                } catch {
                  return "アカウント削除に失敗しました。";
                }
              })();
              showFlash("error", errorMessage);
              setIsDeleting(false);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            showFlash("error", `アカウント削除に失敗しました: ${message}`);
            setIsDeleting(false);
          }
        }}
        onCancel={() => {
          setShowDeleteDialog(false);
          setDeletePassword("");
        }}
        loading={isDeleting}
      >
        {requiresPassword ? (
          <label className="auth-page-label" style={{ marginBottom: "40px" }}>
            パスワードを入力してください
            <input
              type="password"
              className="rm-input auth-page-input"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="パスワードを入力"
              disabled={isDeleting}
              autoFocus
            />
          </label>
        ) : (
          <p className="settings-description" style={{ marginBottom: "24px" }}>
            Googleでログインしたアカウントのため、パスワード入力なしで退会できます。
          </p>
        )}
      </ConfirmDialog>

      {/* アクションボタン: 下部固定バー（保存するを最優先Primary） */}
      <div
        ref={actionsRef}
        className={`routine-form-actions ${isScrolled ? "scrolled" : ""}`}
      >
        <div className="routine-form-actions-inner">
          <button
            type="button"
            className="rm-btn rm-btn-primary routine-form-save-btn"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </section>
  );
}
