import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Reward } from "../app/types";
import { starterRewards } from "../lib/rewards/rewardPools";
import { randomId, useApp } from "../app/store";
import { Icon } from "../components/Icon";
import { dayKey, localDate } from "../lib/schedule/calendar";
export const Welcome = () => {
  const { data, saveTask, change, storageError } = useApp();
  const [step, setStep] = useState(data.tasks.length ? 2 : 0);
  const [title, setTitle] = useState("");
  const [setupRewards] = useState<Reward[]>(() =>
    starterRewards().map(
      (starter) =>
        data.rewards.find((r) => r.size === starter.size) ?? {
          ...starter,
          id: randomId(),
        },
    ),
  );
  const [names, setNames] = useState(setupRewards.map((r) => r.title));
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(false);
  const submitTask = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || storageError) return;
    const today = dayKey(new Date(), data.preferences.dayStart);
    const saved = saveTask({
      title: title.trim(),
      notes: "",
      effort: "light",
      status: "active",
      schedule: {
        kind: "daily",
        start: today,
        time: "",
        every: 1,
        weekdays: [localDate(today).getDay()],
        monthDay: localDate(today).getDate(),
        unit: "days",
      },
    });
    if (saved) setStep(2);
  };
  const submitMenu = (e: FormEvent) => {
    e.preventDefault();
    if (storageError) return;
    if (names.some((name) => !name.trim())) {
      setError("Give each reward a name that feels good to you.");
      return;
    }
    const rewards = setupRewards.map((r, i) => ({
      ...r,
      title: names[i].trim(),
    }));
    const saved = change((d) => ({
      ...d,
      rewards: [
        ...d.rewards.map((r) => rewards.find((next) => next.id === r.id) ?? r),
        ...rewards.filter(
          (r) => !d.rewards.some((current) => current.id === r.id),
        ),
      ],
    }));
    if (!saved) return;
    setError("");
    setStep(3);
  };
  return (
    <section className="welcome">
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
        <p className="eyebrow">A little intention. A little good.</p>
        {step === 0 && (
          <>
            <h1>
              Small steps.
              <br />
              Something good.
            </h1>
            <p className="lede">
              A calmer place for the things you'd like to do. Finish a task,
              take a chance, and earn a reward you've chosen for yourself.
            </p>
            <div className="welcome-facts">
              <span>
                <Icon name="check" size={17} /> Your pace
              </span>
              <span>
                <Icon name="rewards" size={17} /> Your rewards
              </span>
              <span>
                <Icon name="leaf" size={17} /> Your space
              </span>
            </div>
            <button
              className="button primary"
              disabled={!!storageError}
              onClick={() => setStep(1)}
            >
              Let's begin <Icon name="arrow" size={18} />
            </button>
            <Link to="/settings" className="text-link">
              I already have a backup
            </Link>
          </>
        )}
        {step === 1 && (
          <>
            <h1>
              Start with
              <br />
              one small thing.
            </h1>
            <p className="lede">
              Something you'd like to make time for each day. You can change its
              schedule and effort later.
            </p>
            <form className="editor-form" onSubmit={submitTask}>
              <label className="field title-field">
                <span>My first intention</span>
                <input
                  autoFocus
                  maxLength={300}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Step outside for ten minutes"
                />
              </label>
              <button className="button primary" disabled={!!storageError}>
                Make a little space <Icon name="arrow" size={18} />
              </button>
            </form>
          </>
        )}
        {step === 2 && (
          <>
            <h1>
              What feels
              <br />
              good to you?
            </h1>
            <p className="lede">
              Choose a small, medium, and big reward. These are just a start;
              your menu is always yours to change.
            </p>
            <form onSubmit={submitMenu} className="editor-form">
              {["Small", "Medium", "Big"].map((size, i) => (
                <label className="field" key={size}>
                  <span>{size} reward</span>
                  <input
                    maxLength={300}
                    required
                    value={names[i] ?? ""}
                    onChange={(e) =>
                      setNames((n) =>
                        n.map((name, index) =>
                          index === i ? e.target.value : name,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={!!storageError}>
                Looks good to me <Icon name="arrow" size={18} />
              </button>
            </form>
          </>
        )}
        {step === 3 && (
          <>
            <h1>
              A little chance.
              <br />A lovely surprise.
            </h1>
            <p className="lede">
              Each completion has a 30% chance of a reward. Your effort shapes
              the size. Wins wait in your tray until you're ready.
            </p>
            <div className={`practice-card ${practice ? "revealed" : ""}`}>
              <p className="eyebrow">Practice pull · demo only</p>
              {practice ? (
                <>
                  <i className="reward-orb" />
                  <h2>{data.rewards.find((r) => r.size === "small")?.title}</h2>
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
            <button
              className="button primary"
              disabled={!!storageError}
              onClick={() => change((d) => ({ ...d, onboarded: true }))}
            >
              Start my day <Icon name="arrow" size={18} />
            </button>
          </>
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
