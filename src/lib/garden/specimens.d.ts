import type { RewardSize } from "../../app/types";

export const seedPackets: ReadonlyArray<{
  key: string;
  name: string;
  note: string;
  capacity: number;
}>;
export function drawSpecimen(
  key: string,
  levels: (RewardSize | undefined)[],
  open: number,
  interactive: boolean,
  previous?: number,
): string;
export function drawFigure(
  key: string,
  levels: (RewardSize | undefined)[],
): string;
