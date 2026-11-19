import type { CSSProperties } from "react";
import { canEdit, useApp } from "../app/store";
import { GardenPlant } from "../lib/garden/garden";
import { drawFigure, seedPackets } from "../lib/garden/specimens";
import { Dialog } from "./Dialog";
import { tallyText } from "./Herbarium";
import { Mark } from "./Marks";
import "./Herbarium.css";

const packetDrawings = seedPackets.map((packet) =>
  drawFigure(packet.key, Array(packet.capacity).fill(undefined)),
);

// Opens when a plant takes its last completion: the finished plant, then the
// twelve seeds for the next one.
export function SeedPicker({
  plant,
  close,
}: {
  plant: GardenPlant;
  close: () => void;
}) {
  const disabled = useApp((state) => !canEdit(state) || state.pending > 0);
  const plantSeed = useApp((state) => state.plantSeed);
  return (
    <Dialog title="Choose a seed packet" close={close} className="seed-sheet">
      <div className="seed-celebration plant-art">
        <div className="seed-figure">
          <span className="seed-burst" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                <Mark kind={i % 3 === 1 ? "flower" : "leaf"} />
              </span>
            ))}
          </span>
          <svg
            aria-hidden="true"
            className="st-herb"
            viewBox="0 0 160 168"
            dangerouslySetInnerHTML={{
              __html: drawFigure(
                plant.packet.key,
                plant.growth.map((event) => event.reward?.size),
              ),
            }}
          />
        </div>
        <h2>{plant.packet.name} is fully grown!</h2>
        <p>
          {plant.packet.capacity} completions grew {tallyText(plant)}. It is in
          the Garden. Choose the next seed.
        </p>
      </div>
      <div className="seed-packets plant-art">
        {seedPackets.map((packet, index) => (
          <button
            type="button"
            key={packet.key}
            disabled={disabled}
            onClick={() => void plantSeed(packet.key)}
          >
            <svg
              aria-hidden="true"
              className="st-herb"
              viewBox="0 0 160 168"
              dangerouslySetInnerHTML={{ __html: packetDrawings[index] }}
            />
            <strong>{packet.name}</strong>
            <span className="eyebrow">{packet.capacity} tasks</span>
            <small>{packet.note}</small>
          </button>
        ))}
      </div>
      <button type="button" className="text-link seed-later" onClick={close}>
        Choose later
      </button>
    </Dialog>
  );
}
