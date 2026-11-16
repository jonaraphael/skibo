import { ChangeEvent, useRef, useState } from "react";
import { canEdit, saveStatus, useApp } from "../app/store";
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
  const { data, preferences, importBackup, pending } = useApp();
  const storageError = useApp((s) => !canEdit(s));
  const sync = useApp();
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
        title="Settings"
      />
      <div className="settings-grid">
        {sync.syncAvailable && (
          <section className="settings-panel panel">
            <p className="eyebrow">Sync</p>
            <h2>Sync across devices.</h2>
            <p>
              Sign into the same Google account on your phone and computer.
              Synced notebooks need internet for editing; your last saved copy
              is available to view offline.
            </p>
            {sync.syncUser ? (
              <>
                <p className="sync-account">{sync.syncUser.email}</p>
                <p role="status">{saveStatus(sync)}</p>
                <button
                  className="button secondary"
                  disabled={pending > 0 || sync.authPending}
                  onClick={sync.disconnectAccount}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                className="button primary"
                disabled={
                  pending > 0 ||
                  sync.authPending ||
                  sync.syncLoading ||
                  !!sync.storageError
                }
                onClick={sync.connectAccount}
              >
                {sync.authPending ? "Signing in…" : "Sync with Google"}
              </button>
            )}
            <p className="setting-note">
              Your separate local notebook stays on this device. If this account
              already has a notebook, that is the one you’ll open.
            </p>
            {sync.syncError && (
              <p className="error-text" role="alert">
                {sync.syncError}
              </p>
            )}
            {sync.syncUser && sync.syncError && (
              <button
                className="button secondary"
                disabled={pending > 0}
                onClick={() => window.location.reload()}
              >
                Retry sync
              </button>
            )}
          </section>
        )}
        <section className="settings-panel panel">
          <p className="eyebrow">Look & feel</p>
          <h2>Appearance and feedback.</h2>
          <label className="setting-row">
            <span>
              <strong>Appearance</strong>
              <small>Use the device setting or select a theme.</small>
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
              <small>Reduce animations.</small>
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
              <strong>Completion sound</strong>
              <small>Play a tone when you complete a task.</small>
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
          <p className="eyebrow">Schedule</p>
          <h2>Day and reward limits.</h2>
          <label className="setting-row">
            <span>
              <strong>Day starts at</strong>
              <small>Completions before this hour belong to the previous day.</small>
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
              <small>Monday–Sunday. This cap applies only to big rewards.</small>
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
          <p className="eyebrow">Data</p>
          <h2>Backup and restore.</h2>
          <p>
            {sync.syncUser
              ? "Your notebook syncs with your Google account. Download a copy whenever you’d like an extra backup."
              : "Your notebook stays in this browser, available offline after the first visit. Back it up before clearing browser data or moving to a new device."}
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
          </p>
        </section>
        <section className="settings-panel about-panel">
          <Icon name="leaf" size={30} />
          <h2>Skibo</h2>
          <p>Tasks, rewards, and a record of what you've done.</p>
        </section>
      </div>
      {restore && (
        <Dialog title="Restore your notebook" close={() => setRestore(null)}>
          <h2>Make this your notebook?</h2>
          <p className="lede">
            This file contains {restore.tasks} tasks and {restore.events}{" "}
            history entries. Restoring replaces the notebook currently in this{" "}
            {sync.syncUser
              ? "account, including its copy on other devices"
              : "browser"}
            .
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
              onClick={async () => {
                try {
                  if (await importBackup(restore.json)) setRestore(null);
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
