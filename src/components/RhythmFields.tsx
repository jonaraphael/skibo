import { Schedule, TaskBehavior } from "../app/types";
import { addDays } from "../lib/schedule/calendar";
import { ruleSummary, taskType } from "../lib/tasks/taxonomy";

export const RhythmFields = ({
  schedule: s,
  behavior: b,
  today,
  change,
}: {
  schedule: Schedule;
  behavior: TaskBehavior;
  today: string;
  change: (schedule: Schedule, behavior: TaskBehavior) => void;
}) => {
  const patch = (part: Partial<Schedule>) => change({ ...s, ...part }, b);
  const rules = (part: Partial<TaskBehavior>) => change(s, { ...b, ...part });
  const calendar = s.kind !== "after";
  const type = taskType(s, b);
  const choice = (
    label: string,
    selected: boolean,
    choose: () => void,
    hint: string,
  ) => (
    <label className={`rhythm-choice ${selected ? "selected" : ""}`}>
      <input type="radio" name={hint} checked={selected} onChange={choose} />
      <span>{label}</span>
    </label>
  );
  return (
    <>
      <fieldset className="rhythm-question">
        <legend>If you did it twice today, would the second time count?</legend>
        <div className="rhythm-choices">
          {choice(
            "Yes, each session counts",
            b.payoff === "more",
            () => rules({ payoff: "more" }),
            "payoff",
          )}
          {choice(
            "No, it needs time",
            b.payoff === "accrues",
            () => rules({ payoff: "accrues" }),
            "payoff",
          )}
        </div>
      </fieldset>
      <fieldset className="rhythm-question">
        <legend>What makes it due?</legend>
        <div className="rhythm-choices">
          {choice(
            "A date on the calendar",
            calendar,
            () =>
              change(
                {
                  ...s,
                  kind: "daily",
                  start: b.cost === "cliff" ? addDays(today, 7) : today,
                  every: 7,
                  time: "",
                },
                { ...b, windowStart: today },
              ),
            "clock",
          )}
          {choice(
            "Time since I last did it",
            !calendar,
            () =>
              change(
                {
                  ...s,
                  kind: "after",
                  start: today,
                  every: 7,
                  unit: "days",
                  time: "",
                },
                b,
              ),
            "clock",
          )}
        </div>
        <p className="field-hint">
          For the gym, choose whether an empty week or a long gap is what
          matters to you.
        </p>
      </fieldset>
      <fieldset className="rhythm-question">
        <legend>What happens if you wait?</legend>
        <div className="rhythm-choices">
          {choice(
            "A little worse each day",
            b.cost === "ramp",
            () => rules({ cost: "ramp" }),
            "cost",
          )}
          {choice(
            "Fine for a while, then costly",
            b.cost === "cliff",
            () => {
              const start =
                calendar && s.start! <= b.windowStart
                  ? addDays(b.windowStart, 7)
                  : s.start;
              change(
                { ...s, start },
                { ...b, cost: "cliff", lead: Math.min(1, s.every / 2) },
              );
            },
            "cost",
          )}
        </div>
      </fieldset>
      <div className="rhythm-timing form-stack">
        <div className="two-col">
          {calendar && b.cost === "cliff" && (
            <label className="field">
              <span>Window opens</span>
              <input
                required
                type="date"
                min="1900-01-01"
                max={s.start!}
                value={b.windowStart}
                onChange={(e) => rules({ windowStart: e.target.value })}
              />
            </label>
          )}
          <label className="field">
            <span>
              {!calendar
                ? "Last done (or clock starts)"
                : b.cost === "cliff"
                  ? "First deadline"
                  : "First start date"}
            </span>
            <input
              required
              type="date"
              min={
                calendar && b.cost === "cliff" ? b.windowStart : "1900-01-01"
              }
              max="9900-12-31"
              value={s.start ?? ""}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </label>
          {calendar && (
            <label className="field">
              <span>Repeats</span>
              <select
                value={s.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as Schedule["kind"] })
                }
              >
                <option value="once">Once</option>
                <option value="daily">Every N days</option>
                <option value="weekly">Selected weekdays</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          )}
        </div>
        {s.kind !== "once" && (
          <div className="two-col">
            <label className="field">
              <span>Every</span>
              <input
                required
                type="number"
                min={1}
                max={365}
                value={s.every}
                onChange={(e) => patch({ every: Number(e.target.value) })}
              />
            </label>
            {!calendar ? (
              <label className="field">
                <span>Interval unit</span>
                <select
                  value={s.unit}
                  onChange={(e) =>
                    patch({ unit: e.target.value as Schedule["unit"] })
                  }
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="hours">hours</option>
                </select>
              </label>
            ) : (
              <span className="unit-label">
                {s.kind === "daily"
                  ? "days"
                  : s.kind === "weekly"
                    ? "weeks"
                    : "months"}
              </span>
            )}
          </div>
        )}
        {s.kind === "weekly" && (
          <fieldset>
            <legend>On these days</legend>
            <div className="weekday-picker">
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day, i) => (
                <button
                  key={day}
                  type="button"
                  className={`chip ${s.weekdays.includes(i) ? "selected" : ""}`}
                  aria-label={day}
                  aria-pressed={s.weekdays.includes(i)}
                  onClick={() =>
                    patch({
                      weekdays: s.weekdays.includes(i)
                        ? s.weekdays.length > 1
                          ? s.weekdays.filter((d) => d !== i)
                          : s.weekdays
                        : [...s.weekdays, i].sort(),
                    })
                  }
                >
                  {day.slice(0, 2)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {s.kind === "monthly" && (
          <>
            <label className="field">
              <span>Monthly pattern</span>
              <select
                value={s.nthWeekday ? "weekday" : "date"}
                onChange={(e) =>
                  patch({
                    nthWeekday:
                      e.target.value === "weekday"
                        ? { nth: 1, weekday: 1 }
                        : undefined,
                  })
                }
              >
                <option value="date">Day of the month</option>
                <option value="weekday">Nth weekday</option>
              </select>
            </label>
            {s.nthWeekday ? (
              <div className="two-col">
                <label className="field">
                  <span>Which week</span>
                  <select
                    value={s.nthWeekday.nth}
                    onChange={(e) =>
                      patch({
                        nthWeekday: {
                          ...s.nthWeekday!,
                          nth: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[1, 2, 3, 4, -1].map((n) => (
                      <option key={n} value={n}>
                        {n === -1 ? "Last" : n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Weekday</span>
                  <select
                    value={s.nthWeekday.weekday}
                    onChange={(e) =>
                      patch({
                        nthWeekday: {
                          ...s.nthWeekday!,
                          weekday: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="field">
                <span>Day of month (short months use their last day)</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={31}
                  value={s.monthDay}
                  onChange={(e) => patch({ monthDay: Number(e.target.value) })}
                />
              </label>
            )}
          </>
        )}
        {b.payoff === "more" && (
          <div className="two-col">
            <label className="field">
              <span>One unit of work</span>
              <input
                required
                maxLength={60}
                placeholder="e.g. chapter or 20-minute session"
                value={b.unitLabel}
                onChange={(e) => rules({ unitLabel: e.target.value })}
              />
            </label>
            {calendar && (
              <label className="field">
                <span>
                  {type === "Target"
                    ? "Units to finish per window"
                    : "Units added each round"}
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  max={1000000}
                  value={b.goal}
                  onChange={(e) => rules({ goal: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
        )}
        {b.cost === "cliff" && type !== "Target" && (
          <label className="field">
            <span>
              Hold starts this far before the real limit (
              {calendar ? "days" : s.unit})
            </span>
            <input
              required
              type="number"
              min={0.01}
              max={calendar ? 365 : Math.max(0.01, s.every - 0.01)}
              step="any"
              value={b.lead}
              onChange={(e) => rules({ lead: Number(e.target.value) })}
            />
          </label>
        )}
        {!calendar && b.payoff === "accrues" && (
          <label className="field">
            <span>Draw opens this far to due (%)</span>
            <input
              required
              type="number"
              min={0}
              max={100}
              value={Math.round(b.opening * 100)}
              onChange={(e) => rules({ opening: Number(e.target.value) / 100 })}
            />
          </label>
        )}
        <details className="additional">
          <summary>
            Time <span>optional</span>
          </summary>
          <label className="field">
            <span>{calendar ? "Local time" : "Initial clock time"}</span>
            <input
              type="time"
              value={s.time}
              onChange={(e) => patch({ time: e.target.value })}
            />
          </label>
        </details>
      </div>
      <div className="rhythm-summary" aria-label="Your task rules">
        <p className="eyebrow">Your rhythm · {type}</p>
        <p>{ruleSummary(s, b)}</p>
        {b.cost === "cliff" && (
          <p>
            A hold locks the whole reward tray. Rewards stay yours. Declaring a
            miss forfeits this round’s draw and marks your record.
          </p>
        )}
      </div>
    </>
  );
};
