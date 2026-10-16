import { describe, it, expect } from "vitest";
import { parseQueue, serializeQueue } from "./queueStorage";
import type { FileItem } from "./types";

const sample: FileItem[] = [
  {
    path: "/Users/me/Desktop/a.pdf",
    name: "a.pdf",
    category: "School Documents",
    kind: "file",
  },
  {
    path: "/Users/me/Desktop/Stuff",
    name: "Stuff",
    category: "Needs Review",
    kind: "folder",
  },
];

describe("queue storage", () => {
  it("round-trips a queue", () => {
    expect(parseQueue(serializeQueue(sample))).toEqual(sample);
  });

  it("returns an empty queue for broken JSON", () => {
    expect(parseQueue("{ not json")).toEqual([]);
  });

  it("returns an empty queue when the data is not a list", () => {
    expect(parseQueue('{"path": "/a"}')).toEqual([]);
  });

  it("drops entries with a missing field or an unknown category", () => {
    const json = JSON.stringify([
      { path: "/a.pdf", name: "a.pdf", category: "Not A Category" },
      { name: "b.pdf", category: "School Documents" },
      sample[0],
    ]);
    expect(parseQueue(json)).toEqual([sample[0]]);
  });

  it("ignores a bad kind but keeps the item", () => {
    const json = JSON.stringify([
      { path: "/a.pdf", name: "a.pdf", category: "School Documents", kind: "banana" },
    ]);
    expect(parseQueue(json)).toEqual([
      { path: "/a.pdf", name: "a.pdf", category: "School Documents" },
    ]);
  });
});