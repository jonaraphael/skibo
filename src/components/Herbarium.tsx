import { useEffect, useRef, useState } from "react";
import { useApp } from "../app/store";
import { GardenPlant, gardenPlants, starterPacket } from "../lib/garden/garden";
import { drawSpecimen } from "../lib/garden/specimens";
import { useWorkspace } from "./Workspace";
import "./Herbarium.css";

export function specimenDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function plantTally(plant: GardenPlant) {
  const flowers = plant.growth.filter((event) => event.reward).length;
  return { leaves: plant.growth.length - flowers, flowers };
}

const count = (n: number, noun: string) =>
  `${n} ${n === 1 ? noun : noun === "leaf" ? "leaves" : `${noun}s`}`;
export const tallyText = (plant: GardenPlant) => {
  const { leaves, flowers } = plantTally(plant);
  return `${count(leaves, "leaf")} and ${count(flowers, "flower")}`;
};

// One plant on its sheet. Selecting a leaf or flower shows the completion that
// earned it beside the mark.
export function Specimen({
  plant,
  number,
  openTasks,
}: {
  plant?: GardenPlant;
  number: number;
  openTasks?: number;
}) {
  const reduceMotion = useApp((state) => state.data.preferences.reduceMotion);
  const [mark, setMark] = useState<{
    id: string;
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const figure = useRef<HTMLElement>(null);
  const packet = plant?.packet ?? starterPacket;
  const growth = plant?.growth ?? [];
  const start = plant?.sowing.start;
  const index = growth.findIndex((event) => event.id === mark?.id);
  const selected = growth[index];
  const previous = useRef({ start, count: growth.length });
  const samePlant =
    previous.current.start === start ||
    (previous.current.start === undefined && packet === starterPacket);
  const growing = openTasks !== undefined && !reduceMotion;
  const priorCount =
    growing && samePlant && previous.current.count < growth.length
      ? previous.current.count
      : undefined;
  useEffect(() => {
    previous.current = { start, count: growth.length };
  }, [start, growth.length]);

  // The drawing contains only fixed species geometry and validated reward sizes.
  const drawing = drawSpecimen(
    packet.key,
    growth.map((event) => event.reward?.size),
    openTasks ?? 0,
    true,
    priorCount,
  );
  useEffect(() => {
    figure.current
      ?.querySelectorAll("[data-selected]")
      .forEach((slot) => slot.removeAttribute("data-selected"));
    if (index >= 0)
      figure.current
        ?.querySelector(`[data-i="${index}"]`)
        ?.setAttribute("data-selected", "");
  }, [index, drawing]);

  // A press anywhere off the sheet puts the note away.
  useEffect(() => {
    if (!mark) return;
    const dismiss = (event: PointerEvent) => {
      if (!figure.current?.contains(event.target as Node)) setMark(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [mark]);

  const inspect = (target: EventTarget) => {
    const slot = target instanceof Element ? target.closest("[data-i]") : null;
    const event = slot && growth[Number(slot.getAttribute("data-i"))];
    if (!slot || !event || event.id === mark?.id) return setMark(null);
    const sheet = figure.current!.getBoundingClientRect();
    const box = slot.getBoundingClientRect();
    const below = box.top - sheet.top < 96;
    setMark({
      id: event.id,
      x: Math.min(
        Math.max(box.left + box.width / 2 - sheet.left, 112),
        Math.max(112, sheet.width - 112),
      ),
      y: below ? box.bottom - sheet.top + 8 : box.top - sheet.top - 8,
      below,
    });
  };
  const dates = plant
    ? plant.finished
      ? `${specimenDate(plant.sowing.at)} – ${specimenDate(growth.at(-1)!.at)}`
      : `sown ${specimenDate(plant.sowing.at)}`
    : null;

  return (
    <figure
      className="specimen"
      ref={figure}
      onKeyDown={(event) => {
        if (event.key === "Escape" && mark) {
          event.preventDefault();
          event.stopPropagation();
          setMark(null);
        }
      }}
    >
      <svg
        className={`st-herb${growing && !plant?.finished ? " live" : ""}`}
        viewBox="0 0 288 206"
        role="group"
        aria-label={`${packet.name} specimen`}
        onClick={(event) => inspect(event.target)}
        onKeyDown={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            event.target instanceof Element &&
            event.target.closest("[data-i]")
          ) {
            event.preventDefault();
            inspect(event.target);
          }
        }}
        dangerouslySetInnerHTML={{ __html: drawing }}
      />
      <figcaption>
        <div>
          <span className="eyebrow">
            No. {number}
            {dates && ` · ${dates}`}
          </span>
          <strong>{packet.name}</strong>
        </div>
        <span
          className="specimen-count"
          aria-label={`${growth.length} of ${packet.capacity} completions`}
        >
          {growth.length}
          <small> / {packet.capacity}</small>
        </span>
      </figcaption>
      <div aria-live="polite">
        {selected && mark && (
          <div
            className={`specimen-pop${mark.below ? " below" : ""}`}
            style={{ left: mark.x, top: mark.y }}
          >
            <strong>{selected.taskTitle}</strong>
            <span>
              {new Date(selected.at).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {selected.reward ? (
              <span className={`specimen-reward lv-${selected.reward.size}`}>
                <i />
                {selected.reward.title} · {selected.reward.size} reward
              </span>
            ) : (
              <span>No reward drawn</span>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

export function Herbarium({ open }: { open: number }) {
  const data = useApp((state) => state.data);
  const { openSeedPicker } = useWorkspace();
  const plants = gardenPlants(data);
  const active = plants.at(-1);
  return (
    <section className="herbarium plant-art" aria-labelledby="herbarium-title">
      <h2 id="herbarium-title">Herbarium</h2>
      <Specimen
        plant={active}
        number={Math.max(1, plants.length)}
        openTasks={open}
      />
      {active?.finished && (
        <button
          type="button"
          className="button primary full-width"
          onClick={openSeedPicker}
        >
          Choose the next seed
        </button>
      )}
    </section>
  );
}
