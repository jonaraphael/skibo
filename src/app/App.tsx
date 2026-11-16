import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon";
import { WorkspaceContext } from "../components/Workspace";
import { Toast } from "../components/Toast";
import { readStoredData } from "../lib/persistence/storage";
import { RewardReveal } from "../components/RewardReveal";
import { TaskEditor } from "../screens/TaskEditor";
import { RewardEditor } from "../screens/RewardEditor";
import { Welcome } from "../screens/Welcome";
import { downloadBackup } from "../screens/Settings";
import { trayRewards } from "../lib/rewards/engine";
import { AppRoutes } from "./routes";
import { useApp } from "./store";
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
  const [reward, setReward] = useState<Reward | null | undefined>();
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
  if (state.loadError)
    return (
      <div className="storage-gate">
        <Icon name="leaf" size={32} />
        <h1>Unable to open your notebook.</h1>
        <p role="alert">{state.loadError}</p>
        <p>
          Existing browser data has been kept. Try reopening the app with
          browser storage enabled.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
        <button
          className="button secondary"
          onClick={() => {
            void readStoredData()
              .then(downloadBackup)
              .catch((error: unknown) =>
                setRecoveryError(
                  error instanceof Error
                    ? error.message
                    : "The stored data could not be read.",
                ),
              );
          }}
        >
          Download stored data
        </button>
        {recoveryError && <p role="alert">{recoveryError}</p>}
      </div>
    );
  if (!state.loaded)
    return (
      <div className="storage-gate" role="status">
        <Icon name="leaf" size={32} /> Opening Skibo…
      </div>
    );
  return (
    <WorkspaceContext.Provider
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
                  {state.storageError
                    ? "Backup needed"
                    : state.pending
                      ? "Saving…"
                      : "Saved on this device"}
                </span>
              </div>
            </>
          )}
        </aside>
        <div className="app-content">
          <header className="workspace-topbar">
            <span className="desktop-breadcrumb">
              {currentLabel}
            </span>
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
              disabled={!!state.storageError}
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
