import { useId } from "react";
import { Schedule, TaskBehavior } from "../app/types";
import { addDays } from "../lib/schedule/calendar";
import { ruleLines, taskType, typeGloss } from "../lib/tasks/taxonomy";

export type Question = "payoff" | "clock" | "cost";
export type Answered = Record<Question, boolean>;
type Change = (schedule: Schedule, behavior: TaskBehavior) => void;
interface RhythmProps {
  schedule: Schedule;
  behavior: TaskBehavior;
  today: string;
  change: Change;
}

const Choice = ({
  name,
  title,
  example,
  selected,
  choose,
}: {
  name: string;
  title: string;
  example: string;
  selected: boolean;
  choose: () => void;
}) => {
  const id = useId();
  return (
    <label className={`rhythm-choice ${selected ? "selected" : ""}`}>
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={choose}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-example`}
      />
      <span>
        <span className="rhythm-choice-title" id={`${id}-title`}>
          {title}
        </span>
        <span className="rhythm-choice-example" id={`${id}-example`}>
          {example}
        </span>
      </span>
    </label>
  );
};

// The form explicitly tracks answers; internal schedule defaults never select a radio.
export const RhythmQuestions = ({
  schedule: s,
  behavior: b,
  today,
  change,
  answered,
  onAnswer,
}: RhythmProps & {
  answered: Answered;
  onAnswer: (question: Question) => void;
}) => {
  const group = useId();
  const calendar = s.kind !== "after";
  const shown = (q: Question, selected: boolean) => answered[q] && selected;
  const pick = (q: Question, apply: () => void) => () => {
    apply();
    onAnswer(q);
  };
  const rules = (part: Partial<TaskBehavior>) => change(s, { ...b, ...part });
  return (
    <>
      <fieldset className="rhythm-question">
        <legend>If you did it twice today, would the second time count?</legend>
        <div className="rhythm-choices">
          <Choice
            name={`${group}-payoff`}
            title="Yes, each one adds up"
            example="Practice, reading, saving"
            selected={shown("payoff", b.payoff === "more")}
            choose={pick("payoff", () => rules({ payoff: "more" }))}
          />
          <Choice
            name={`${group}-payoff`}
            title="No, once per round"
            example="Watering, laundry, rent"
            selected={shown("payoff", b.payoff === "accrues")}
            choose={pick("payoff", () => rules({ payoff: "accrues" }))}
          />
        </div>
      </fieldset>
      <fieldset className="rhythm-question">
        <legend>What makes it due?</legend>
        <div className="rhythm-choices">
          <Choice
            name={`${group}-clock`}
            title="A date on the calendar"
            example="Rent on the 1st, a weekly quota"
            selected={shown("clock", calendar)}
            choose={pick("clock", () =>
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
            )}
          />
          <Choice
            name={`${group}-clock`}
            title="Time since I last did it"
            example="Sheets 7 days after the last change"
            selected={shown("clock", !calendar)}
            choose={pick("clock", () =>
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
            )}
          />
        </div>
      </fieldset>
      <fieldset className="rhythm-question">
        <legend>What happens if you wait?</legend>
        <div className="rhythm-choices">
          <Choice
            name={`${group}-cost`}
            title="It gets worse each day"
            example="Dishes pile up, skills fade"
            selected={shown("cost", b.cost === "ramp")}
            choose={pick("cost", () => rules({ cost: "ramp" }))}
          />
          <Choice
            name={`${group}-cost`}
            title="Nothing, then a sharp cost"
            example="Plants die, a late fee lands"
            selected={shown("cost", b.cost === "cliff")}
            choose={pick("cost", () => {
              const start =
                calendar && s.start <= b.windowStart
                  ? addDays(b.windowStart, 7)
                  : s.start;
              change(
                { ...s, start },
                { ...b, cost: "cliff", lead: Math.min(1, s.every / 2) },
              );
            })}
          />
        </div>
      </fieldset>
    </>
  );
};

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const RhythmTiming = ({
  schedule: s,
  behavior: b,
  change,
}: Omit<RhythmProps, "today">) => {
  const patch = (part: Partial<Schedule>) => change({ ...s, ...part }, b);
  const rules = (part: Partial<TaskBehavior>) => change(s, { ...b, ...part });
  const calendar = s.kind !== "after";
  const type = taskType(s, b);
  const cliff = b.cost === "cliff";
  return (
    <div className="rhythm-timing form-stack">
      {!calendar ? (
        <>
          <div className="interval-row">
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
            <label className="field">
              <span>Unit</span>
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
          </div>
          <label className="field">
            <span>Last done</span>
            <input
              required
              type="date"
              min="1900-01-01"
              max="9900-12-31"
              value={s.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
            <small className="field-hint">
              Today if you are starting now. The clock runs from this date.
            </small>
          </label>
        </>
      ) : (
        <>
          <div className="interval-row">
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
            {s.kind !== "once" && (
              <label className="field">
                <span>
                  Every (
                  {s.kind === "daily"
                    ? "days"
                    : s.kind === "weekly"
                      ? "weeks"
                      : "months"}
                  )
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  max={365}
                  value={s.every}
                  onChange={(e) => patch({ every: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          {s.kind === "weekly" && (
            <fieldset>
              <legend>On these days</legend>
              <div className="weekday-picker">
                {weekdays.map((day, i) => (
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
            <div className="interval-row">
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
              {!s.nthWeekday && (
                <label className="field">
                  <span>Day of month</span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={31}
                    value={s.monthDay}
                    onChange={(e) =>
                      patch({ monthDay: Number(e.target.value) })
                    }
                  />
                </label>
              )}
            </div>
          )}
          {s.kind === "monthly" && s.nthWeekday && (
            <div className="interval-row">
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
                  {weekdays.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="interval-row">
            {cliff && (
              <label className="field">
                <span>Window opens</span>
                <input
                  required
                  type="date"
                  min="1900-01-01"
                  max={s.start}
                  value={b.windowStart}
                  onChange={(e) => rules({ windowStart: e.target.value })}
                />
              </label>
            )}
            <label className="field">
              <span>{cliff ? "First deadline" : "First start date"}</span>
              <input
                required
                type="date"
                min={cliff ? b.windowStart : "1900-01-01"}
                max="9900-12-31"
                value={s.start}
                onChange={(e) => patch({ start: e.target.value })}
              />
            </label>
          </div>
          {s.kind === "monthly" && !s.nthWeekday && s.monthDay > 28 && (
            <p className="field-hint">Shorter months use their last day.</p>
          )}
        </>
      )}
      {b.payoff === "more" && (
        <div className="interval-row">
          <label className="field">
            <span>One unit</span>
            <input
              required
              maxLength={60}
              placeholder="e.g. chapter, 20-minute session"
              value={b.unitLabel}
              onChange={(e) => rules({ unitLabel: e.target.value })}
            />
          </label>
          {calendar && (
            <label className="field">
              <span>
                {type === "Target"
                  ? "Units due by each deadline"
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
      <details className="additional">
        <summary>
          Fine-tune <span>optional</span>
        </summary>
        <div className="form-stack">
          {cliff && type !== "Target" && (
            <label className="field">
              <span>
                Hold the tray this early ({calendar ? "days" : s.unit} before
                the real limit)
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
              <span>Draws open at this share of the interval (%)</span>
              <input
                required
                type="number"
                min={0}
                max={100}
                value={Math.round(b.opening * 100)}
                onChange={(e) =>
                  rules({ opening: Number(e.target.value) / 100 })
                }
              />
            </label>
          )}
          <label className="field">
            <span>{calendar ? "Time of day" : "Time last done"}</span>
            <input
              type="time"
              value={s.time}
              onChange={(e) => patch({ time: e.target.value })}
            />
          </label>
        </div>
      </details>
      <label className="setting-row">
        <span>
          <strong>Weekdays only</strong>
          <small>Skip Saturdays and Sundays for this task.</small>
        </span>
        <input
          type="checkbox"
          aria-label="Weekdays only"
          checked={s.weekdaysOnly ?? false}
          onChange={(e) => patch({ weekdaysOnly: e.target.checked })}
        />
      </label>
    </div>
  );
};

export const RhythmSummary = ({
  schedule: s,
  behavior: b,
}: Pick<RhythmProps, "schedule" | "behavior">) => {
  const type = taskType(s, b);
  return (
    <section className="rhythm-summary" aria-label="Your task rules">
      <p className="rhythm-type">
        <strong>{type}</strong> {typeGloss[type]}
      </p>
      <dl>
        {ruleLines(s, b).map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export const RhythmFields = (
  props: RhythmProps & {
    answered: Answered;
    onAnswer: (question: Question) => void;
  },
) => {
  const complete = Object.values(props.answered).every(Boolean);
  return (
    <>
      <RhythmQuestions {...props} />
      {complete && (
        <>
          <RhythmTiming {...props} />
          <RhythmSummary {...props} />
        </>
      )}
    </>
  );
};
