import { ChangeEvent, useRef, useState } from "react";
import { useApp } from "../app/store";
import { PageHeader } from "../components/Shared";
import { Icon } from "../components/Icon";
import { Dialog } from "../components/Dialog";
import { readBackup } from "../lib/persistence/notebook";
export const downloadBackup = (json: string) => {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `skibo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const Settings = () => {
  const { data, preferences, importBackup, storageError, pending } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<{
    json: string;
    tasks: number;
    events: number;
  } | null>(null);
  const [error, setError] = useState("");
  const readFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const json = await file.text();
      const parsed = readBackup(json);
      setRestore({
        json,
        tasks: parsed.tasks.length,
        events: parsed.events.length,
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Make yourself at home"
        title="Your own kind of rhythm."
        description="A few small choices to make this space feel like yours."
      />
      <div className="settings-grid">
        <section className="settings-panel panel">
          <p className="eyebrow">Look & feel</p>
          <h2>A comfortable space.</h2>
          <label className="setting-row">
            <span>
              <strong>Appearance</strong>
              <small>Follow your device, or choose a mood.</small>
            </span>
            <select
              aria-label="Appearance"
              disabled={!!storageError}
              value={data.preferences.theme}
              onChange={(e) =>
                preferences({
                  theme: e.target.value as "system" | "light" | "dark",
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="setting-row">
            <span>
              <strong>Reduced motion</strong>
              <small>Keep the experience still and quiet.</small>
            </span>
            <input
              aria-label="Reduced motion"
              type="checkbox"
              disabled={!!storageError}
              checked={data.preferences.reduceMotion}
              onChange={(e) => preferences({ reduceMotion: e.target.checked })}
            />
          </label>
          <label className="setting-row">
            <span>
              <strong>A little sound</strong>
              <small>A gentle note when you finish a task.</small>
            </span>
            <input
              aria-label="Completion sound"
              type="checkbox"
              disabled={!!storageError}
              checked={data.preferences.sound}
              onChange={(e) => preferences({ sound: e.target.checked })}
            />
          </label>
        </section>
        <section className="settings-panel panel">
          <p className="eyebrow">Your rhythm</p>
          <h2>Days that fit your life.</h2>
          <label className="setting-row">
            <span>
              <strong>My day starts at</strong>
              <small>Late nights can belong to yesterday.</small>
            </span>
            <select
              aria-label="Day starts at"
              value={data.preferences.dayStart}
              disabled={!!storageError}
              onChange={(e) =>
                preferences({ dayStart: Number(e.target.value) })
              }
            >
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? "Midnight" : i === 12 ? "12 PM" : `${i} AM`}
                </option>
              ))}
            </select>
          </label>
          <label className="setting-row">
            <span>
              <strong>Big rewards per week</strong>
              <small>Mon–Sun. Smaller rewards keep flowing.</small>
            </span>
            <select
              aria-label="Big rewards per week"
              disabled={!!storageError}
              value={data.preferences.bigRewardCap ?? "none"}
              onChange={(e) =>
                preferences({
                  bigRewardCap:
                    e.target.value === "none" ? null : Number(e.target.value),
                })
              }
            >
              <option value="none">No cap</option>
              {[
                ...new Set([
                  0,
                  1,
                  2,
                  3,
                  5,
                  10,
                  ...(data.preferences.bigRewardCap !== null
                    ? [data.preferences.bigRewardCap]
                    : []),
                ]),
              ]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <div className="setting-note">
            Dates follow this device's local time:{" "}
            <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>.
            Changing your day start can change which day recent completions
            belong to.
          </div>
        </section>
        <section className="settings-panel panel backup-panel">
          <p className="eyebrow">Yours to keep</p>
          <h2>A little peace of mind.</h2>
          <p>
            Your notebook stays in this browser, available offline after the
            first visit. Back it up before clearing browser data or moving to a
            new device.
          </p>
          <div className="backup-actions">
            <button
              className="button primary"
              onClick={() => downloadBackup(JSON.stringify(data, null, 2))}
            >
              <Icon name="download" size={18} /> Download backup
            </button>
            <button
              className="button secondary"
              disabled={!!storageError || pending > 0}
              onClick={() => input.current?.click()}
            >
              Restore a backup
            </button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Backup file"
              onChange={readFile}
            />
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <p className="setting-note">
            Includes tasks, your menu, every recorded action, and preferences.
            Backups from earlier versions are supported.
          </p>
        </section>
        <section className="settings-panel about-panel">
          <Icon name="leaf" size={30} />
          <h2>Little by little.</h2>
          <p>
            Skibo pairs small intentions with a chance at something good.
            No streak penalties. No lost progress. Just a reason to come back.
          </p>
          <p className="eyebrow">Made for a human pace.</p>
        </section>
      </div>
      {restore && (
        <Dialog title="Restore your notebook" close={() => setRestore(null)}>
          <h2>Make this your notebook?</h2>
          <p className="lede">
            This file contains {restore.tasks} tasks and {restore.events}{" "}
            history entries. Restoring replaces the notebook currently in this
            browser.
          </p>
          <div className="form-stack">
            <button
              className="button secondary"
              onClick={() => downloadBackup(JSON.stringify(data, null, 2))}
            >
              Download current notebook first
            </button>
            <button
              className="button primary"
              disabled={!!storageError || pending > 0}
              onClick={() => {
                try {
                  importBackup(restore.json);
                  setRestore(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Restore failed.");
                  setRestore(null);
                }
              }}
            >
              Restore this backup
            </button>
            <button className="text-link" onClick={() => setRestore(null)}>
              Keep my current notebook
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
};
