import type { Prediction } from "./api";
import type { CompetitionParty, SeatDistribution } from "./seats";

export function rankPredictions(
  predictions: Prediction[],
  results: SeatDistribution,
  parties: CompetitionParty[],
) {
  const ranked = predictions
    .map((prediction) => ({
      ...prediction,
      score: parties.reduce(
        (sum, { id }) => sum + Math.abs(prediction.seats[id] - results[id]),
        0,
      ),
    }))
    .sort((a, b) => a.score - b.score || a.alias.localeCompare(b.alias, "es"));

  let rank = 0;
  return ranked.map((prediction, index) => {
    if (prediction.score !== ranked[index - 1]?.score) rank = index + 1;
    return { ...prediction, rank };
  });
}
