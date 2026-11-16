import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon";
import { WorkspaceContext } from "../components/Workspace";
import { Dialog } from "../components/Dialog";
import { Toast } from "../components/Toast";
import { readStoredData, resetLocalNotebook } from "../lib/persistence/storage";
import { RewardReveal } from "../components/RewardReveal";
import { TaskEditor } from "../screens/TaskEditor";
import { RewardEditor } from "../screens/RewardEditor";
import { Welcome } from "../screens/Welcome";
import { downloadBackup } from "../screens/Settings";
import { trayRewards } from "../lib/rewards/engine";
import { AppRoutes } from "./routes";
import { canEdit, saveStatus, useApp } from "./store";
import { Reward, Task } from "./types";

const navigation = [
  { to: "/", label: "Today", icon: "today" },
  { to: "/plan", label: "Plan", icon: "plan" },
  { to: "/rewards/tray", label: "Rewards", icon: "rewards" },
];
export const App = () => {
  const state = useApp();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [task, setTask] = useState<Task | null | undefined>();
  const [recoveryError, setRecoveryError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [reward, setReward] = useState<Reward | null | undefined>();
  useEffect(() => {
    setTask(undefined);
    setReward(undefined);
  }, [state.syncUser?.uid]);
  useEffect(() => {
    void state.initialize();
  }, [state.initialize]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = state.data.preferences.theme;
    document.documentElement.dataset.motion = state.data.preferences
      .reduceMotion
      ? "reduce"
      : "full";
  }, [state.data.preferences]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (useApp.getState().pending > 0 || useApp.getState().storageError)
        e.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, []);
  useEffect(() => {
    void state.settle();
  }, [now, state.data, state.syncConnected, state.pending, state.settle]);
  const tray = trayRewards(state.data.events).length;
  const onboarding = !state.data.onboarded && location.pathname !== "/settings";
  const closeTask = () => setTask(undefined);
  const closeReward = () => setReward(undefined);
  const currentLabel =
    location.pathname === "/"
      ? "Today"
      : location.pathname === "/plan"
        ? "Plan"
        : location.pathname === "/settings"
          ? "Settings"
          : "Rewards";
  const downloadStored = () => {
    void readStoredData()
      .then(downloadBackup)
      .catch((error: unknown) =>
        setRecoveryError(
          error instanceof Error
            ? error.message
            : "The stored data could not be read.",
        ),
      );
  };
  if (state.loadError)
    return (
      <>
        <div className="storage-gate">
          <Icon name="leaf" size={32} />
          <h1>Unable to open your notebook.</h1>
          <p role="alert">{state.loadError}</p>
          <p>
            Your stored data has been kept. You can download it before starting
            a new notebook.
          </p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <button className="button secondary" onClick={downloadStored}>
            Download stored data
          </button>
          <button className="text-link" onClick={() => setConfirmReset(true)}>
            Start a new notebook
          </button>
          {recoveryError && <p role="alert">{recoveryError}</p>}
        </div>
        {confirmReset && (
          <Dialog
            title="Start a new notebook"
            close={() => {
              if (!resetPending) setConfirmReset(false);
            }}
          >
            <h2>Start fresh on this device?</h2>
            <p>
              This replaces the notebook saved in this browser. Download your
              stored data first if you want to keep it. Synced account notebooks
              are not deleted.
            </p>
            <button
              className="button secondary"
              disabled={resetPending}
              onClick={downloadStored}
            >
              Download stored data
            </button>
            <button
              className="button primary"
              disabled={resetPending}
              onClick={async () => {
                setResetPending(true);
                setRecoveryError("");
                try {
                  await resetLocalNotebook();
                  window.location.reload();
                } catch (error) {
                  setRecoveryError(
                    error instanceof Error
                      ? error.message
                      : "Could not start a new notebook.",
                  );
                  setResetPending(false);
                }
              }}
            >
              {resetPending ? "Starting…" : "Replace this device’s notebook"}
            </button>
            <button
              className="text-link"
              disabled={resetPending}
              onClick={() => setConfirmReset(false)}
            >
              Keep existing data
            </button>
            {recoveryError && <p role="alert">{recoveryError}</p>}
          </Dialog>
        )}
      </>
    );
  if (!state.loaded)
    return (
      <div className="storage-gate" role="status">
        <Icon name="leaf" size={32} /> Opening Skibo…
      </div>
    );
  if (state.syncLoading)
    return (
      <div className="storage-gate" role="status">
        <Icon name="leaf" size={32} /> Opening your synced notebook…
        {state.syncError && <p role="alert">{state.syncError}</p>}
        <p>
          Connecting needs internet. Your separate local notebook is kept on
          this device.
        </p>
        <button
          className="button secondary"
          disabled={state.pending > 0}
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
        {state.syncUser && (
          <button
            className="button secondary"
            disabled={state.pending > 0 || state.authPending}
            onClick={state.disconnectAccount}
          >
            Sign out
          </button>
        )}
      </div>
    );
  return (
    <WorkspaceContext.Provider
      key={state.syncUser?.uid ?? "local"}
      value={{
        openTask: (t) => setTask(t ?? null),
        openReward: (r) => setReward(r ?? null),
        now,
      }}
    >
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className={`app-shell ${onboarding ? "onboarding" : ""}`}>
        <aside className="sidebar">
          <Link className="wordmark" to="/" aria-label="Skibo home">
            <span className="brand-mark">
              <Icon name="leaf" size={21} />
            </span>
            Skibo
          </Link>
          {!onboarding && (
            <>
              <nav aria-label="Primary">
                {navigation.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === "/"}
                    className={
                      n.icon === "rewards" &&
                      location.pathname.startsWith("/rewards")
                        ? "active"
                        : undefined
                    }
                  >
                    <Icon name={n.icon} />
                    <span>{n.label}</span>
                    {n.icon === "rewards" && tray > 0 && (
                      <span className="nav-badge">{tray}</span>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="sidebar-foot">
                <NavLink to="/settings">
                  <Icon name="settings" size={19} /> Settings
                </NavLink>
                <span className="save-status" role="status">
                  <i className={state.storageError ? "failed" : ""} />
                  {saveStatus(state)}
                </span>
              </div>
            </>
          )}
        </aside>
        <div className="app-content">
          <header className="workspace-topbar">
            <span className="desktop-breadcrumb">{currentLabel}</span>
            <Link className="mobile-wordmark" to="/" aria-label="Skibo home">
              Skibo
            </Link>
            <div className="topbar-actions">
              {state.data.onboarded && (
                <Link
                  to="/rewards/tray"
                  className="tray-link"
                  aria-label={`Reward tray, ${tray} rewards`}
                >
                  <Icon name="rewards" size={18} />
                  <span>{tray}</span>
                </Link>
              )}
              <Link
                className="icon-button"
                to="/settings"
                aria-label="Settings"
              >
                <Icon name="settings" size={19} />
              </Link>
            </div>
          </header>
          {state.storageError && (
            <div className="storage-error" role="alert">
              <strong>Changes aren't being saved.</strong>
              <span>{state.storageError}</span>
              <button
                className="button secondary"
                onClick={() =>
                  downloadBackup(JSON.stringify(state.data, null, 2))
                }
              >
                Download current copy
              </button>
            </div>
          )}
          {state.syncUser && (!state.syncConnected || state.syncError) && (
            <div className="storage-error" role="status">
              <strong>
                {state.syncError ? "Sync needs attention" : "Offline—view only"}
              </strong>
              <span>
                {state.syncError ??
                  "Reconnect to edit your notebook. Your last saved copy is here."}
              </span>
              {state.syncError && (
                <button
                  className="button secondary"
                  disabled={state.pending > 0}
                  onClick={() => window.location.reload()}
                >
                  Retry sync
                </button>
              )}
            </div>
          )}
          <main id="main" tabIndex={-1}>
            {onboarding ? <Welcome /> : <AppRoutes />}
          </main>
        </div>
        {!onboarding && (
          <>
            <nav className="mobile-nav" aria-label="Mobile navigation">
              {navigation.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={
                    n.icon === "rewards" &&
                    location.pathname.startsWith("/rewards")
                      ? "active"
                      : undefined
                  }
                >
                  <span>
                    <Icon name={n.icon} size={22} />
                    {n.icon === "rewards" && tray > 0 && <i>{tray}</i>}
                  </span>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <button
              className="mobile-fab"
              aria-label="Add a task"
              disabled={!canEdit(state)}
              onClick={() => setTask(null)}
            >
              <Icon name="plus" size={24} />
            </button>
          </>
        )}
        {task !== undefined && <TaskEditor task={task} close={closeTask} />}
        {reward !== undefined && (
          <RewardEditor reward={reward} close={closeReward} />
        )}
        <RewardReveal />
        {state.toast && !state.reveal && <Toast />}
      </div>
    </WorkspaceContext.Provider>
  );
};
