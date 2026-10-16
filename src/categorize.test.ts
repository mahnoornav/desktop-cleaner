import { describe, it, expect } from "vitest";
import {
  categorize,
  getExtension,
  getName,
  makeFileItem,
} from "./categorize";

describe("getName", () => {
  it("returns the last part of a full path", () => {
    expect(getName("/Users/me/Desktop/image.png")).toBe("image.png");
  });

  it("returns a plain name unchanged", () => {
    expect(getName("image.png")).toBe("image.png");
  });
});

describe("getExtension", () => {
  it("lowercases the extension", () => {
    expect(getExtension("photo.PNG")).toBe("png");
  });

  it("uses only the last extension", () => {
    expect(getExtension("archive.tar.gz")).toBe("gz");
  });

  it("returns empty text when there is no extension", () => {
    expect(getExtension("Makefile")).toBe("");
  });

  it("treats hidden files as having no extension", () => {
    expect(getExtension(".gitignore")).toBe("");
  });

  it("returns empty text when the name ends with a dot", () => {
    expect(getExtension("notes.")).toBe("");
  });
});

describe("categorize", () => {
  it.each([
    ["lecture_04_notes.pdf", "School Documents"],
    ["notes.md", "School Documents"],
    ["Screenshot 2026-10-09.png", "Screenshots & Images"],
    ["photo.PNG", "Screenshots & Images"],
    ["a3_solution.py", "Code & Project Files"],
    ["App.tsx", "Code & Project Files"],
    ["lab_data.zip", "Archives & Downloads"],
    ["archive.tar.gz", "Archives & Downloads"],
  ])("puts %s in %s", (name, expected) => {
    expect(categorize(name)).toBe(expected);
  });

  it.each([
    ["final_v2_REALLY.xyz"],
    ["Makefile"],
    [".gitignore"],
    ["My Folder"],
  ])("sends %s to Needs Review", (name) => {
    expect(categorize(name)).toBe("Needs Review");
  });
});

describe("makeFileItem", () => {
  it("builds a queue item from a full path", () => {
    expect(makeFileItem("/Users/me/Desktop/a3_solution.py")).toEqual({
      path: "/Users/me/Desktop/a3_solution.py",
      name: "a3_solution.py",
      category: "Code & Project Files",
    });
  });
});

describe("edge cases", () => {
  it("does not treat object property names as extensions", () => {
    expect(categorize("notes.constructor")).toBe("Needs Review");
    expect(categorize("data.toString")).toBe("Needs Review");
  });

  it("handles a folder path with a trailing slash", () => {
    expect(getName("/Users/me/Desktop/My Folder/")).toBe("My Folder");
  });
});