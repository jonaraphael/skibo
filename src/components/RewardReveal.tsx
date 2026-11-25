import { useEffect, useState } from "react";
import { canEdit, useApp } from "../app/store";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { Dotted } from "./Shared";
import { activeHolds } from "../lib/tasks/taxonomy";
import { useWorkspace } from "./Workspace";
import { TaskHistory } from "./TaskHistory";
import { RewardRedraw } from "./RewardRedraw";
import { trayRewards } from "../lib/rewards/engine";
import { completionDuration, reduceCompletionMotion } from "./useTaskListCompletion";
export const RewardReveal = () => {
  const { reveal, dismissReveal, enjoy, data } = useApp();
  const disabled = useApp((s) => !canEdit(s));
  const { now } = useWorkspace();
  const held = activeHolds(data, now).length > 0;
  const [settledId, setSettledId] = useState<string>();
  useEffect(() => {
    if (!reveal) return;
    if (data.preferences.sound) {
      try {
        const audio = new AudioContext();
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        tone.type = "sine";
        tone.frequency.setValueAtTime(440, audio.currentTime);
        tone.frequency.exponentialRampToValueAtTime(
          reveal.reward ? 660 : 520,
          audio.currentTime + 0.12,
        );
        gain.gain.setValueAtTime(0.05, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
        tone.connect(gain);
        gain.connect(audio.destination);
        tone.start();
        tone.stop(audio.currentTime + 0.26);
        tone.onended = () => {
          void audio.close();
        };
      } catch {
        /* Audio support is optional. */
      }
    }
    const timer = window.setTimeout(
      () => {
        setSettledId(reveal.id);
        if (!reveal.reward) dismissReveal();
      },
      reduceCompletionMotion(data.preferences.reduceMotion) ? 0 : reveal.reward ? completionDuration : 550,
    );
    return () => window.clearTimeout(timer);
  }, [
    reveal,
    dismissReveal,
    data.preferences.sound,
    data.preferences.reduceMotion,
  ]);
  if (!reveal?.reward) return null;
  const entry = trayRewards(data.events).find((e) => e.id === reveal.id);
  if (!entry?.reward) return null;
  if (settledId !== reveal.id)
    return (
      <div className="roll-status" role="status">
        <span className="rolling-lamp" />
        <span>Drawing reward…</span>
      </div>
    );
  return (
    <Dialog title="Reward" close={dismissReveal} className="reveal-sheet">
      <div className="reward-reveal-orb">
        <i />
      </div>
      <p className="reward-label">{entry.reward.size}</p>
      <h2 aria-live="polite">{entry.reward.title}</h2>
      <p className="lede">
        <Dotted
          items={[
            reveal.taskTitle,
            new Date(reveal.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          ]}
        />
      </p>
      {data.tasks
        .filter((t) => t.id === reveal.taskId)
        .map((t) => (
          <div className="reveal-history" key={t.id}>
            <TaskHistory task={t} />
          </div>
        ))}
      {held && (
        <p className="task-hold">
          The reward tray is on hold. It opens when the held tasks on Today are
          completed or declared missed.
        </p>
      )}
      <div className="two-col">
        <button
          className={`button secondary ${held ? "held" : ""}`}
          disabled={disabled || held}
          onClick={() => enjoy(reveal.id)}
        >
          {held ? "On hold" : "Enjoy now"}
          {!held && <Icon name="check" size={17} />}
        </button>
        <button className="button primary" onClick={dismissReveal}>
          Keep in tray
        </button>
      </div>
      <div className="reveal-links">
        <RewardRedraw entry={entry} />
        <button
          className="text-link"
          disabled={disabled}
          onClick={() => useApp.getState().undo(reveal.id)}
        >
          Undo completion
        </button>
      </div>
    </Dialog>
  );
};
