"use client";

// 設定は「保存され、挙動に反映されるか」だけを確認する最小画面。
// UIの見た目は Phase 5.5 以降で調整する前提。

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
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
      {error ? <div className="text-sm text-rose-700">{error}</div> : null}

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
        </label>

        <label className="flex items-center gap-2">
          <span className="w-32">Theme</span>
          <select
            className="border border-slate-200 px-2 py-1"
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
        </label>

        <label className="flex items-center gap-2">
          <span className="w-32">Dark mode</span>
          <select
            className="border border-slate-200 px-2 py-1"
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
        </label>
      </div>

      <button
        type="button"
        className="border border-slate-200 px-3 py-2 text-sm"
        onClick={handleSave}
        disabled={!canSave || saving}
      >
        Save
      </button>
    </section>
  );
}
