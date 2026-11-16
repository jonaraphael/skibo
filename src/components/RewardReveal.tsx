import { useEffect, useState } from "react";
import { useApp } from "../app/store";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { TaskHistory } from "./TaskHistory";
export const RewardReveal = () => {
  const { reveal, dismissReveal, enjoy, data } = useApp();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!reveal) return;
    setSettled(false);
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
        setSettled(true);
        if (!reveal.reward) dismissReveal();
      },
      data.preferences.reduceMotion ? 0 : 550,
    );
    return () => window.clearTimeout(timer);
  }, [
    reveal,
    dismissReveal,
    data.preferences.sound,
    data.preferences.reduceMotion,
  ]);
  if (!reveal) return null;
  if (!settled || !reveal.reward)
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
      <p className="reward-label">{reveal.reward.size}</p>
      <h2>{reveal.reward.title}</h2>
      <p className="lede">
        {reveal.taskTitle} ·{" "}
        {new Date(reveal.at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {data.tasks
        .filter((t) => t.id === reveal.taskId)
        .map((t) => (
          <div className="reveal-history" key={t.id}>
            <TaskHistory task={t} />
          </div>
        ))}
      <div className="two-col">
        <button className="button secondary" onClick={() => enjoy(reveal.id)}>
          Enjoy now <Icon name="check" size={17} />
        </button>
        <button className="button primary" onClick={dismissReveal}>
          Keep in tray
        </button>
      </div>
      <button
        className="text-link reveal-undo"
        onClick={() => useApp.getState().undo(reveal.id)}
      >
        Undo
      </button>
    </Dialog>
  );
};
