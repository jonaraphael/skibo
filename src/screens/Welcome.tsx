import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Effort, RewardSize, Schedule } from "../app/types";
import { rewardExamples } from "../lib/rewards/rewardPools";
import { randomId, useApp } from "../app/store";
import { Icon } from "../components/Icon";
import { useWorkspace } from "../components/Workspace";
import { dayKey, localDate } from "../lib/schedule/calendar";
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
  const { data, saveTask, change, notify, storageError } = useApp();
  const { openTask } = useWorkspace();
  const navigate = useNavigate();
  const firstTask = data.tasks[0];
  const [step, setStep] = useState(firstTask ? 2 : 0);
  const [title, setTitle] = useState(firstTask?.title ?? "");
  const [repeat, setRepeat] = useState<Schedule["kind"]>(
    firstTask?.schedule.kind ?? "daily",
  );
  const [effort, setEffort] = useState<Effort>(firstTask?.effort ?? "solid");
  const [names, setNames] = useState(["", "", ""]);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(false);
  const mix = availableMix(effort, data.rewards);
  const practiceSize = tiers.find((tier) => tier.effort === effort)!.size;
  const practiceReward =
    data.rewards.find(
      (r) =>
        r.active &&
        r.size === practiceSize &&
        r.title ===
          names[tiers.findIndex((tier) => tier.effort === effort)].trim(),
    ) ?? rewardExamples(practiceSize, data.rewards)[0];

  const submitTask = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Write down one habit you'd like to build.");
      return;
    }
    if (storageError) return;
    const today = dayKey(new Date(), data.preferences.dayStart);
    const saved = saveTask(
      {
        title: title.trim(),
        notes: firstTask?.notes ?? "",
        effort,
        status: firstTask?.status ?? "active",
        schedule: {
          ...(firstTask?.schedule ?? {
            start: today,
            time: "",
            every: 1,
            weekdays: [localDate(today).getDay()],
            monthDay: localDate(today).getDate(),
            unit: "days",
          }),
          kind: repeat,
        },
      },
      firstTask?.id,
    );
    if (saved) {
      notify(null);
      setError("");
      setStep(2);
    }
  };
  const submitMenu = (e: FormEvent) => {
    e.preventDefault();
    if (storageError || !firstTask) return;
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
    const saved = change((d) => ({
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
  const addHabits = () => {
    if (!change((d) => ({ ...d, onboarded: true }))) return;
    navigate("/plan");
    openTask();
  };
  const exampleList = (size: RewardSize) =>
    rewardExamples(size, data.rewards).map((reward) => (
      <li key={reward.id}>{reward.title}</li>
    ));

  return (
    <section className={`welcome ${step === 2 ? "welcome-menu" : ""}`}>
      <div className="welcome-art" aria-hidden="true">
        <div className="welcome-orbit orbit-one" />
        <div className="welcome-orbit orbit-two" />
        <div className="welcome-orbit orbit-three" />
        <div className="welcome-leaf">
          <Icon name="leaf" size={54} />
        </div>
        <i className="floating-orb orb-one" />
        <i className="floating-orb orb-two" />
        <i className="floating-orb orb-three" />
      </div>
      <div className="welcome-content">
        <p className="eyebrow">Skibo</p>
        {step === 0 && (
          <>
            <h1>
              Do what you want
              <br />
              to do more often.
            </h1>
            <p className="lede">
              Choose a habit and rewards worth working toward. Complete the
              task, draw for a reward, and see your history build.
            </p>
            <div className="welcome-facts">
              <span>
                <Icon name="check" size={17} /> Tasks
              </span>
              <span>
                <Icon name="rewards" size={17} /> Rewards
              </span>
              <span>
                <Icon name="leaf" size={17} /> History
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
            <h1>Choose your first task.</h1>
            <p className="lede">
              Something you want to do regularly, but find hard to get yourself
              to do. Start with one; there will be room for the rest.
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
                  placeholder="e.g. Do ten minutes of mobility"
                />
              </label>
              <label className="field">
                <span>How often?</span>
                <select
                  value={repeat}
                  onChange={(e) =>
                    setRepeat(e.target.value as Schedule["kind"])
                  }
                >
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
              </label>
              <p className="schedule-echo">
                You can fine-tune the days and timing later. Missed days won't
                pile up.
              </p>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={!!storageError}>
                Continue <Icon name="arrow" size={18} />
              </button>
            </form>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Set the effort.</h1>
            <p className="lede">
              For <strong>“{firstTask?.title}”</strong>, what level of reward
              would help you get started? Judge the effort it takes you, even if
              the habit sounds small.
            </p>
            <p className="welcome-menu-note">
              Your menu has {data.rewards.length} rewards. Keep the ones you
              want, pause others, or add your own.
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
              <p className="schedule-echo" role="status">
                Each completion has a <strong>30% chance of a reward.</strong>{" "}
                When you win with this effort:{" "}
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
                    per week; once capped, wins come from the other sizes.
                  </>
                )}
              </p>
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
              <button className="button primary" disabled={!!storageError}>
                Continue <Icon name="arrow" size={18} />
              </button>
            </form>
          </>
        )}
        {step === 3 && (
          <>
            <h1>Finish a task. Draw a reward.</h1>
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
            <div className="welcome-next">
              <h2>Add more tasks</h2>
              <p>
                Add the other habits you want to build. You can adjust their
                schedules and effort later.
              </p>
            </div>
            <button
              className="button primary"
              disabled={!!storageError}
              onClick={addHabits}
            >
              Add more tasks <Icon name="arrow" size={18} />
            </button>
          </>
        )}
        {step > 1 && (
          <button
            className="text-link welcome-back"
            type="button"
            onClick={() => {
              setError("");
              setStep(step - 1);
            }}
          >
            Back
          </button>
        )}
        {step > 0 && (
          <div
            className="welcome-progress"
            aria-label={`Setup step ${step} of 3`}
          >
            {[1, 2, 3].map((s) => (
              <i key={s} className={s <= step ? "filled" : ""} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
