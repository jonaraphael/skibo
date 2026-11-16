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
    <Dialog title={reward ? "Edit reward" : "New reward"} close={close}>
      <h2>{reward ? "Edit reward" : "New reward"}</h2>
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
          <legend>Reward size</legend>
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
          Choose sizes that fit your budget and time. Earned rewards keep their
          original name and size.
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
          {reward ? "Save reward" : "Add reward"}
        </button>
      </form>
      <details className="suggestions">
        <summary>
          Reward ideas <span>{REWARD_SUGGESTIONS.length} ideas</span>
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
