import { Link } from "react-router-dom";
import { useState } from "react";
import { useApp } from "../app/store";
import { TaskPeriod } from "../app/types";
import { PageHeader, EmptyState } from "../components/Shared";
import { Icon } from "../components/Icon";
import { RecordChart } from "../components/RecordChart";
import { TaskRow } from "../components/TaskRow";
import { useWorkspace } from "../components/Workspace";
import { dayKey, periodFor, prettyDate } from "../lib/schedule/calendar";
import { completions, trayRewards } from "../lib/rewards/engine";

export const Dashboard = () => {
  const { data } = useApp();
  const { now, openTask } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const today = dayKey(now, data.preferences.dayStart);
  const done = completions(data.events).filter(
    (e) => dayKey(new Date(e.at), data.preferences.dayStart) === today,
  );
  const paid = done.filter((e) => e.reward).length;
  const periods = data.tasks
    .filter((t) => t.status === "active")
    .map((t) => periodFor(t, data.events, now, data.preferences))
    .filter(
      (p) => p.bucket !== "done" || done.some((e) => e.taskId === p.task.id),
    );
  const open = periods.filter((p) =>
    ["late", "today", "anytime"].includes(p.bucket),
  );
  const groups: { bucket: TaskPeriod["bucket"]; label: string }[] = [
    { bucket: "late", label: "A little overdue" },
    { bucket: "today", label: "For today" },
    { bucket: "anytime", label: "Whenever you're ready" },
    { bucket: "done", label: "Done & dusted" },
  ];
  const tray = trayRewards(data.events);
  const filtered = periods.filter(
    (p) => filter === "all" || p.task.effort === filter,
  );
  return (
    <>
      <PageHeader
        eyebrow={prettyDate(today, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title="A little progress, every day."
        description="Make space for what matters. Let something good follow."
      >
        <button
          className="button primary desktop-add"
          onClick={() => openTask()}
        >
          <Icon name="plus" size={18} /> Add a task
        </button>
      </PageHeader>
      <div className="workspace-columns">
        <div className="workspace-main">
          <section className="daily-record panel">
            <div className="panel-heading">
              <p className="eyebrow">Today's little wins</p>
              <Link to="/rewards/record" className="text-link">
                Your record <Icon name="arrow" size={15} />
              </Link>
            </div>
            <div className="daily-numbers">
              <div>
                <strong>{done.length}</strong>
                <span>tasks done</span>
              </div>
              <div className="reward-number">
                <strong>{paid}</strong>
                <span>rewards earned</span>
              </div>
              <span className="remaining-pill">
                {open.length === 0
                  ? "Room to breathe"
                  : `${open.length} still to go`}
              </span>
            </div>
            <RecordChart events={done} compact />
          </section>
          <div className="list-heading">
            <h2>
              Your intentions <span>{open.length}</span>
            </h2>
            <div className="filter-pills" aria-label="Filter by effort">
              {["all", "light", "solid", "heavy"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  className={filter === f ? "selected" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All effort" : f}
                </button>
              ))}
            </div>
          </div>
          <div className="task-groups">
            {groups.map(({ bucket, label }) => {
              const rows = filtered
                .filter((p) => p.bucket === bucket)
                .sort((a, b) =>
                  `${a.date ?? ""}${a.time}`.localeCompare(
                    `${b.date ?? ""}${b.time}`,
                  ),
                );
              return (
                rows.length > 0 && (
                  <section key={bucket} className={`task-group ${bucket}`}>
                    <div className="group-label">
                      <h3>{label}</h3>
                      <span>{rows.length}</span>
                    </div>
                    {rows.map((p) => (
                      <TaskRow key={p.task.id} period={p} />
                    ))}
                  </section>
                )
              );
            })}
          </div>
          {filtered.every((p) => p.bucket === "later") && (
            <EmptyState
              title={
                filter !== "all"
                  ? "Nothing here at this effort."
                  : data.tasks.length
                    ? "A little room to breathe."
                    : "Every good day starts somewhere."
              }
            >
              {filter !== "all"
                ? "Try another filter, or add a new intention."
                : "Add something you'd like to do, or enjoy the space you've made."}
            </EmptyState>
          )}
          <button className="add-intention" onClick={() => openTask()}>
            <span>
              <Icon name="plus" size={18} />
            </span>{" "}
            Add a little intention
          </button>
          <p className="quiet-note">Progress counts. Even when it's small.</p>
        </div>
        <aside className="workspace-aside">
          <section className="tray-panel">
            <div className="panel-heading">
              <p className="eyebrow">
                <i className="reward-dot" /> Your reward tray
              </p>
              <span className="tray-count">{tray.length}</span>
            </div>
            {tray.length ? (
              <>
                <div className="tray-illustration" aria-hidden="true">
                  <i />
                  <i />
                  <span />
                </div>
                <h2>Something good is waiting.</h2>
                <p>
                  {tray.length}{" "}
                  {tray.length === 1
                    ? "reward, earned by you."
                    : "rewards, earned by you."}{" "}
                  Take them at your own pace.
                </p>
                <Link
                  className="button reward-button full-width"
                  to="/rewards/tray"
                >
                  Open your tray <Icon name="arrow" size={17} />
                </Link>
              </>
            ) : (
              <>
                <div className="tray-illustration empty" aria-hidden="true">
                  <i />
                  <i />
                  <span />
                </div>
                <h2>A place for good things.</h2>
                <p>
                  Each task you finish has a 3 in 10 chance of earning a reward
                  you chose.
                </p>
                <Link className="text-link" to="/rewards/menu">
                  Make it your menu <Icon name="arrow" size={16} />
                </Link>
              </>
            )}
          </section>
          <section className="how-it-works">
            <span className="eyebrow">A small, happy loop</span>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Do your thing.</strong>
                  <p>One task. At your own pace.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Take a chance.</strong>
                  <p>Every completion gets a roll.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Enjoy what's yours.</strong>
                  <p>Rewards wait until you're ready.</p>
                </div>
              </li>
            </ol>
            <Link to="/rewards/record" className="text-link">
              See the odds, openly <Icon name="arrow" size={15} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
};
