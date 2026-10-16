import { describe, it, expect } from "vitest";
import testset from "../testset/testset.json";
import holdout from "../testset/holdout.json";
import { categorize } from "./categorize";

type Labelled = { name: string; expected: string };

function score(label: string, set: Labelled[]) {
  const misses = set.filter((t) => categorize(t.name) !== t.expected);
  const correct = set.length - misses.length;
  const accuracy = (correct / set.length) * 100;
  console.log(`${label}: ${correct}/${set.length} = ${accuracy.toFixed(1)}%`);
  for (const m of misses) {
    console.log(
      `  MISS ${m.name}: expected ${m.expected}, got ${categorize(m.name)}`,
    );
  }
  return accuracy;
}

describe("labelled test sets", () => {
  it("main set stays above the regression floor", () => {
    expect(score("Main set", testset)).toBeGreaterThanOrEqual(90);
  });

  it("reports the held-out set", () => {
    score("Held-out set", holdout);
  });
});