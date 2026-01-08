"use client";

// 設定画面: リスト作成/編集画面と同じUI構造に揃える
// 各設定項目にツールチップを追加し、目安時間機能は削除

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { type UserSettings } from "@/lib/api";
import { useFlash } from "@/components/FlashMessageProvider";
import Tooltip from "@/components/Tooltip";

const emptySettings: UserSettings = {
  theme: "light",
  dark_mode: "system",
  show_remaining_tasks: false,
  show_elapsed_time: false,
  show_celebration: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const { status, settings, me, saveSettings, error } = useAuth();
  const { showFlash } = useFlash();
  const [local, setLocal] = useState<UserSettings>(emptySettings);
  const [saving, setSaving] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // 認証判定は /api/me の成否に統一する。
  useEffect(() => {
    void me();
  }, [me]);

  // /api/me の settings を初期値として扱う。
  useEffect(() => {
    if (settings) {
      setLocal(settings);
    }
  }, [settings]);

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
    const result = await saveSettings(local);
    if (result.status === 200) {
      // 保存成功後、ホームに遷移してフラッシュメッセージを表示
      showFlash("success", "設定を保存しました");
      router.push("/routines");
    } else {
      // 保存失敗時はエラーフラッシュメッセージを表示
      showFlash("error", `保存に失敗しました (${result.status})`);
      setSaving(false);
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
