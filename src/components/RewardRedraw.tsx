import { canEdit, useApp } from "../app/store";
import { isRedrawOption } from "../lib/rewards/engine";
import { Completion } from "../app/types";

export const RewardRedraw = ({ entry }: { entry: Completion }) => {
  const rewards = useApp((s) => s.data.rewards);
  const redraw = useApp((s) => s.redraw);
  const disabled = useApp((s) => !canEdit(s));
  const current = entry.reward;
  if (!current) return null;
  if (!rewards.some((r) => isRedrawOption(current, r)))
    return (
      <span className="redraw-note">No other active {current.size} reward</span>
    );
  return (
    <button
      className="text-link"
      title={`Swap for another ${current.size} reward`}
      disabled={disabled}
      onClick={() => redraw(entry.id, current.id)}
    >
      Redraw
    </button>
  );
};
