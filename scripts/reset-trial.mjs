import { readFileSync, existsSync, statSync, unlinkSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const items = JSON.parse(
  readFileSync(new URL("../testset/testset.json", import.meta.url), "utf8"),
);
const desktop = join(homedir(), "Desktop");
const folders = [
  "School Documents",
  "Screenshots & Images",
  "Code & Project Files",
  "Archives & Downloads",
  "Needs Review",
];

let removed = 0;
for (const folder of folders) {
  for (const { name } of items) {
    const p = join(desktop, folder, name);
    // Only delete EMPTY files that match a test file name
    if (existsSync(p) && statSync(p).isFile() && statSync(p).size === 0) {
      unlinkSync(p);
      removed += 1;
    }
  }
  try {
    rmdirSync(join(desktop, folder)); // only works if the folder is now empty
    console.log(`Removed empty folder: ${folder}`);
  } catch {
    // missing, or it still holds something that is not a test file: leave it
  }
}
console.log(`Removed ${removed} empty test files.`);