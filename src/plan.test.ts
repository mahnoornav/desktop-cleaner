import { describe, it, expect } from "vitest";
import { joinPath, planMoves } from "./plan";
import { makeFileItem } from "./categorize";

const BASE = "/Users/me/Desktop";

describe("joinPath", () => {
  it("joins with exactly one slash", () => {
    expect(joinPath("/Users/me/Desktop/", "/School Documents/", "a.pdf")).toBe(
      "/Users/me/Desktop/School Documents/a.pdf",
    );
  });
});

describe("planMoves", () => {
  it("returns an empty plan for an empty queue", () => {
    expect(planMoves([], BASE)).toEqual([]);
  });

  it("puts a file in its category folder under the base folder", () => {
    const [move] = planMoves([makeFileItem("/Users/me/Downloads/a.pdf")], BASE);
    expect(move.destinationFolder).toBe("/Users/me/Desktop/School Documents");
    expect(move.destinationPath).toBe("/Users/me/Desktop/School Documents/a.pdf");
    expect(move.status).toBe("ok");
  });

  it("handles a base folder with a trailing slash", () => {
    const [move] = planMoves(
      [makeFileItem("/Users/me/Downloads/a.pdf")],
      "/Users/me/Desktop/",
    );
    expect(move.destinationPath).toBe("/Users/me/Desktop/School Documents/a.pdf");
  });

  it("marks a file already in its destination", () => {
    const [move] = planMoves(
      [makeFileItem("/Users/me/Desktop/School Documents/a.pdf")],
      BASE,
    );
    expect(move.status).toBe("already-there");
  });

  it("marks every file in a name clash", () => {
    const moves = planMoves(
      [
        makeFileItem("/Users/me/Downloads/a.pdf"),
        makeFileItem("/Users/me/Desktop/a.pdf"),
      ],
      BASE,
    );
    expect(moves.map((m) => m.status)).toEqual(["name-clash", "name-clash"]);
  });

  it("treats names that differ only by case as a clash", () => {
    const moves = planMoves(
      [makeFileItem("/x/A.pdf"), makeFileItem("/y/a.pdf")],
      BASE,
    );
    expect(moves.map((m) => m.status)).toEqual(["name-clash", "name-clash"]);
  });

  it("does not clash when the same name goes to different folders", () => {
    const pdf = makeFileItem("/x/report.pdf");
    const edited = { ...makeFileItem("/y/report.pdf"), category: "Other / Needs Review" as const };
    const moves = planMoves([pdf, edited], BASE);
    expect(moves.map((m) => m.status)).toEqual(["ok", "ok"]);
  });
});