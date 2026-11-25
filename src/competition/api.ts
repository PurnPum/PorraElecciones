import {
  TOTAL_SEATS,
  type CompetitionParty,
  type SeatDistribution,
} from "./seats";

export type CompetitionStatus = {
  phase: "open" | "closed";
  deadline: string;
  serverTime: string;
  parties: CompetitionParty[];
};

export type Prediction = {
  id: string;
  alias: string;
  seats: SeatDistribution;
};

const apiUrl = import.meta.env.VITE_COMPETITION_API_URL?.trim();

export const isApiConfigured = Boolean(apiUrl);

export class CompetitionApiError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isParty(value: unknown): value is CompetitionParty {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.shortName === "string" &&
    typeof value.colour === "string" &&
    typeof value.position === "number" &&
    Number.isFinite(value.position)
  );
}

function isPrediction(
  value: unknown,
  parties: CompetitionParty[],
): value is Prediction {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.alias !== "string" ||
    !isRecord(value.seats)
  ) {
    return false;
  }

  const seats = value.seats;
  if (Object.keys(seats).length !== parties.length) return false;
  let total = 0;
  for (const { id } of parties) {
    const count = seats[id];
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > TOTAL_SEATS
    )
      return false;
    total += count;
  }
  return total === TOTAL_SEATS;
}

async function request(
  action: "status" | "predictions" | "submit",
  init?: RequestInit,
) {
  if (!apiUrl) throw new CompetitionApiError("SERVER_ERROR");

  const url = new URL(apiUrl, window.location.href);
  if (action !== "submit") url.searchParams.set("action", action);

  const response = await fetch(url, {
    credentials: "omit",
    cache: "no-store",
    ...init,
  });
  const data: unknown = await response.json();
  if (isRecord(data) && data.ok === false && typeof data.error === "string") {
    throw new CompetitionApiError(data.error);
  }
  if (!response.ok || !isRecord(data) || data.ok !== true) {
    throw new CompetitionApiError("SERVER_ERROR");
  }
  return data;
}

export async function getStatus(
  signal: AbortSignal,
): Promise<CompetitionStatus> {
  const { phase, deadline, serverTime, parties } = await request("status", {
    signal,
  });
  if (
    (phase !== "open" && phase !== "closed") ||
    !isDate(deadline) ||
    !isDate(serverTime) ||
    !Array.isArray(parties) ||
    parties.length === 0 ||
    !parties.every(isParty) ||
    new Set(parties.map(({ id }) => id)).size !== parties.length
  ) {
    throw new CompetitionApiError("SERVER_ERROR");
  }
  return { phase, deadline, serverTime, parties };
}

export async function getPredictions(
  parties: CompetitionParty[],
  signal: AbortSignal,
): Promise<Prediction[]> {
  const { predictions } = await request("predictions", { signal });
  if (
    !Array.isArray(predictions) ||
    !predictions.every((prediction) => isPrediction(prediction, parties))
  ) {
    throw new CompetitionApiError("SERVER_ERROR");
  }
  return predictions;
}

export async function submitPrediction(code: string, seats: SeatDistribution) {
  await request("submit", {
    method: "POST",
    // A plain text JSON body works as a simple cross-origin request.
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ code, seats }),
  });
}
