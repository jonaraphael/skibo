import { useState } from "react";
import { useApp } from "../app/store";
import { TaskPeriod } from "../app/types";
import { Dotted, PageHeader, EmptyState } from "../components/Shared";
import { Icon } from "../components/Icon";
import { Herbarium } from "../components/Herbarium";
import { HoldNotice } from "../components/HoldNotice";
import { DoneToday } from "../components/DoneToday";
import { TaskRow } from "../components/TaskRow";
import { useTaskListCompletion } from "../components/useTaskListCompletion";
import { useDailyTaskMessages } from "../components/useDailyTaskMessages";
import { useWorkspace } from "../components/Workspace";
import { dayKey, prettyDate } from "../lib/schedule/calendar";
import { completedRepeat, periodFor } from "../lib/tasks/taxonomy";
import { completions } from "../lib/rewards/engine";

export const Dashboard = () => {
  const { data } = useApp();
  const { now, openTask } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const { listRef, finishing, completeRow } = useTaskListCompletion();
  const today = dayKey(now, data.preferences.dayStart);
  const done = completions(data.events).filter(
    (e) => dayKey(new Date(e.at), data.preferences.dayStart) === today,
  );
  const paid = done.filter((e) => e.reward).length;
  const periods = data.tasks
    .filter((t) => t.status === "active")
    .map((t) => periodFor(t, data.events, now, data.preferences));
  // A restarted clock with no draw yet is completable but not due.
  const group = (p: TaskPeriod) =>
    p.bucket === "anytime" && !p.drawEligible
      ? "resting"
      : completedRepeat(p)
        ? "repeat"
        : "main";
  const open = periods.filter(
    (p) =>
      (p.bucket === "today" || p.bucket === "anytime") && group(p) !== "resting",
  );
  const groups = [
    { bucket: "main", label: "" },
    { bucket: "resting", label: "Not due yet" },
    { bucket: "repeat", label: "Run it back" },
  ];
  const visible = periods
    .map((p) => finishing.get(p.task.id) ?? p)
    .filter((p) => p.bucket !== "done" && p.bucket !== "later");
  const messages = useDailyTaskMessages(today, visible);
  const filtered = visible.filter(
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
              <button
                className="done-toggle"
                aria-expanded={showDone}
                aria-controls="done-today"
                onClick={() => setShowDone((shown) => !shown)}
              >
                {done.length} done
              </button>,
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
        <div className="workspace-main" ref={listRef}>
          <section id="done-today" aria-label="Done today" hidden={!showDone}>
            {showDone && <DoneToday entries={done} />}
          </section>
          <HoldNotice onComplete={completeRow} />
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
                .filter((p) => group(p) === bucket)
                .sort((a, b) =>
                  `${a.date ?? ""}${a.time}`.localeCompare(`${b.date ?? ""}${b.time}`),
                );
              return (
                rows.length > 0 && (
                  <section key={bucket} className={`task-group ${bucket}`}>
                    {label && (
                      <div className="group-label">
                        <h3>{label}</h3>
                        <span>{rows.length}</span>
                      </div>
                    )}
                    {rows.map((p) => (
                      <TaskRow
                        key={p.task.id}
                        period={p}
                        message={messages.get(p.task.id)}
                        finishing={finishing.has(p.task.id)}
                        onComplete={completeRow}
                      />
                    ))}
                  </section>
                )
              );
            })}
          </div>
          {filtered.length === 0 && (
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
                : data.tasks.length
                  ? "See upcoming tasks in Plan."
                  : "Add a task to get started."}
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
          <Herbarium open={open.length} />
        </aside>
      </div>
    </>
  );
};
