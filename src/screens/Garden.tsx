import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app/store";
import { Dialog } from "../components/Dialog";
import {
  Specimen,
  plantTally,
  specimenDate,
  tallyText,
} from "../components/Herbarium";
import { Dotted, EmptyState, PageHeader } from "../components/Shared";
import { useWorkspace } from "../components/Workspace";
import { gardenPlants, starterPacket } from "../lib/garden/garden";
import { drawFigure } from "../lib/garden/specimens";

// Every finished plant on its own sheet, in the order it was grown.
export function Garden() {
  const data = useApp((state) => state.data);
  const { openSeedPicker } = useWorkspace();
  const [opened, setOpened] = useState<number>();
  const plants = useMemo(() => gardenPlants(data), [data]);
  const active = plants.at(-1);
  const sheets = useMemo(
    () =>
      plants.flatMap((plant, index) =>
        plant.finished
          ? [
              {
                plant,
                number: index + 1,
                drawing: drawFigure(
                  plant.packet.key,
                  plant.growth.map((event) => event.reward?.size),
                ),
              },
            ]
          : [],
      ),
    [plants],
  );
  const selected = sheets.find((sheet) => sheet.plant.sowing.start === opened);
  const totals = sheets.reduce(
    (sum, { plant }) => {
      const tally = plantTally(plant);
      return {
        leaves: sum.leaves + tally.leaves,
        flowers: sum.flowers + tally.flowers,
      };
    },
    { leaves: 0, flowers: 0 },
  );

  return (
    <>
      <PageHeader
        title="Garden"
        description={
          sheets.length > 0 && (
            <Dotted
              items={[
                `${sheets.length} plant${sheets.length === 1 ? "" : "s"}`,
                `${totals.leaves} leaves`,
                `${totals.flowers} flower${totals.flowers === 1 ? "" : "s"}`,
              ]}
            />
          )
        }
      >
        {active?.finished && (
          <button
            type="button"
            className="button primary"
            onClick={openSeedPicker}
          >
            Choose the next seed
          </button>
        )}
      </PageHeader>
      {sheets.length ? (
        <ul className="garden-sheets plant-art" aria-label="Finished plants">
          {sheets.map(({ plant, number, drawing }) => (
            <li key={plant.sowing.start}>
              <button
                type="button"
                className="garden-sheet"
                aria-label={`No. ${number}, ${plant.packet.name}, ${tallyText(plant)}, finished ${specimenDate(plant.growth.at(-1)!.at)}`}
                onClick={() => setOpened(plant.sowing.start)}
              >
                <svg
                  aria-hidden="true"
                  className="st-herb"
                  viewBox="0 0 160 168"
                  dangerouslySetInnerHTML={{ __html: drawing }}
                />
                <span className="eyebrow">No. {number}</span>
                <strong>{plant.packet.name}</strong>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No finished plants yet."
          action={
            <Link className="text-link" to="/">
              Go to Today
            </Link>
          }
        >
          {active?.packet.name ?? starterPacket.name} is at{" "}
          {active?.growth.length ?? 0} of{" "}
          {(active?.packet ?? starterPacket).capacity} completions.
        </EmptyState>
      )}
      {selected && (
        <Dialog
          title={`No. ${selected.number} · ${selected.plant.packet.name}`}
          close={() => setOpened(undefined)}
          className="specimen-sheet"
        >
          <div className="herbarium plant-art">
            <Specimen plant={selected.plant} number={selected.number} />
            <p className="specimen-tally">
              {tallyText(selected.plant)}. Select one to see the task that
              earned it.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
