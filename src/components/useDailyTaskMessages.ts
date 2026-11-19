import { useLayoutEffect, useMemo, useState } from "react";
import { useApp } from "../app/store";
import { DateKey, TaskPeriod } from "../app/types";
import { shuffledMessages } from "../lib/tasks/dailyMessages";
import { completedRepeat } from "../lib/tasks/taxonomy";

function loadDeck(day: DateKey, storageKey: string) {
  const cards = shuffledMessages(day);
  const assignments = new Map<string, string>();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved?.day === day && Array.isArray(saved.ids)) {
      for (const id of saved.ids.slice(0, cards.length)) {
        if (typeof id === "string" && !assignments.has(id))
          assignments.set(id, cards[assignments.size]);
      }
    }
  } catch {
    // A fresh deck also works when browser storage is unavailable.
  }
  return { cards, assignments };
}

export function useDailyTaskMessages(day: DateKey, periods: TaskPeriod[]) {
  const owner = useApp((s) => s.syncUser?.uid ?? "local");
  const storageKey = `skibo.dailyMessages.${owner}`;
  const loaded = useMemo(() => loadDeck(day, storageKey), [day, storageKey]);
  const [reserved, setReserved] = useState(loaded);
  const deck = reserved.cards === loaded.cards ? reserved : loaded;

  useLayoutEffect(() => {
    // Reserve a card once. Completed and hidden tasks keep their slots so
    // changing the list cannot give another task the same message today.
    const additions = periods
      .filter((p) => !completedRepeat(p) && !deck.assignments.has(p.task.id))
      .slice(0, deck.cards.length - deck.assignments.size);
    if (!additions.length) return;
    const assignments = new Map(deck.assignments);
    for (const { task } of additions)
      assignments.set(task.id, deck.cards[assignments.size]);
    setReserved({ cards: deck.cards, assignments });
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ day, ids: [...assignments.keys()] }),
      );
    } catch {
      // Keep this day's in-memory assignments.
    }
  }, [day, deck, storageKey, periods]);
  return deck.assignments;
}
