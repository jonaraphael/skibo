import type { Notebook } from "../../app/types";
import { completions } from "../rewards/engine";
import { seedPackets } from "./specimens";

export interface Sowing {
  seed: string;
  at: string;
  start: number;
}

export function gardenPlants(data: Notebook) {
  const sowings = data.garden ?? [];
  const completed = new Map(completions(data.events).map((event) => [event.id, event]));
  return sowings.map((sowing, index) => {
    const packet = seedPackets.find((seed) => seed.key === sowing.seed)!;
    const end = sowings[index + 1]?.start ?? data.events.length;
    const growth = [];
    for (let position = sowing.start; position < end && growth.length < packet.capacity; position++) {
      const mark = completed.get(data.events[position].id);
      if (mark) growth.push(mark);
    }
    return { sowing, packet, growth, finished: growth.length === packet.capacity };
  });
}

export function sow(data: Notebook, seed: string, at: string): Notebook {
  return {
    ...data,
    garden: [...(data.garden ?? []), { seed, at, start: data.events.length }],
  };
}
