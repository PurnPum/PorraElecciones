import { useEffect, useState, type FormEvent } from "react";
import {
  CompetitionApiError,
  getPredictions,
  getStatus,
  isApiConfigured,
  submitPrediction,
  type CompetitionStatus,
  type Prediction,
} from "./api";
import { rankPredictions } from "./ranking";
import { CompetitionChart, SeatEditor } from "./SeatEditor";
import {
  emptySeats,
  totalSeats,
  TOTAL_SEATS,
  type CompetitionParty,
} from "./seats";

const deadlineFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
  timeStyle: "medium",
  timeZone: "Europe/Madrid",
});

const buttonStyle =
  "min-h-11 rounded-full bg-zinc-800 px-5 py-2 font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const fieldStyle =
  "min-h-11 w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900";
const submissionErrors = new Map([
  [
    "INVALID_CODE",
    "El código no es válido. Comprueba el código que te dio la organización.",
  ],
  ["CODE_USED", "Este código ya se ha utilizado para enviar una porra."],
  ["INVALID_SEATS", "Revisa el reparto de escaños e inténtalo de nuevo."],
  ["BUSY", "Hay otros envíos en curso. Vuelve a intentarlo en unos segundos."],
]);

function PredictionForm({
  parties,
  unavailable,
  onClosed,
}: {
  parties: CompetitionParty[];
  unavailable: boolean;
  onClosed: () => void;
}) {
  const [seats, setSeats] = useState(() => emptySeats(parties));
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const complete = totalSeats(seats) === TOTAL_SEATS;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || saved || unavailable || !complete) return;
    const trimmedCode = code.trim();
    if (!/^[a-f0-9]{5,6}$/i.test(trimmedCode)) {
      setError(
        "Introduce el código de 5 o 6 caracteres hexadecimales que te dio la organización.",
      );
      return;
    }

    setSending(true);
    setError("");
    try {
      await submitPrediction(trimmedCode, seats);
      setSaved(true);
      setCode("");
    } catch (error) {
      const reason = error instanceof CompetitionApiError ? error.message : "";
      if (reason === "CLOSED") onClosed();
      setError(
        reason === "CLOSED"
          ? "El plazo de envío ya ha terminado."
          : (submissionErrors.get(reason) ??
              "No se ha podido confirmar el envío. Revisa tu conexión y vuelve a intentarlo."),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <SeatEditor
        parties={parties}
        seats={seats}
        onChange={setSeats}
        disabled={sending || saved}
      />
      <div className="space-y-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
        {saved ? (
          <p role="status" className="font-semibold">
            Tu porra se ha guardado. Podrás verla cuando termine el plazo.
          </p>
        ) : (
          <>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-0 flex-1 font-medium">
                Código de participación
                <input
                  type="password"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  disabled={sending}
                  className={`mt-1 ${fieldStyle}`}
                />
              </label>
              <button
                type="submit"
                className={buttonStyle}
                disabled={!complete || sending || unavailable}
              >
                {sending ? "Enviando…" : "Enviar mi porra"}
              </button>
            </div>
            {error && (
              <p role="alert" className="text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </form>
  );
}

function PublishedPredictions({
  parties,
  predictions,
}: {
  parties: CompetitionParty[];
  predictions: Prediction[];
}) {
  const [selectedId, setSelectedId] = useState(predictions[0]?.id);
  const [results, setResults] = useState(() => emptySeats(parties));
  const selected =
    predictions.find(({ id }) => id === selectedId) ?? predictions[0];
  const ranking =
    totalSeats(results) === TOTAL_SEATS
      ? rankPredictions(predictions, results, parties)
      : null;

  if (!selected) return <p>No se ha enviado ninguna porra.</p>;

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="predictions-title">
        <h2 id="predictions-title" className="text-xl font-bold">
          Porras publicadas
        </h2>
        <label className="block max-w-sm font-medium">
          Participante
          <select
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className={`mt-1 appearance-none ${fieldStyle}`}
          >
            {predictions.map(({ id, alias }) => (
              <option key={id} value={id}>
                {alias}
              </option>
            ))}
          </select>
        </label>
        <div className="grid items-center gap-4 lg:grid-cols-2">
          <CompetitionChart parties={parties} seats={selected.seats} />
          <dl className="grid gap-2 sm:grid-cols-2">
            {parties.map(({ id, shortName, colour }) => (
              <div
                key={id}
                className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800"
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colour }}
                />
                <dt className="min-w-0 flex-1">{shortName}</dt>
                <dd className="font-semibold tabular-nums">
                  {selected.seats[id]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="scenario-title">
        <h2 id="scenario-title" className="text-xl font-bold">
          Resultados hipotéticos
        </h2>
        <p>
          Reparte los 350 escaños para ver quién se habría acercado más al
          resultado.
        </p>
        <SeatEditor parties={parties} seats={results} onChange={setResults} />
        <div aria-live="polite">
          {ranking && (
            <div className="overflow-hidden rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
              <table className="w-full text-left">
                <caption className="pb-2 text-left text-lg font-bold">
                  Clasificación
                </caption>
                <thead>
                  <tr className="border-b dark:border-zinc-600">
                    <th scope="col" className="py-2 pr-2">
                      Puesto
                    </th>
                    <th scope="col" className="p-2">
                      Participante
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map(({ id, alias, rank, score }) => (
                    <tr
                      key={id}
                      className="border-b last:border-0 dark:border-zinc-600"
                    >
                      <td className="py-2 pr-2 tabular-nums">{rank}</td>
                      <th scope="row" className="p-2 font-medium break-all">
                        {alias}
                      </th>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        {score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm">
                El error es la suma de las diferencias absolutas de escaños por
                candidatura.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LiveCompetition() {
  const [status, setStatus] = useState<CompetitionStatus>();
  const [predictions, setPredictions] = useState<Prediction[]>();
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const current = await getStatus(signal);
        if (signal.aborted) return;
        setStatus(current);
        if (current.phase === "closed") {
          const entries = await getPredictions(current.parties, signal);
          if (!signal.aborted) setPredictions(entries);
        } else {
          const untilClose =
            Date.parse(current.deadline) - Date.parse(current.serverTime);
          timer = setTimeout(
            load,
            Math.max(1_000, Math.min(untilClose, 60_000)),
          );
        }
        setFailed(false);
      } catch {
        if (!signal.aborted) setFailed(true);
      }
    }

    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);

  function reload() {
    setFailed(false);
    setRefresh((value) => value + 1);
  }

  return (
    <div className="space-y-4">
      {status && (
        <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <h2 className="text-xl font-bold">
            {status.phase === "open"
              ? "Haz tu porra"
              : "Plazo de envío cerrado"}
          </h2>
          {status.phase === "open" && (
            <p>
              Envía tu predicción antes del{" "}
              <time dateTime={status.deadline}>
                {deadlineFormat.format(new Date(status.deadline))}
              </time>{" "}
              (hora peninsular española).
            </p>
          )}
        </div>
      )}
      {failed && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <p role="alert">No se ha podido cargar la porra.</p>
          <button type="button" className={buttonStyle} onClick={reload}>
            Volver a intentar
          </button>
        </div>
      )}
      {!failed && (!status || (status.phase === "closed" && !predictions)) && (
        <p role="status">Cargando la porra…</p>
      )}
      {status?.phase === "open" && (
        <PredictionForm
          key={status.parties.map(({ id }) => id).join(",")}
          parties={status.parties}
          unavailable={failed}
          onClosed={reload}
        />
      )}
      {status?.phase === "closed" && predictions && (
        <PublishedPredictions
          parties={status.parties}
          predictions={predictions}
        />
      )}
    </div>
  );
}

export default function Competition() {
  if (!isApiConfigured) {
    return (
      <p role="status" className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
        La porra aún no está disponible.
      </p>
    );
  }
  return <LiveCompetition />;
}
