import PieChart from "@/components/ui/app/head/PieChart";
import { simpleMajority } from "@/utils/getMajority";
import { useId, useState } from "react";
import {
  TOTAL_SEATS,
  totalSeats,
  type CompetitionParty,
  type SeatDistribution,
} from "./seats";

type ChartProps = {
  parties: readonly CompetitionParty[];
  seats: SeatDistribution;
};

export function CompetitionChart({ parties, seats }: ChartProps) {
  const assignedParties = parties
    .map((party) => ({ ...party, seats: seats[party.id] ?? 0 }))
    .filter((party) => party.seats > 0);
  const unassigned = {
    id: "unassigned",
    name: "Escaños sin asignar",
    shortName: "Sin asignar",
    colour: "",
    position: 0,
    seats: Math.max(0, TOTAL_SEATS - totalSeats(seats)),
  };

  return (
    <div
      role="group"
      aria-label="Distribución de escaños en el Congreso"
      className="relative aspect-2/1 w-full"
    >
      <PieChart
        parties={[...assignedParties, unassigned]}
        selectedParties={assignedParties}
        isEditMode={false}
        sortBy="position"
        majorityThreshold={simpleMajority}
      />
    </div>
  );
}

type EditorProps = ChartProps & {
  onChange: (seats: SeatDistribution) => void;
  disabled?: boolean;
};

export function SeatEditor({
  parties,
  seats,
  onChange,
  disabled,
}: EditorProps) {
  const total = totalSeats(seats);
  const remaining = TOTAL_SEATS - total;
  const errorId = useId();
  const [error, setError] = useState<{ partyId: string; message: string }>();
  const sortedParties = [...parties].sort((a, b) => a.position - b.position);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="lg:sticky lg:top-4">
        <CompetitionChart parties={parties} seats={seats} />
      </div>
      <div className="min-w-0">
        <div className="sticky top-0 z-10 bg-white pt-2 pb-4 dark:bg-zinc-900">
          <div
            role="status"
            className="mb-2 flex flex-wrap justify-between gap-x-3 text-sm"
          >
            <p className="font-semibold tabular-nums">
              {total} / {TOTAL_SEATS} escaños
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              {remaining === 0
                ? "Reparto completo"
                : remaining === 1
                  ? "Queda 1 escaño"
                  : `Quedan ${remaining} escaños`}
            </p>
          </div>
          <div
            aria-hidden="true"
            className="flex h-4 overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-700"
          >
            {sortedParties.map(({ id, colour }) => (
              <div
                key={id}
                className="h-full shrink-0 transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${((seats[id] ?? 0) / TOTAL_SEATS) * 100}%`,
                  backgroundColor: colour,
                }}
              />
            ))}
          </div>
          <p
            id={errorId}
            role="status"
            className="text-sm text-rose-700 not-empty:mt-2 dark:text-rose-300"
          >
            {error?.message}
          </p>
        </div>
        <ul className="grid gap-2">
          {parties.map((party) => {
            const count = seats[party.id] ?? 0;
            const max = count + remaining;

            return (
              <li key={party.id}>
                <label className="flex items-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: party.colour }}
                  />
                  <span className="min-w-0 flex-1 wrap-break-word">
                    <span className="block font-semibold">
                      {party.shortName}
                    </span>
                    {party.name !== party.shortName && (
                      <span className="block text-sm text-zinc-700 dark:text-zinc-300">
                        {party.name}
                      </span>
                    )}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    step={1}
                    aria-label={`Escaños de ${party.shortName}`}
                    aria-describedby={
                      error?.partyId === party.id ? errorId : undefined
                    }
                    className="min-h-11 w-20 shrink-0 rounded-xl border border-zinc-200 bg-zinc-100 px-2 text-right font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                    disabled={disabled}
                    placeholder="0"
                    value={count || ""}
                    onChange={(event) => {
                      const input = event.currentTarget;
                      const nextCount = Number(input.value);

                      if (
                        input.validity.badInput ||
                        !Number.isInteger(nextCount) ||
                        nextCount < 0
                      ) {
                        setError({
                          partyId: party.id,
                          message: "Introduce un número entero de escaños.",
                        });
                        return;
                      }

                      if (nextCount > max) {
                        setError({
                          partyId: party.id,
                          message: `El máximo para ${party.shortName} con el reparto actual es ${max}. Reduce los escaños de otro partido para asignarle más.`,
                        });
                        return;
                      }

                      setError(undefined);
                      onChange({ ...seats, [party.id]: nextCount });
                    }}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
