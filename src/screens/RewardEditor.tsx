import { FormEvent, useState } from "react";
import { useApp } from "../app/store";
import { Reward, RewardSize } from "../app/types";
import { Dialog } from "../components/Dialog";
import { REWARD_SUGGESTIONS } from "../lib/rewards/rewardPools";
export const RewardEditor = ({
  reward,
  close,
}: {
  reward: Reward | null;
  close: () => void;
}) => {
  const save = useApp((s) => s.saveReward);
  const error = useApp((s) => s.storageError);
  const [errorText, setErrorText] = useState("");
  const [title, setTitle] = useState(reward?.title ?? "");
  const [size, setSize] = useState<RewardSize>(reward?.size ?? "small");
  const [query, setQuery] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorText("Give your reward a name.");
      return;
    }
    if (error) return;
    const saved = save(
      { title: title.trim(), size, active: reward?.active ?? true },
      reward?.id,
    );
    if (saved) close();
    else setErrorText("Check this reward before saving.");
  };
  return (
    <Dialog
      title={reward ? "Edit a good thing" : "Something to look forward to"}
      close={close}
    >
      <h2>What feels like a reward?</h2>
      <p className="lede">
        Make it yours. A moment, an experience, a little treat.
      </p>
      <form className="editor-form" onSubmit={submit}>
        <label className="field title-field">
          <span>Reward name</span>
          <input
            autoFocus
            required
            maxLength={300}
            placeholder="e.g. A coffee with no rush"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>How big does it feel?</legend>
          <div className="effort-picker">
            {(["small", "medium", "big"] as const).map((s, i) => (
              <button
                type="button"
                key={s}
                aria-pressed={size === s}
                className={size === s ? "selected" : ""}
                onClick={() => setSize(s)}
              >
                <span className={`reward-orb orb-${i}`} />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="schedule-echo">
          Sizes are personal. A small reward might be a lovely break; a big one,
          a day to yourself. Earned rewards keep their original name and size.
        </p>
        {errorText && (
          <p className="error-text" role="alert">
            {errorText}
          </p>
        )}
        <button
          type="submit"
          className="button primary full-width"
          disabled={!!error}
        >
          {reward ? "Save reward" : "Add to my menu"}
        </button>
      </form>
      <details className="suggestions">
        <summary>
          Need a little inspiration? <span>90 ideas</span>
        </summary>
        <label className="field">
          <span>Search reward ideas</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Walk, book, coffee…"
          />
        </label>
        <div className="suggestion-list">
          {REWARD_SUGGESTIONS.filter((r) =>
            r.title.toLowerCase().includes(query.toLowerCase()),
          ).map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setTitle(r.title);
                setSize(r.size);
              }}
            >
              <span>{r.title}</span>
              <small>{r.size}</small>
            </button>
          ))}
        </div>
      </details>
    </Dialog>
  );
};
