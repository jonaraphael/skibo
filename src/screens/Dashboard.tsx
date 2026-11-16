import { Link } from "react-router-dom";
import { useState } from "react";
import { useApp } from "../app/store";
import { TaskPeriod } from "../app/types";
import { Dotted, PageHeader, EmptyState } from "../components/Shared";
import { Icon } from "../components/Icon";
import { HoldNotice } from "../components/HoldNotice";
import { TaskRow } from "../components/TaskRow";
import { useWorkspace } from "../components/Workspace";
import { dayKey, prettyDate } from "../lib/schedule/calendar";
import { periodFor } from "../lib/tasks/taxonomy";
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
    { bucket: "late", label: "Overdue" },
    { bucket: "today", label: "Today" },
    { bucket: "anytime", label: "Anytime" },
    { bucket: "done", label: "Done" },
  ];
  const tray = trayRewards(data.events);
  const filtered = periods.filter(
    (p) => filter === "all" || p.task.effort === filter,
  );
  return (
    <>
      <PageHeader
        title={prettyDate(today, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        description={
          <Dotted
            items={[
              `${done.length} done`,
              `${paid} reward${paid === 1 ? "" : "s"}`,
              `${open.length} open`,
            ]}
          />
        }
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
          <HoldNotice />
          <div className="list-heading">
            <h2>
              Tasks <span>{open.length}</span>
            </h2>
            <div className="filter-pills" aria-label="Filter by effort">
              {["all", "light", "solid", "heavy"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  className={filter === f ? "selected" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f}
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
                  ? "No tasks at this effort."
                  : data.tasks.length
                    ? "No tasks due."
                    : "No tasks yet."
              }
            >
              {filter !== "all"
                ? "Try another filter or add a task."
                : "Add a task to get started, or use Plan to see upcoming tasks."}
            </EmptyState>
          )}
          <button className="add-intention" onClick={() => openTask()}>
            <span>
              <Icon name="plus" size={18} />
            </span>{" "}
            Add task
          </button>
        </div>
        <aside className="workspace-aside">
          <section className="tray-panel">
            <div className="panel-heading">
              <p className="eyebrow">
                <i className="reward-dot" /> Tray
              </p>
              <span className="tray-count">{tray.length}</span>
            </div>
            {tray.length ? (
              <>
                <ul className="tray-preview">
                  {[...tray].reverse().map((e) => (
                    <li key={e.id}>
                      <strong>{e.reward!.title}</strong>
                      <span>
                        <Dotted
                          items={[
                            e.reward!.size,
                            e.taskTitle,
                            dayKey(
                              new Date(e.at),
                              data.preferences.dayStart,
                            ) === today
                              ? "today"
                              : prettyDate(
                                  dayKey(
                                    new Date(e.at),
                                    data.preferences.dayStart,
                                  ),
                                ),
                          ]}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  className="button reward-button full-width"
                  to="/rewards/tray"
                >
                  Open tray <Icon name="arrow" size={17} />
                </Link>
              </>
            ) : (
              <>
                <h2>Nothing waiting.</h2>
                <p>
                  Each eligible completion has a 3 in 10 chance of a reward from
                  your menu.
                </p>
                <Link className="text-link" to="/rewards/menu">
                  Edit rewards <Icon name="arrow" size={16} />
                </Link>
              </>
            )}
          </section>
          <section className="how-it-works">
            <Link to="/rewards/record" className="text-link">
              Odds and record <Icon name="arrow" size={15} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
};
