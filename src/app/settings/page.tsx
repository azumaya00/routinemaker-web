"use client";

// 設定は「保存され、挙動に反映されるか」だけを確認する最小画面。
// 導線の指定が要件にないため、現状は /settings 直アクセス前提で固定する。

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { type UserSettings } from "@/lib/api";

const emptySettings: UserSettings = {
  theme: "light",
  dark_mode: "system",
  show_remaining_tasks: false,
  show_elapsed_time: false,
  enable_task_estimated_time: false,
  show_celebration: false,
};

export default function SettingsPage() {
  const { status, settings, me, saveSettings, error } = useAuth();
  const [local, setLocal] = useState<UserSettings>(emptySettings);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const canSave = useMemo(() => status === "authenticated", [status]);

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await saveSettings(local);
    if (result.status === 200) {
      setMessage("保存しました。");
    } else {
      setMessage(`保存に失敗しました (${result.status})`);
    }
    setSaving(false);
  };

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="rm-muted text-xs">
        実行中に影響する項目は、次回の実行から反映されます。
      </div>
      {message ? <div className="rm-muted text-sm">{message}</div> : null}
      {error ? <div className="rm-danger text-sm">{error}</div> : null}

      <div className="space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.show_remaining_tasks}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                show_remaining_tasks: event.target.checked,
              }))
            }
          />
          残りタスク数を表示する
          <span title="実行中の補助情報として残り数を表示する">?</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.show_elapsed_time}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                show_elapsed_time: event.target.checked,
              }))
            }
          />
          経過時間を表示する
          <span title="実行開始からの経過時間を分単位で表示する">?</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.enable_task_estimated_time}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                enable_task_estimated_time: event.target.checked,
              }))
            }
          />
          目安時間を表示する
          <span title="タスクに目安時間がある場合のみ表示する">?</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.show_celebration}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                show_celebration: event.target.checked,
              }))
            }
          />
          完了演出を表示する
          <span title="完了後画面の演出を表示する">?</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="w-32">Theme</span>
          <select
            className="rm-select"
            value={local.theme}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                theme: event.target.value as UserSettings["theme"],
              }))
            }
          >
            <option value="light">light</option>
            <option value="soft">soft</option>
            <option value="dark">dark</option>
          </select>
          <span title="雰囲気の切り替え（light/soft/dark）">?</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="w-32">Dark mode</span>
          <select
            className="rm-select"
            value={local.dark_mode}
            onChange={(event) =>
              setLocal((prev) => ({
                ...prev,
                dark_mode: event.target.value as UserSettings["dark_mode"],
              }))
            }
          >
            <option value="system">system</option>
            <option value="on">on</option>
            <option value="off">off</option>
          </select>
          <span title="表示モードの切り替え（system/on/off）">?</span>
        </label>
      </div>

      <button
        type="button"
        className="rm-btn rm-btn-primary"
        onClick={handleSave}
        disabled={!canSave || saving}
      >
        Save
      </button>
    </section>
  );
}
