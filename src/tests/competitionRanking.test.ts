import { expect, test } from "vitest";
import { rankPredictions } from "@/competition/ranking";

test("ranks by total absolute error, with a shared rank for tied scores", () => {
  const parties = ["primera", "segunda", "otros"].map((id) => ({
    id,
    name: id,
    shortName: id,
    colour: "#000000",
    position: 0,
  }));
  const predictions = [
    { id: "a", alias: "Ana", seats: { primera: 175, segunda: 175, otros: 0 } },
    {
      id: "b",
      alias: "Berta",
      seats: { primera: 175, segunda: 170, otros: 5 },
    },
    {
      id: "c",
      alias: "Celia",
      seats: { primera: 180, segunda: 170, otros: 0 },
    },
    {
      id: "d",
      alias: "Diego",
      seats: { primera: 180, segunda: 160, otros: 10 },
    },
  ];

  const ranking = rankPredictions(
    predictions,
    { primera: 180, segunda: 170, otros: 0 },
    parties,
  );

  expect(ranking.map(({ alias, rank, score }) => [alias, rank, score])).toEqual(
    [
      ["Celia", 1, 0],
      ["Ana", 2, 10],
      ["Berta", 2, 10],
      ["Diego", 4, 20],
    ],
  );
});
