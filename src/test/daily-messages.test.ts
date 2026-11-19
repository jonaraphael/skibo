import { expect, it } from "vitest";
import { shuffledMessages } from "../lib/tasks/dailyMessages";

it("shuffles 150 distinct, five-word-or-shorter messages for each local day", () => {
  const deck = shuffledMessages("2026-11-15");
  expect(deck).toHaveLength(150);
  expect(new Set(deck).size).toBe(150);
  expect(deck.every((m) => m.trim().split(/\s+/).length <= 5)).toBe(true);
  expect(shuffledMessages("2026-11-15")).toEqual(deck);
  expect(shuffledMessages("2026-11-16")).not.toEqual(deck);
});
