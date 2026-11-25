import type { Party } from "@/types";

export const TOTAL_SEATS = 350;

export type CompetitionParty = Pick<
  Party,
  "id" | "name" | "shortName" | "colour" | "position"
>;

export type SeatDistribution = Record<string, number>;

export function emptySeats(
  parties: readonly CompetitionParty[],
): SeatDistribution {
  return Object.fromEntries(parties.map(({ id }) => [id, 0]));
}

export function totalSeats(seats: SeatDistribution) {
  return Object.values(seats).reduce((total, count) => total + count, 0);
}
