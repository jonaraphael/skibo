import { canEdit, useApp } from "../app/store";
import { redrawOptions, RewardCompletion } from "../lib/rewards/engine";

export const RewardRedraw = ({ entry }: { entry: RewardCompletion }) => {
  const rewards = useApp((s) => s.data.rewards);
  const redraw = useApp((s) => s.redraw);
  const disabled = useApp((s) => !canEdit(s));
  const current = entry.reward;
  if (!current) return null;
  if (!redrawOptions(entry, rewards).length)
    return (
      <span className="redraw-note">
        {entry.redrawn ? "Redraw used" : `No other active ${current.size} reward`}
      </span>
    );
  return (
    <button
      className="text-link"
      title={`Swap for another ${current.size} reward`}
      disabled={disabled}
      onClick={() => redraw(entry.id, current.id)}
    >
      Redraw once
    </button>
  );
};
