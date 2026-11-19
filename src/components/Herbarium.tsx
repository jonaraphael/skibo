import { useEffect, useRef, useState } from "react";
import { canEdit, useApp } from "../app/store";
import { gardenPlants, sow } from "../lib/garden/garden";
import { drawSpecimen, seedPackets } from "../lib/garden/specimens";
import "./Herbarium.css";

const date = (value: string) => new Date(value).toLocaleDateString(undefined, {
  month: "short", day: "numeric", year: "numeric",
});


export function Herbarium({ open }: { open: number }) {
  const { data, change } = useApp();
  const editable = useApp(canEdit);
  const plants = gardenPlants(data);
  const active = plants.at(-1);
  const [specimen, setSpecimen] = useState<number | null>(null);
  const [mark, setMark] = useState<string | null>(null);
  const plant = plants.find((entry) => entry.sowing.start === specimen) ?? active;
  const packet = plant?.packet ?? seedPackets.find((seed) => seed.key === "pea")!;
  const growth = plant?.growth ?? [];
  const selected = growth.find((event) => event.id === mark);
  const previous = useRef({ start: plant?.sowing.start, count: growth.length });
  const priorCount = previous.current.start === plant?.sowing.start &&
    previous.current.count < growth.length ? previous.current.count : undefined;
  useEffect(() => {
    previous.current = { start: plant?.sowing.start, count: growth.length };
  }, [plant?.sowing.start, growth.length]);

  const showingActive = plant === active;
  const motion = !data.preferences.reduceMotion && showingActive && !active?.finished;
  // The drawing contains only fixed species geometry and validated reward sizes.
  const drawing = drawSpecimen(
    packet.key,
    growth.map((event) => event.reward?.size),
    showingActive ? open : 0,
    true,
    data.preferences.reduceMotion ? undefined : priorCount,
  );

  const inspect = (target: EventTarget) => {
    const slot = target instanceof Element ? target.closest("[data-i]") : null;
    if (slot) setMark(growth[Number(slot.getAttribute("data-i"))]?.id ?? null);
  };
  const plantSeed = async (key: string) => {
    const saved = await change((notebook) => {
      const latest = gardenPlants(notebook).at(-1);
      return !latest || latest.finished
        ? sow(notebook, key, new Date().toISOString())
        : notebook;
    });
    if (saved) {
      setSpecimen(null);
      setMark(null);
    }
  };

  return (
    <section className="herbarium" aria-labelledby="herbarium-title">
      <header>
        <h2 id="herbarium-title">Herbarium</h2>
        <details className="garden-index">
          <summary>Garden</summary>
          {plants.some((entry) => entry !== active || entry.finished) ? (
            <ul>
              {plants.filter((entry) => entry !== active || entry.finished).map((entry) => (
                <li key={entry.sowing.start}>
                  <button type="button" className="text-link" onClick={() => {
                    setSpecimen(entry.sowing.start);
                    setMark(null);
                  }}>
                    {entry.packet.name} · {date(entry.sowing.at)}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>Finished plants will appear here.</p>}
        </details>
      </header>
      {!showingActive && (
        <button type="button" className="text-link" onClick={() => {
          setSpecimen(null);
          setMark(null);
        }}>Back to current plant</button>
      )}
      <figure>
        <svg
          className={`st-herb${motion ? " live" : ""}`}
          viewBox="0 0 288 206"
          role="group"
          aria-label={`${packet.name} specimen`}
          onClick={(event) => inspect(event.target)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") &&
                event.target instanceof Element && event.target.closest("[data-i]")) {
              event.preventDefault();
              inspect(event.target);
            }
          }}
          dangerouslySetInnerHTML={{ __html: drawing }}
        />
        <figcaption>
          <div>
            <span className="eyebrow">
              {plant ? `Sown ${date(plant.sowing.at)}` : "First specimen"}
            </span>
            <strong>{packet.name}</strong>
          </div>
          <span aria-label={`${growth.length} of ${packet.capacity} completions`}>
            {growth.length} / {packet.capacity}
          </span>
        </figcaption>
      </figure>
      <div aria-live="polite" className="specimen-note">
        {selected ? (
          <>
            <strong>{selected.taskTitle}</strong>
            <span>{new Date(selected.at).toLocaleString()}</span>
            {selected.reward && <span>{selected.reward.title} · {selected.reward.size} reward</span>}
          </>
        ) : plant?.finished ? (
          <span>Finished {date(growth.at(-1)!.at)}</span>
        ) : growth.length ? (
          <span>Select a leaf or flower to revisit the task.</span>
        ) : (
          <span>Complete a task to grow the first leaf.</span>
        )}
      </div>
      {showingActive && (!active || active.finished) && (
        <details key={active?.sowing.start ?? "first"} open={active?.finished || undefined}>
          <summary>Choose a seed packet</summary>
          {active?.finished && <p>Sow your next seed to start growing again.</p>}
          <div className="seed-packets">
            {seedPackets.map((seed) => (
              <button type="button" key={seed.key} disabled={!editable} onClick={() => void plantSeed(seed.key)}>
                <svg aria-hidden="true" className="st-herb" viewBox="0 0 288 206"
                  dangerouslySetInnerHTML={{ __html: drawSpecimen(seed.key, Array(seed.capacity).fill(undefined), 0, false) }} />
                <strong>{seed.name}</strong>
                <span>{seed.capacity} tasks</span>
                <small>{seed.note}</small>
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
