import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useApp } from "../app/store";
import { TaskPeriod } from "../app/types";
import { completions } from "../lib/rewards/engine";

// The check draws for 260ms. The wipe runs from 480ms to 1040ms,
// leaving a second pause before the other rows start moving.
const slideStartsAt = 1240;
const slideDuration = 440;
export const completionDuration = slideStartsAt + slideDuration;
export const reduceCompletionMotion = (preference: boolean) =>
  preference || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Include group labels and the add button so changes between sections also glide.
const listItems = (list: HTMLElement) =>
  [...list.querySelectorAll<HTMLElement>(".task-row, .task-group > .group-label, .add-intention")];

function slideIntoPlace(list: HTMLElement, taskId: string, release: () => void) {
  const items = listItems(list);
  const exiting = items.find((el) => el.dataset.taskId === taskId);
  if (!exiting?.classList.contains("finishing") || !exiting.animate) {
    release();
    return;
  }

  // Measure within the list. Mobile browsers can scroll the viewport when
  // removing a row shortens the page near the bottom.
  const before = list.getBoundingClientRect();
  const tops = new Map(items.map((el) => [el, el.getBoundingClientRect().top - before.top]));
  // If two rows finish close together, start from their on-screen positions.
  for (const el of [list, ...items])
    el.getAnimations().find((animation) => animation.id === "task-list-move")?.cancel();

  flushSync(release);
  const timing = {
    id: "task-list-move",
    duration: slideDuration,
    easing: "cubic-bezier(.25,.8,.25,1)",
  };
  const after = list.getBoundingClientRect();
  if (before.height > after.height)
    list.animate([{ minHeight: `${before.height}px` }, { minHeight: `${after.height}px` }], timing);
  for (const el of listItems(list)) {
    if (el.dataset.taskId === taskId && !el.classList.contains("finishing")) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], timing);
      continue;
    }
    const previousTop = tops.get(el);
    if (previousTop === undefined) continue;
    const offset = previousTop - (el.getBoundingClientRect().top - after.top);
    if (Math.abs(offset) > 0.5)
      el.animate([{ transform: `translateY(${offset}px)` }, { transform: "none" }], timing);
  }
}

export const useTaskListCompletion = () => {
  const { complete, data } = useApp();
  const listRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState<TaskPeriod[]>([]);
  // Keep the completed occurrence in its original position during its exit.
  // Checking the live journal also makes Undo cancel the exit immediately.
  const finishedUnits = new Set(
    submitted.length ? completions(data.events).map((e) => e.period) : [],
  );
  const finishing = new Map(
    submitted.filter((p) => finishedUnits.has(p.key)).map((p) => [p.task.id, p]),
  );
  const completeRow = async (period: TaskPeriod) => {
    if (reduceCompletionMotion(data.preferences.reduceMotion))
      return complete(period);

    setSubmitted((rows) => [...rows, period]);
    try {
      await complete(period);
      await new Promise((resolve) => window.setTimeout(resolve, slideStartsAt));
    } finally {
      const release = () => setSubmitted((rows) => rows.filter((p) => p !== period));
      const list = listRef.current;
      if (list && !reduceCompletionMotion(useApp.getState().data.preferences.reduceMotion))
        slideIntoPlace(list, period.task.id, release);
      else release();
    }
  };
  return { listRef, finishing, completeRow };
};
