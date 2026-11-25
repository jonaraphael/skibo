import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Effort, RewardSize } from "../app/types";
import { rewardExamples } from "../lib/rewards/rewardPools";
import { canEdit, randomId, useApp } from "../app/store";
import { Icon } from "../components/Icon";
import { Mark, Sprig } from "../components/Marks";
import { useWorkspace } from "../components/Workspace";
import { dayKey } from "../lib/schedule/calendar";
import { Answered, RhythmFields } from "../components/RhythmFields";
import { defaultBehavior, defaultSchedule } from "../lib/tasks/taxonomy";
import { availableMix } from "../lib/rewards/engine";

const tiers = [
  {
    effort: "light",
    size: "small",
    label: "Small",
    hint: "Light effort",
  },
  {
    effort: "solid",
    size: "medium",
    label: "Medium",
    hint: "Solid effort",
  },
  {
    effort: "heavy",
    size: "big",
    label: "Big",
    hint: "Heavy effort",
  },
] as const;

export const Welcome = () => {
  const { data, saveTask, change, notify } = useApp();
  const storageError = useApp((s) => !canEdit(s));
  const { openTask } = useWorkspace();
  const navigate = useNavigate();
  const firstTask = data.tasks[0];
  const [step, setStep] = useState(firstTask ? 2 : 0);
  const [title, setTitle] = useState(firstTask?.title ?? "");
  const today = dayKey(new Date(), data.preferences.dayStart);
  const [schedule, setSchedule] = useState(
    firstTask?.schedule ?? defaultSchedule(today),
  );
  const [behavior, setBehavior] = useState(
    firstTask?.behavior ?? defaultBehavior(today),
  );
  const [answered, setAnswered] = useState<Answered>({
    payoff: !!firstTask,
    clock: !!firstTask,
    cost: !!firstTask,
  });
  // A resumed setup may contain a draft saved before effort was chosen.
  const [effort, setEffort] = useState<Effort | null>(null);
  const [names, setNames] = useState(["", "", ""]);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  // Each step starts at its heading, not wherever the last step was scrolled.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo(0, 0);
    // Keep an autofocused field; otherwise start keyboard focus at the heading.
    if (!document.activeElement || document.activeElement === document.body)
      heading.current?.focus({ preventScroll: true });
  }, [step]);
  const mix = effort ? availableMix(effort, data.rewards) : null;
  const practiceSize = tiers.find(
    (tier) => tier.effort === (effort ?? "solid"),
  )!.size;
  const practiceReward =
    data.rewards.find(
      (r) =>
        r.active &&
        r.size === practiceSize &&
        r.title ===
          names[
            tiers.findIndex((tier) => tier.effort === (effort ?? "solid"))
          ].trim(),
    ) ?? rewardExamples(practiceSize, data.rewards)[0];

  const submitTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Name the task first.");
      return;
    }
    if (!Object.values(answered).every(Boolean)) {
      setError("Answer all three questions.");
      return;
    }
    if (storageError) return;
    const saved = await saveTask(
      {
        title: title.trim(),
        notes: firstTask?.notes ?? "",
        effort: effort ?? "solid",
        status: firstTask?.status ?? "active",
        schedule,
        behavior: { ...behavior, unitLabel: behavior.unitLabel.trim() },
      },
      firstTask?.id,
    );
    if (saved) {
      notify(null);
      setError("");
      setStep(2);
    } else
      setError(
        "Check the dates, interval, and safety margin before continuing.",
      );
  };
  const submitMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (storageError || !firstTask) return;
    if (!effort) {
      setError("Choose an effort level.");
      return;
    }
    if (names.some((name) => name.length > 0 && !name.trim())) {
      setError("Give each reward you add a name, or leave it empty.");
      return;
    }
    const additions = tiers.flatMap((tier, i) => {
      const name = names[i].trim();
      return name &&
        !data.rewards.some((r) => r.title === name && r.size === tier.size)
        ? [{ id: randomId(), title: name, size: tier.size, active: true }]
        : [];
    });
    const saved = await change((d) => ({
      ...d,
      tasks: d.tasks.map((task) =>
        task.id === firstTask.id ? { ...task, effort } : task,
      ),
      rewards: [...d.rewards, ...additions],
    }));
    if (saved) {
      setError("");
      setPractice(false);
      setStep(3);
    }
  };
  const addHabits = async () => {
    const saved = await change((d) => ({
      ...d,
      onboarded: true,
      introductoryDraws: d.events.some(
        (e) => e.type === "completed" && e.roll !== null,
      )
        ? d.introductoryDraws
        : true,
    }));
    if (!saved) return;
    navigate("/plan");
    openTask();
  };
  const exampleList = (size: RewardSize) =>
    rewardExamples(size, data.rewards).map((reward) => (
      <li key={reward.id}>{reward.title}</li>
    ));

  const back = (
    <button
      className="text-link"
      type="button"
      onClick={() => {
        setError("");
        setStep(step - 1);
      }}
    >
      Back
    </button>
  );

  return (
    <section
      className={`welcome ${step === 0 ? "welcome-intro" : "welcome-step"}`}
    >
      {step === 0 && (
        <div className="welcome-art" aria-hidden="true">
          <Sprig />
        </div>
      )}
      <div className="welcome-content">
        {step > 0 && (
          <div className="welcome-step-head">
            <p className="eyebrow">Step {step} of 3</p>
            <div className="welcome-progress" aria-hidden="true">
              {[1, 2, 3].map((s) => (
                <i key={s} className={s <= step ? "filled" : ""} />
              ))}
            </div>
          </div>
        )}
        {step === 0 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              <span className="phrase">Do what you want</span>{" "}
              <span className="phrase">to do more often.</span>
            </h1>
            <p className="lede">
              Choose a habit and rewards worth working toward. Each day you do
              it adds a leaf. Each reward you draw adds a flower.
            </p>
            <div className="welcome-facts">
              <span>
                <Mark kind="leaf" /> A day done
              </span>
              <span>
                <Mark kind="flower" /> A reward
              </span>
              <span>
                <Mark kind="open" /> Still open
              </span>
            </div>
            <button
              className="button primary"
              disabled={!!storageError}
              onClick={() => setStep(1)}
            >
              Get started <Icon name="arrow" size={18} />
            </button>
            <Link to="/settings" className="text-link">
              I already have a backup
            </Link>
          </>
        )}
        {step === 1 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              Choose your first task.
            </h1>
            <p className="lede">
              Pick one task you keep putting off. Three questions set when it
              comes due and how its rewards work.
            </p>
            <form className="editor-form" onSubmit={submitTask}>
              <label className="field title-field">
                <span>First task</span>
                <input
                  autoFocus
                  maxLength={300}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Water the plants"
                />
              </label>
              <RhythmFields
                schedule={schedule}
                behavior={behavior}
                today={today}
                answered={answered}
                onAnswer={(q) =>
                  setAnswered((current) => ({ ...current, [q]: true }))
                }
                change={(s, b) => {
                  setSchedule(s);
                  setBehavior(b);
                }}
              />
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <div className="welcome-actions">
                <button className="button primary" disabled={!!storageError}>
                  Continue <Icon name="arrow" size={18} />
                </button>
              </div>
            </form>
          </>
        )}
        {step === 2 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              Set the effort.
            </h1>
            <p className="lede">
              Effort sets the reward size for{" "}
              <strong>“{firstTask?.title}”</strong>. Rate the effort it costs
              you, not how small it sounds.
            </p>
            <p className="welcome-menu-note">
              The menu holds {data.rewards.length} rewards. Add your own below;
              pause or edit any of them later under Rewards.
            </p>
            <form onSubmit={submitMenu} className="editor-form">
              <fieldset className="welcome-tiers">
                <legend>
                  What should doing this habit give you a chance to earn?
                </legend>
                {tiers.map((tier) => (
                  <label
                    className={`welcome-tier ${effort === tier.effort ? "selected" : ""}`}
                    key={tier.size}
                  >
                    <input
                      type="radio"
                      name="habit-effort"
                      value={tier.effort}
                      checked={effort === tier.effort}
                      onChange={() => setEffort(tier.effort)}
                      aria-label={`${tier.hint.split(" · ")[0]}, ${tier.label.toLowerCase()} rewards`}
                    />
                    <div>
                      <strong>{tier.label} rewards</strong>
                      <span className="welcome-tier-hint">{tier.hint}</span>
                      <ul>{exampleList(tier.size)}</ul>
                    </div>
                  </label>
                ))}
              </fieldset>
              {mix && (
                <p className="schedule-echo" role="status">
                  <strong>Each standard draw has a 30% chance of a reward.</strong>{" "}
                  Consecutive draws without a reward shift the size of your next win toward larger eligible gifts.
                  The starting size mix for this effort is{" "}
                  {tiers
                    .map(
                      (tier) =>
                        `${Math.round(mix[tier.size] * 100)}% ${tier.size}`,
                    )
                    .join(", ")}
                  .
                  {data.preferences.bigRewardCap !== null && (
                    <>
                      {" "}
                      Big rewards are capped at {
                        data.preferences.bigRewardCap
                      }{" "}
                      per week. Once capped, wins come from the other sizes.
                    </>
                  )}
                </p>
              )}
              <details className="additional" open={!!error}>
                <summary>
                  Add rewards of your own <span>optional</span>
                </summary>
                <div className="form-stack">
                  {tiers.map((tier, i) => (
                    <label className="field" key={tier.size}>
                      <span>{tier.label} reward</span>
                      <input
                        maxLength={300}
                        value={names[i]}
                        placeholder={
                          rewardExamples(tier.size, data.rewards)[0]?.title
                        }
                        onChange={(e) =>
                          setNames((current) =>
                            current.map((name, index) =>
                              index === i ? e.target.value : name,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <div className="welcome-actions">
                <button className="button primary" disabled={!!storageError}>
                  Continue <Icon name="arrow" size={18} />
                </button>
                {back}
              </div>
            </form>
          </>
        )}
        {step === 3 && (
          <>
            <h1 ref={heading} tabIndex={-1}>
              <span className="phrase">Finish a task.</span>{" "}
              <span className="phrase">Draw a reward.</span>
            </h1>
            <p className="lede">
              Imagine you've just finished <strong>“{firstTask?.title}”</strong>
              . Try a practice draw. Earned rewards stay in your tray until you
              use them.
            </p>
            <div className={`practice-card ${practice ? "revealed" : ""}`}>
              <p className="eyebrow">Practice pull · demo only</p>
              {practice ? (
                <>
                  <i className="reward-orb" />
                  <span className="reward-label">{practiceSize} reward</span>
                  <h2>{practiceReward?.title ?? "Practice reward"}</h2>
                  <p>
                    This practice always wins. It doesn't count in your record
                    or tray.
                  </p>
                </>
              ) : (
                <button
                  className="button secondary"
                  onClick={() => setPractice(true)}
                >
                  <Icon name="rewards" /> Try a practice pull
                </button>
              )}
            </div>
            <p className="welcome-menu-note">
              Add the other habits you want to build. Schedules and effort can
              change later.
            </p>
            <div className="welcome-actions">
              <button
                className="button primary"
                disabled={!!storageError}
                onClick={addHabits}
              >
                Add more tasks <Icon name="arrow" size={18} />
              </button>
              {back}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
