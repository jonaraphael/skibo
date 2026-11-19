import { useState } from "react";
import { useApp } from "../app/store";
import { PageHeader, EmptyState } from "../components/Shared";
import { TaskRow } from "../components/TaskRow";
import { useTaskListCompletion } from "../components/useTaskListCompletion";
import { useDailyTaskMessages } from "../components/useDailyTaskMessages";
import { Icon } from "../components/Icon";
import { useWorkspace } from "../components/Workspace";
import {
  addDays,
  dayKey,
  localDate,
  matchesDay,
  prettyDate,
  weekStart,
} from "../lib/schedule/calendar";
import { periodFor } from "../lib/tasks/taxonomy";

export const Plan = () => {
  const { data } = useApp();
  const { finishing, completeRow } = useTaskListCompletion();
  const { now, openTask } = useWorkspace();
  const today = dayKey(now, data.preferences.dayStart);
  const [mode, setMode] = useState("week");
  const [week, setWeek] = useState(weekStart(today));
  const [selected, setSelected] = useState(today);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const tasks = data.tasks.filter((t) =>
    t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const periods = tasks.map((t) =>
    periodFor(t, data.events, now, data.preferences),
  );
  const todayPeriods = periods.map((p) => finishing.get(p.task.id) ?? p);
  const onDay = (date: string) =>
    (date === today ? todayPeriods : periods).filter((p) => {
      if (p.task.status !== "active") return false;
      if (
        p.bucket === "done" &&
        (date === today || p.task.schedule.kind === "once")
      )
        return false;
      if (p.bucket === "anytime" && date === today) return true;
      if (!p.date) return date === today;
      if (p.date <= today && date === today) return true;
      if (p.date === date) return true;
      return (
        date > today &&
        date > p.date &&
        ["daily", "weekly", "monthly"].includes(p.task.schedule.kind) &&
        matchesDay(p.task.schedule, date)
      );
    });
  const rows =
    mode === "all"
      ? periods.filter((p) => status === "all" || p.task.status === status)
      : onDay(selected);
  const managing = mode === "all" || selected !== today;
  const messages = useDailyTaskMessages(today, managing ? [] : rows);
  const move = (delta: number) => {
    setWeek(addDays(week, delta));
    setSelected(addDays(selected, delta));
  };
  return (
    <>
      <PageHeader title="Plan">
        <button
          className="button primary desktop-add"
          onClick={() => openTask()}
        >
          <Icon name="plus" size={18} /> Add a task
        </button>
      </PageHeader>
      <div className="toolbar">
        <div className="segmented">
          <button
            aria-pressed={mode === "week"}
            className={mode === "week" ? "selected" : ""}
            onClick={() => setMode("week")}
          >
            This week
          </button>
          <button
            aria-pressed={mode === "all"}
            className={mode === "all" ? "selected" : ""}
            onClick={() => setMode("all")}
          >
            All tasks
          </button>
        </div>
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {mode === "week" ? (
        <section className="week-panel panel">
          <div className="panel-heading">
            <h2>{prettyDate(week, { month: "long", year: "numeric" })}</h2>
            <div className="week-actions">
              <button
                className="icon-button"
                aria-label="Previous week"
                onClick={() => move(-7)}
              >
                <Icon name="back" size={17} />
              </button>
              <button
                className="text-link"
                onClick={() => {
                  setWeek(weekStart(today));
                  setSelected(today);
                }}
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label="Next week"
                onClick={() => move(7)}
              >
                <Icon name="arrow" size={17} />
              </button>
            </div>
          </div>
          <div className="week-grid">
            {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map(
              (date) => (
                <button
                  key={date}
                  className={`${selected === date ? "selected" : ""} ${date === today ? "is-today" : ""}`}
                  aria-pressed={selected === date}
                  aria-label={prettyDate(date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  onClick={() => setSelected(date)}
                >
                  <span>{prettyDate(date, { weekday: "short" })}</span>
                  <strong>{localDate(date).getDate()}</strong>
                  <i className={onDay(date).length ? "has-tasks" : ""} />
                </button>
              ),
            )}
          </div>
        </section>
      ) : (
        <div className="filter-pills status-filters">
          {["active", "paused", "archived", "all"].map((s) => (
            <button
              className={status === s ? "selected" : ""}
              key={s}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      )}
      <section className="plan-list">
        <div className="group-label">
          <h3>
            {mode === "all"
              ? `${status === "all" ? "All" : status} tasks`
              : prettyDate(selected, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
          </h3>
          <span>{rows.length}</span>
        </div>
        {rows.map((p) => (
          <TaskRow
            key={p.task.id}
            period={p}
            management={managing}
            message={messages.get(p.task.id)}
            finishing={
              mode === "week" && selected === today && finishing.has(p.task.id)
            }
            onComplete={completeRow}
          />
        ))}
        {rows.length === 0 && (
          <EmptyState title={query ? "No tasks found." : "No tasks scheduled."}>
            {query
              ? "Try a different search."
              : "Add a task or choose another day."}
          </EmptyState>
        )}
      </section>
    </>
  );
};
